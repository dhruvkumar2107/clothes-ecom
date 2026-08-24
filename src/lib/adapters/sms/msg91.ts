import { db } from '../../db';
import { writeJson } from '../../json';
import { gatewayFetch } from '../http';
import { GatewayError, type DriverMode, type SmsMessage, type SmsSender } from '../types';

/**
 * MSG91 — the primary Indian SMS rail.
 *
 * Docs: https://docs.msg91.com/reference/send-sms
 *
 * Indian SMS is governed by TRAI's DLT regime, and that single fact shapes this
 * driver more than the API does:
 *
 *   • **Arbitrary text cannot be sent.** Every transactional message must match a
 *     DLT-registered template, referenced by `template_id`, with only the declared
 *     variables substituted. So when `dltTemplateId` is configured this driver
 *     sends *variables*, not a body, and `SmsMessage.meta` is the variable map.
 *   • **Without a template id there is no compliant path.** The legacy
 *     `sendhttp.php` endpoint still accepts free text and operators still relay
 *     it, but DLT scrubbing rejects unregistered content — silently, per-operator,
 *     often only for some circles. It is wired up as a fallback because it is
 *     genuinely what MSG91 offers, and it logs a warning saying exactly why the
 *     message may vanish. That is more useful than pretending either that it works
 *     or that it doesn't.
 *   • **Numbers must be 91-prefixed.** A bare 10-digit mobile is accepted and
 *     then not delivered.
 *
 * MSG91 returns HTTP 200 for business failures with `{type: 'error'}`, so status
 * codes alone never establish that a message was accepted.
 */

interface Msg91Config {
  authKey: string;
  senderId: string;
  dltTemplateId: string | null;
}

interface Msg91Response {
  type?: 'success' | 'error';
  message?: string | Record<string, unknown>;
  request_id?: string;
  errors?: unknown;
}

const FLOW_URL = 'https://control.msg91.com/api/v5/flow/';
const LEGACY_URL = 'https://api.msg91.com/api/sendhttp.php';

/**
 * Indian mobile in MSG91's expected form: country code + 10 digits, no plus.
 * Anything that is not a plausible Indian mobile is rejected here rather than
 * accepted and silently dropped by the operator.
 */
function normalizeMobile(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  const local = digits.length > 10 ? digits.slice(-10) : digits;

  if (!/^[6-9]\d{9}$/.test(local)) {
    throw new GatewayError({
      code: 'invalid_mobile',
      message: `msg91: ${phone} is not a valid Indian mobile number`,
      provider: 'msg91',
      retryable: false,
      userMessage: 'That mobile number does not look valid. Please check it and try again.',
    });
  }
  return `91${local}`;
}

function errorText(data: Msg91Response): string {
  if (typeof data.message === 'string') return data.message;
  if (data.message) return JSON.stringify(data.message);
  if (data.errors) return JSON.stringify(data.errors);
  return 'message was not accepted';
}

export class Msg91Sender implements SmsSender {
  readonly name = 'msg91';
  readonly mode: DriverMode = 'live';
  readonly label = 'MSG91 SMS';

  private readonly config: Msg91Config;
  /** Logged once per process, not once per message. */
  private warnedAboutMissingTemplate = false;

  constructor(config: Msg91Config) {
    this.config = config;
  }

  async send(message: SmsMessage): Promise<{ id: string; accepted: boolean }> {
    if ((message.channel ?? 'sms') === 'whatsapp') {
      // MSG91's WhatsApp product is a separate API with its own approved-template
      // registry. Rather than guess at a template name, refuse clearly — the
      // registry falls back to Twilio for WhatsApp when it is configured.
      throw new GatewayError({
        code: 'channel_unsupported',
        message: 'msg91: WhatsApp is not configured on this driver; use the Twilio sender',
        provider: 'msg91',
        retryable: false,
      });
    }

    const mobile = normalizeMobile(message.to);

    let providerId = '';
    let accepted = false;
    let failure: string | null = null;
    let retryable = false;

    try {
      const result = this.config.dltTemplateId
        ? await this.sendViaFlow(mobile, message)
        : await this.sendViaLegacy(mobile, message);
      providerId = result.id;
      accepted = true;
    } catch (error) {
      if (error instanceof GatewayError) {
        failure = error.message;
        retryable = error.retryable;
      } else {
        failure = error instanceof Error ? error.message : String(error);
        retryable = true;
      }
    }

    await this.record(message, { providerId, accepted, failure, retryable });

    if (!accepted) {
      // OTP delivery is a blocking step in a login flow — unlike email, the
      // caller has to know it failed so it can show the user something.
      throw new GatewayError({
        code: 'sms_send_failed',
        message: `msg91: ${failure}`,
        provider: 'msg91',
        retryable,
        userMessage: 'We could not send the code to that number. Please try again in a moment.',
      });
    }

    return { id: providerId, accepted: true };
  }

