import crypto from 'node:crypto';
import { db } from '../../db';
import { writeJson } from '../../json';
import type { MailMessage, Mailer } from '../types';

/**
 * Mock mailer — writes to the `Outbox` table instead of an SMTP socket.
 *
 * This is the driver that runs until SMTP credentials exist, so "no keys" must
 * not mean "no email". Every send is persisted, which makes it strictly more
 * useful than a real mailer during development:
 *
 *   • Admin → Marketing → Outbox is a real inbox. Order confirmations, invoices,
 *     abandoned-cart nudges and password-reset links can all be read there, so
 *     the flows are testable end to end without a mail server.
 *   • Reset and verification links are *logged to the console too*, because the
 *     fastest path through a signup flow is clicking a link out of the terminal.
 *   • A failed persist is swallowed. A mailer that throws is a mailer that rolls
 *     back an order the customer has already paid for — email is a side effect of
 *     a transaction, never a precondition for it.
 *
 * The one deliberate asymmetry with SMTP: `accepted` is true whenever the row was
 * written. There is no delivery to fail at.
 */
export class MockMailer implements Mailer {
  readonly name = 'mock';
  readonly mode = 'mock' as const;
  readonly label = 'Mock mailer (Outbox)';

  async send(message: MailMessage): Promise<{ id: string; accepted: boolean }> {
    // Generated up front so the caller gets a stable id even if the write fails.
    const id = `mail_mock_${crypto.randomBytes(9).toString('hex')}`;
    const text = message.text ?? htmlToText(message.html);

    try {
      const row = await db.outbox.create({
        data: {
          channel: 'email',
          provider: 'mock',
          to: message.to,
          subject: message.subject,
          body: message.html,
          template: message.template ?? null,
          status: 'sent',
          campaignId: message.campaignId ?? null,
          metaJson: writeJson({ ...message.meta, replyTo: message.replyTo ?? null, id, text }),
          sentAt: new Date(),
        },
        select: { id: true },
      });

      logToConsole(message, text);
      return { id: row.id, accepted: true };
    } catch (error) {
      // Losing the audit row is bad; failing the caller's transaction is worse.
      console.warn(
        `[mail:mock] could not persist to Outbox for ${message.to}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      logToConsole(message, text);
      return { id, accepted: true };
    }
  }
}

/**
 * Anything that looks like a verification or reset URL is surfaced in the
 * terminal. Without this, testing a password reset means opening a database
 * browser to read a token out of an HTML blob.
 */
const LINK_PATTERN = /https?:\/\/[^\s"'<>]+(?:token|otp|code|verify|reset)[^\s"'<>]*/gi;

function logToConsole(message: MailMessage, text: string): void {
  if (process.env.NODE_ENV === 'production') return;

  const links = Array.from(new Set(message.html.match(LINK_PATTERN) ?? []));
  const preview = text.replace(/\s+/g, ' ').trim().slice(0, 160);

  console.info(`\n📧 [mock mail] → ${message.to}\n   ${message.subject}\n   ${preview}`);
  for (const link of links) console.info(`   🔗 ${link}`);
}

/**
 * Minimal HTML → text for the plain-text part and the console preview. Not a
 * general converter: it only has to be readable, and every template we send is
 * one we wrote.
 */
function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|tr|h[1-6]|li)>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
