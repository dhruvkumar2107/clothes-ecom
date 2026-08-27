import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { apiOk, apiError, rateLimit } from '@/lib/api';
import { getCustomerSession } from '@/lib/auth/session';
import { generateTicketRef } from '@/lib/ids';
import { getMailer } from '@/lib/adapters/registry';

export const dynamic = 'force-dynamic';

const TOPICS = ['general', 'order', 'return', 'product', 'payment', 'wholesale', 'press'] as const;

const Enquiry = z.object({
  name: z.string().trim().min(2, 'Tell us your name').max(120),
  email: z.string().trim().toLowerCase().email('That email does not look right').max(200),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[1-9]\d{9,14}$/, 'Enter a valid phone number')
    .optional()
    .or(z.literal('')),
  orderNumber: z.string().trim().max(40).optional().or(z.literal('')),
  topic: z.enum(TOPICS).default('general'),
  subject: z.string().trim().min(3, 'Add a short subject').max(160),
  message: z.string().trim().min(20, 'Please give us a little more detail').max(4000),
});

function acknowledgement(name: string, ref: string, subject: string) {
  return `<!doctype html><html><body style="font-family:system-ui,-apple-system,sans-serif;line-height:1.6;color:#1a1b1e">
<h1 style="font-weight:400;letter-spacing:.02em">We have your message</h1>
<p>Hi ${name},</p>
<p>Thanks for writing in. Your reference is <strong>${ref}</strong> — quote it if you follow up.</p>
<p style="color:#6b6c70">Subject: ${subject}</p>
<p>We answer Monday to Saturday, 10:00–19:00 IST, usually within one working day.</p>
</body></html>`;
}

/**
 * Contact form.
 *
 * Takes JSON from the page's own form and `application/x-www-form-urlencoded`
 * from the same markup without JavaScript, answering the latter with a redirect
 * so the plain form still works.
 *
 * Every enquiry becomes a SupportTicket so the admin queue is the single place
 * staff look — nothing arrives only as an email that someone has to remember to
 * forward.
 */
export async function POST(request: NextRequest) {
  const contentType = request.headers.get('content-type') ?? '';
  const isForm =
    contentType.includes('application/x-www-form-urlencoded') ||
    contentType.includes('multipart/form-data');

  /** Where a no-JS form post should land, with a status the page can render. */
  const back = (status: 'ok' | 'invalid' | 'error', ref?: string) => {
    const referer = request.headers.get('referer');
    let target = new URL('/contact', request.url);
    if (referer) {
      try {
        const parsed = new URL(referer);
        // Only follow a same-origin referer — never turn this into an open redirect.
        if (parsed.origin === new URL(request.url).origin) target = parsed;
      } catch {
        /* malformed referer — fall back to /contact */
      }
    }
    target.searchParams.set('contact', status);
    if (ref) target.searchParams.set('ref', ref);
    target.hash = 'contact-form';
    return NextResponse.redirect(target, 303);
  };

  // Anonymous by design — a shopper must be able to reach us before signing in —
  // so this carries its own limit.
  const limited = await rateLimit(request, { limit: 5, window: '10m', keyPrefix: 'contact' });
  if (limited.limited) {
    return isForm ? back('error') : limited.response!;
  }

  let payload: unknown;
  try {
    if (isForm) {
      payload = Object.fromEntries((await request.formData()).entries());
    } else {
      payload = await request.json();
    }
  } catch {
    return isForm ? back('invalid') : apiError('BAD_REQUEST', 'Could not read that request');
  }

  const parsed = Enquiry.safeParse(payload);
  if (!parsed.success) {
    if (isForm) return back('invalid');
    const first = parsed.error.issues[0];
    return apiError('VALIDATION_ERROR', first?.message ?? 'Check the form', 400, {
      field: first?.path.join('.'),
      details: parsed.error.issues,
    });
  }

  const { name, email, phone, orderNumber, topic, subject, message } = parsed.data;

  try {
    // Attach the ticket to the account when one is signed in, so the customer's
    // history is in one place; guests still get a ticket, keyed by email.
    const session = await getCustomerSession();

    const ref = await generateTicketRef();
    const ticket = await db.supportTicket.create({
      data: {
        ref,
        userId: session?.userId ?? null,
        name,
        email,
        phone: phone || null,
        orderNumber: orderNumber || null,
        topic,
        subject,
        body: message,
        // An enquiry about money or a delivery in flight should surface above a
        // general question.
        priority: topic === 'payment' || topic === 'order' ? 'high' : 'normal',
        messages: { create: { author: 'customer', body: message } },
      },
      select: { id: true, ref: true, createdAt: true },
    });

    await getMailer()
      .send({
        to: email,
        subject: `We have your message — ${ticket.ref}`,
        html: acknowledgement(name, ticket.ref, subject),
        text: `Thanks for writing in. Your reference is ${ticket.ref}. We answer within one working day.`,
        template: 'support_ack',
      })
      .catch((error) => {
        // A failed acknowledgement must not lose the enquiry.
        console.error('[contact] acknowledgement email failed:', error);
      });

    return isForm ? back('ok', ticket.ref) : apiOk({ ref: ticket.ref });
  } catch (error) {
    console.error('[contact] could not record enquiry:', error);
    return isForm
      ? back('error')
      : apiError('INTERNAL_ERROR', 'Could not send your message. Please try again.', 500);
  }
}
