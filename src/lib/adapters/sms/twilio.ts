import { db } from '../../db';
import { writeJson } from '../../json';
import { formEncode, gatewayFetch } from '../http';
import { GatewayError, type DriverMode, type SmsMessage, type SmsSender } from '../types';

/**
 * Twilio — SMS and WhatsApp.
 *
 * Docs: https://www.twilio.com/docs/messaging/api/message-resource
 *
 * This is the WhatsApp path for the platform (order updates, delivery
 * notifications, the WhatsApp opt-in), and the international SMS fallback for
 * customers outside India where MSG91's DLT rail does not apply.
 *
 * Four properties of the API that the code has to respect:
 *
 *   • **The request is form-encoded, not JSON.** `Messages.json` names the
 *     response format, not the request's. Posting JSON returns a 400 that reads
 *     like a missing-parameter error.
 *   • **There is no idempotency key.** Twilio has none for Messages, so a
 *     retried timeout genuinely sends a second message. The shared HTTP client
 *     already gives a keyless mutating request exactly one attempt, which is the
 *     behaviour we want: a duplicate OTP text is worse than a failed one.
 *   • **`status: 'queued'` is success.** Twilio accepts a message and delivers it
 *     asynchronously; delivery failures arrive later on the status webhook. Only
 *     an `error_code` on the create response means it was rejected outright.
 *   • **WhatsApp needs the `whatsapp:` prefix on both ends** and only works from
 *     a sender registered to a WhatsApp Business account — the sandbox number
 *     additionally requires the recipient to have opted in by messaging it first.
 */

interface TwilioConfig {
  accountSid: string;
  authToken: string;
  fromNumber: string;
  whatsappFrom: string | null;
}

interface TwilioMessage {
  sid?: string;
  status?: 'accepted' | 'queued' | 'sending' | 'sent' | 'delivered' | 'undelivered' | 'failed';
  error_code?: number | null;
  error_message?: string | null;
  num_segments?: string;
  price?: string | null;
  /** Present on error responses instead of the message fields. */
  code?: number;
  message?: string;
  more_info?: string;
}

const API_BASE = 'https://api.twilio.com/2010-04-01';

/** Twilio error codes that are worth another attempt later. */
const TRANSIENT_CODES = new Set([
  20429, // too many requests
  20500, // internal server error
  30001, // queue overflow
  30002, // account suspended — transient in the sense that support can fix it
]);

/**
 * E.164. A bare 10-digit number is assumed Indian, which is the default market;
 * anything already carrying a `+` or a country code is passed through so an
 * international customer is not silently rewritten into a wrong country.
 */
function toE164(phone: string): string {
  const trimmed = phone.trim();
  if (trimmed.startsWith('+')) {
    const digits = trimmed.slice(1).replace(/\D/g, '');
    if (digits.length < 8 || digits.length > 15) {
      throw invalidNumber(phone);
    }
    return `+${digits}`;
  }

  const digits = trimmed.replace(/\D/g, '');
  if (/^[6-9]\d{9}$/.test(digits)) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith('91')) return `+${digits}`;
  if (digits.length >= 8 && digits.length <= 15) return `+${digits}`;
  throw invalidNumber(phone);
}

function invalidNumber(phone: string): GatewayError {
  return new GatewayError({
    code: 'invalid_mobile',
    message: `twilio: ${phone} is not a usable E.164 number`,
    provider: 'twilio',
    retryable: false,
    userMessage: 'That phone number does not look valid. Please check it and try again.',
  });
}

export class TwilioSender implements SmsSender {
  readonly name = 'twilio';
  readonly mode: DriverMode = 'live';
  readonly label = 'Twilio SMS / WhatsApp';

  private readonly config: TwilioConfig;

  constructor(config: TwilioConfig) {
    this.config = config;
  }

  async send(message: SmsMessage): Promise<{ id: string; accepted: boolean }> {
    const channel = message.channel ?? 'sms';
    const whatsapp = channel === 'whatsapp';

    const from = whatsapp ? this.config.whatsappFrom : this.config.fromNumber;
    if (!from) {
      throw new GatewayError({
        code: 'sender_not_configured',
        message: whatsapp
          ? 'twilio: TWILIO_WHATSAPP_FROM is not set'
          : 'twilio: TWILIO_FROM_NUMBER is not set',
        provider: 'twilio',
        retryable: false,
      });
    }

    const to = toE164(message.to);
    const prefix = whatsapp ? 'whatsapp:' : '';

    let sid = '';
    let accepted = false;
    let failure: string | null = null;
    let retryable = false;
    let snapshot: unknown = null;

    try {
      const response = await gatewayFetch<TwilioMessage>({
        provider: 'twilio',
        url: `${API_BASE}/Accounts/${encodeURIComponent(this.config.accountSid)}/Messages.json`,
        method: 'POST',
        basicAuth: { username: this.config.accountSid, password: this.config.authToken },
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        // Pre-encoded string: the HTTP client passes strings through untouched.
        body: formEncode({
          To: `${prefix}${to}`,
          From: `${prefix}${toE164(from)}`,
          Body: message.body,
        }),
        timeoutMs: 15_000,
        // Twilio puts its own error codes in 400 bodies, which are far more
        // useful than a bare transport failure.
        expectStatuses: [200, 201, 400, 401, 403, 429],
      });

      snapshot = response.responseSnapshot;
      const data = response.data;

      if (data.error_code || data.code || !data.sid) {
        const code = data.error_code ?? data.code ?? 0;
        failure = `[${code}] ${data.error_message ?? data.message ?? 'message was not accepted'}`;
        retryable = TRANSIENT_CODES.has(Number(code)) || response.status === 429;
      } else {
        sid = data.sid;
        // 'failed'/'undelivered' on the create response means immediate rejection.
        accepted = data.status !== 'failed' && data.status !== 'undelivered';
        if (!accepted) failure = `twilio returned status ${data.status}`;
      }
    } catch (error) {
      if (error instanceof GatewayError) {
        failure = error.message;
        retryable = error.retryable;
      } else {
        failure = error instanceof Error ? error.message : String(error);
        // No idempotency key means we cannot know whether it was delivered, so a
        // network failure is not automatically safe to repeat.
        retryable = false;
      }
    }

    await this.record(message, channel, { sid, accepted, failure, retryable, snapshot });

    if (!accepted) {
      throw new GatewayError({
        code: 'sms_send_failed',
        message: `twilio: ${failure}`,
        provider: 'twilio',
        retryable,
        userMessage: whatsapp
          ? 'We could not send that WhatsApp message. Please try again shortly.'
          : 'We could not send the code to that number. Please try again in a moment.',
      });
    }

    return { id: sid, accepted: true };
  }

  private async record(
    message: SmsMessage,
    channel: string,
    result: {
      sid: string;
      accepted: boolean;
      failure: string | null;
      retryable: boolean;
      snapshot: unknown;
    },
  ): Promise<void> {
    try {
      await db.outbox.create({
        data: {
          channel,
          provider: 'twilio',
          to: message.to,
          body: message.body,
          template: message.template ?? null,
          status: result.accepted ? 'sent' : 'failed',
          error: result.failure,
          metaJson: writeJson({
            ...message.meta,
            sid: result.sid,
            retryable: result.accepted ? false : result.retryable,
            response: result.snapshot,
          }),
          sentAt: result.accepted ? new Date() : null,
        },
      });
    } catch (error) {
      console.warn(
        `[sms:twilio] Outbox row could not be written: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}
