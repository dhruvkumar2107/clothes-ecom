import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { apiOk, apiError, rateLimit } from '@/lib/api';
import { getMailer } from '@/lib/adapters/registry';

export const dynamic = 'force-dynamic';

const Subscribe = z.object({
  email: z.string().trim().toLowerCase().email().max(200),
  name: z.string().trim().max(120).optional().nullable(),
  source: z.enum(['popup', 'footer', 'exit_intent', 'whatsapp', 'checkout']).default('footer'),
  consentWhatsapp: z.boolean().default(false),
});

function welcomeEmail(name: string | null) {
  const greeting = name ? `Hi ${name},` : 'Hello,';
  return `<!doctype html><html><body style="font-family:system-ui,-apple-system,sans-serif;line-height:1.6;color:#1a1b1e">
<h1 style="font-weight:400;letter-spacing:.02em">Welcome to the LUMEN&amp;CO Collective</h1>
<p>${greeting}</p>
<p>You're on the list. Expect early access to drops, previews of new fabrics, and styling notes — nothing more than once a week.</p>
<p style="color:#6b6c70;font-size:13px">You can unsubscribe from any email we send.</p>
</body></html>`;
}

/**
 * Newsletter opt-in.
 *
 * Accepts both JSON (from the client form) and `application/x-www-form-urlencoded`
 * so the plain `<form action method="POST">` in the footer keeps working with
 * JavaScript disabled — that path answers with a redirect instead of JSON.
 *
 * Re-subscribing an existing address is a success, not a conflict: the caller
 * gets the same answer either way, so the endpoint can't be used to test whether
 * a given email is already on the list.
 */
export async function POST(request: NextRequest) {
  const contentType = request.headers.get('content-type') ?? '';
  const isForm =
    contentType.includes('application/x-www-form-urlencoded') ||
    contentType.includes('multipart/form-data');

  /** Where a no-JS form post should land, with a status the page can render. */
  const back = (status: 'ok' | 'invalid' | 'error') => {
    const referer = request.headers.get('referer');
    let target = new URL('/', request.url);
    if (referer) {
      try {
        const parsed = new URL(referer);
        // Only follow a same-origin referer — never turn this into an open redirect.
        if (parsed.origin === new URL(request.url).origin) target = parsed;
      } catch {
        /* malformed referer — fall back to the homepage */
      }
    }
    target.searchParams.set('newsletter', status);
    target.hash = 'newsletter';
    return NextResponse.redirect(target, 303);
  };

  const limited = await rateLimit(request, { limit: 10, window: '10m', keyPrefix: 'newsletter' });
  if (limited.limited) return isForm ? back('error') : limited.response!;

  let raw: unknown;
  try {
    if (isForm) {
      const form = await request.formData();
      raw = {
        email: form.get('email'),
        name: form.get('name') ?? undefined,
        source: form.get('source') ?? 'footer',
        consentWhatsapp: form.get('consentWhatsapp') === 'on',
      };
    } else {
      raw = await request.json();
    }
  } catch {
    return isForm ? back('invalid') : apiError('VALIDATION_ERROR', 'Invalid request body', 400);
  }

  const parsed = Subscribe.safeParse(raw);
  if (!parsed.success) {
    return isForm
      ? back('invalid')
      : apiError('VALIDATION_ERROR', 'Enter a valid email address', 400, { field: 'email' });
  }

  const { email, name, source, consentWhatsapp } = parsed.data;

  try {
    const existing = await db.newsletterSubscriber.findUnique({
      where: { email },
      select: { id: true, status: true },
    });

    await db.newsletterSubscriber.upsert({
      where: { email },
      create: { email, name: name ?? null, source, consentEmail: true, consentWhatsapp },
      update: {
        consentEmail: true,
        consentWhatsapp: consentWhatsapp || undefined,
        status: 'subscribed',
        unsubscribedAt: null,
        ...(name ? { name } : {}),
      },
    });

    // Only greet genuinely new (or returning) subscribers — a double submit
    // shouldn't send a second welcome.
    const isNew = !existing || existing.status !== 'subscribed';
    if (isNew) {
      await getMailer()
        .send({
          to: email,
          subject: 'Welcome to the LUMEN&CO Collective',
          html: welcomeEmail(name ?? null),
          text: "You're on the list. Early access to drops, previews and styling notes — weekly at most.",
          template: 'newsletter_welcome',
        })
        .catch((error) => {
          // A failed welcome email must not fail the subscription itself.
          console.error('[newsletter] welcome email failed:', error);
        });
    }

    return isForm ? back('ok') : apiOk({ subscribed: true, alreadySubscribed: !isNew });
  } catch (err) {
    console.error('[newsletter] subscribe failed:', err);
    return isForm ? back('error') : apiError('INTERNAL_ERROR', 'Could not subscribe right now', 500);
  }
}

const Unsubscribe = z.object({ email: z.string().trim().toLowerCase().email() });

/** Honours the unsubscribe link in outbound mail. */
export async function DELETE(request: NextRequest) {
  const url = new URL(request.url);
  const parsed = Unsubscribe.safeParse({ email: url.searchParams.get('email') ?? '' });
  if (!parsed.success) return apiError('VALIDATION_ERROR', 'Invalid email address', 400);

  try {
    await db.newsletterSubscriber.updateMany({
      where: { email: parsed.data.email },
      data: { status: 'unsubscribed', unsubscribedAt: new Date() },
    });
    // Unconditional success — the response must not reveal list membership.
    return apiOk({ unsubscribed: true });
  } catch (err) {
    console.error('[newsletter] unsubscribe failed:', err);
    return apiError('INTERNAL_ERROR', 'Could not unsubscribe right now', 500);
  }
}
