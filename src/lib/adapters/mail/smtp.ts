import nodemailer, { type Transporter } from 'nodemailer';
import { db } from '../../db';
import { writeJson } from '../../json';
import type { DriverMode, MailMessage, Mailer } from '../types';

/**
 * SMTP mailer (nodemailer) — the live driver, active as soon as SMTP_HOST,
 * SMTP_USER and SMTP_PASSWORD are set.
 *
 * Three decisions worth stating:
 *
 *   • **The transporter is pooled and created once.** A fresh transporter per
 *     send means a new TCP connection and TLS handshake per email; a 200-recipient
 *     campaign then spends most of its time in handshakes and trips the provider's
 *     connection-rate limit.
 *   • **A send failure is recorded, not thrown.** Email is a side effect of an
 *     order, not a precondition for one — a bounced confirmation must never roll
 *     back a payment that already succeeded. Failures land in `Outbox` with
 *     `status: 'failed'` and the SMTP response, which is what the retry queue and
 *     the admin Outbox view read.
 *   • **Every send is mirrored to `Outbox`.** Same table the mock writes to, so
 *     the admin view, campaign analytics and resend action work identically on
 *     either driver.
 *
 * `secure` is forced on for port 465 (implicit TLS). Leaving it false there
 * produces a hang rather than an error, because the server is waiting for a TLS
 * ClientHello while nodemailer waits for a plaintext greeting.
 */

interface SmtpConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  from: string;
  secure: boolean;
}

/** SMTP 4xx is transient (greylisting, rate limit); 5xx is permanent. */
function isTransient(error: unknown): boolean {
  const code = (error as { responseCode?: number } | null)?.responseCode;
  if (typeof code === 'number') return code >= 400 && code < 500;
  const name = (error as { code?: string } | null)?.code ?? '';
  return ['ETIMEDOUT', 'ECONNRESET', 'ECONNECTION', 'ESOCKET', 'EDNS'].includes(name);
}

export class SmtpMailer implements Mailer {
  readonly name = 'smtp';
  readonly mode: DriverMode = 'live';
  readonly label: string;

  private readonly config: SmtpConfig;
  private transporter: Transporter | null = null;

  constructor(config: SmtpConfig) {
    this.config = config;
    this.label = `SMTP (${config.host})`;
  }

  private get client(): Transporter {
    if (this.transporter) return this.transporter;

    this.transporter = nodemailer.createTransport({
      host: this.config.host,
      port: this.config.port,
      // Port 465 is implicit TLS and must be secure regardless of the flag.
      secure: this.config.secure || this.config.port === 465,
      auth: { user: this.config.user, pass: this.config.password },
      pool: true,
      maxConnections: 3,
      maxMessages: 100,
      connectionTimeout: 15_000,
      greetingTimeout: 10_000,
      socketTimeout: 30_000,
    });

    return this.transporter;
  }

  /** Admin "test connection" button — verifies credentials without sending. */
  async verify(): Promise<{ ok: boolean; error?: string }> {
    try {
      await this.client.verify();
      return { ok: true };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  async send(message: MailMessage): Promise<{ id: string; accepted: boolean }> {
    let messageId = '';
    let accepted = false;
    let failure: string | null = null;
    let transient = false;

    try {
      const info = await this.client.sendMail({
        from: this.config.from,
        to: message.to,
        subject: message.subject,
        html: message.html,
        text: message.text,
        replyTo: message.replyTo,
        headers: message.campaignId
          ? {
              // Lets a recipient's client offer one-click unsubscribe, and lets
              // us correlate a bounce webhook back to the campaign.
              'X-Campaign-Id': message.campaignId,
            }
          : undefined,
      });

      messageId = info.messageId ?? '';
      // nodemailer reports per-recipient acceptance; a message can be "sent" with
      // every recipient rejected, which is not a success.
      accepted = (info.accepted?.length ?? 0) > 0;
      if (!accepted) failure = `all recipients rejected: ${info.response ?? 'no response'}`;
    } catch (error) {
      failure = error instanceof Error ? error.message : String(error);
      transient = isTransient(error);
    }

    await this.record(message, { messageId, accepted, failure, transient });

    return { id: messageId || `mail_smtp_failed_${Date.now()}`, accepted };
  }

  /**
   * Audit row. Wrapped because a database hiccup while recording a *successful*
   * send must not turn into a thrown error that the caller reads as a send
   * failure and then retries — that duplicates the email.
   */
  private async record(
    message: MailMessage,
    result: { messageId: string; accepted: boolean; failure: string | null; transient: boolean },
  ): Promise<void> {
    try {
      await db.outbox.create({
        data: {
          channel: 'email',
          provider: 'smtp',
          to: message.to,
          subject: message.subject,
          body: message.html,
          template: message.template ?? null,
          status: result.accepted ? 'sent' : 'failed',
          error: result.failure,
          campaignId: message.campaignId ?? null,
          metaJson: writeJson({
            ...message.meta,
            messageId: result.messageId,
            host: this.config.host,
            // The retry worker only picks up rows it can plausibly succeed on.
            retryable: result.accepted ? false : result.transient,
          }),
          sentAt: result.accepted ? new Date() : null,
        },
      });
    } catch (error) {
      console.warn(
        `[mail:smtp] send ${result.accepted ? 'succeeded' : 'failed'} but the Outbox row could not be written: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}