  /** DLT-compliant path: a registered template plus declared variables. */
  private async sendViaFlow(mobile: string, message: SmsMessage): Promise<{ id: string }> {
    // MSG91 flow variables are template-declared names. `meta` carries them when
    // the caller knows the template; otherwise the rendered body goes in as the
    // conventional single `body` variable.
    const variables: Record<string, string> = {};
    for (const [key, value] of Object.entries(message.meta ?? {})) {
      if (value === null || value === undefined) continue;
      variables[key] = String(value);
    }
    if (Object.keys(variables).length === 0) variables.body = message.body;

    const response = await gatewayFetch<Msg91Response>({
      provider: 'msg91',
      url: FLOW_URL,
      method: 'POST',
      headers: { authkey: this.config.authKey },
      body: {
        template_id: this.config.dltTemplateId,
        sender: this.config.senderId,
        short_url: 0,
        recipients: [{ mobiles: mobile, ...variables }],
      },
      timeoutMs: 15_000,
      // Business failures arrive as 200s; 400s carry the useful validation text.
      expectStatuses: [200, 400, 401, 422],
    });

    const data = response.data;
    if (data.type === 'error' || (!data.request_id && data.type !== 'success')) {
      throw new GatewayError({
        code: 'flow_rejected',
        message: errorText(data),
        provider: 'msg91',
        // 401 is a bad auth key — never worth retrying.
        retryable: response.status !== 401 && response.status !== 400,
        raw: response.responseSnapshot,
      });
    }

    // v5 returns the request id in `request_id`, or in `message` on older tenants.
    return { id: data.request_id ?? (typeof data.message === 'string' ? data.message : '') };
  }

  /** Free-text fallback. Works, but DLT may scrub unregistered content. */
  private async sendViaLegacy(mobile: string, message: SmsMessage): Promise<{ id: string }> {
    if (!this.warnedAboutMissingTemplate) {
      this.warnedAboutMissingTemplate = true;
      console.warn(
        '[sms:msg91] MSG91_TEMPLATE_ID is not set, so messages are being sent as free text. ' +
          'Indian operators may drop these under DLT rules. Register a DLT template and set MSG91_TEMPLATE_ID.',
      );
    }

    const query = new URLSearchParams({
      authkey: this.config.authKey,
      mobiles: mobile,
      message: message.body,
      sender: this.config.senderId,
      route: '4', // transactional
      country: '91',
      response: 'json',
    }).toString();

    const response = await gatewayFetch<Msg91Response | string>({
      provider: 'msg91',
      url: `${LEGACY_URL}?${query}`,
      method: 'GET',
      timeoutMs: 15_000,
      expectStatuses: [200, 400],
    });

    // This endpoint answers with a bare request id string on success and a
    // sentence on failure — not JSON, whatever `response=json` suggests.
    const data = response.data;
    if (typeof data === 'string') {
      if (/^[A-Za-z0-9]{10,}$/.test(data.trim())) return { id: data.trim() };
      throw new GatewayError({
        code: 'legacy_rejected',
        message: data.slice(0, 200),
        provider: 'msg91',
        retryable: false,
        raw: response.responseSnapshot,
      });
    }

    if (data.type === 'error') {
      throw new GatewayError({
        code: 'legacy_rejected',
        message: errorText(data),
        provider: 'msg91',
        retryable: false,
        raw: response.responseSnapshot,
      });
    }

    return { id: data.request_id ?? '' };
  }

  private async record(
    message: SmsMessage,
    result: { providerId: string; accepted: boolean; failure: string | null; retryable: boolean },
  ): Promise<void> {
    try {
      await db.outbox.create({
        data: {
          channel: message.channel ?? 'sms',
          provider: 'msg91',
          to: message.to,
          body: message.body,
          template: message.template ?? this.config.dltTemplateId,
          status: result.accepted ? 'sent' : 'failed',
          error: result.failure,
          metaJson: writeJson({
            ...message.meta,
            providerId: result.providerId,
            sender: this.config.senderId,
            retryable: result.accepted ? false : result.retryable,
          }),
          sentAt: result.accepted ? new Date() : null,
        },
      });
    } catch (error) {
      console.warn(
        `[sms:msg91] Outbox row could not be written: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}
