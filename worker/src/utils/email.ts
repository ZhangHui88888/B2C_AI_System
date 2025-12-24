import type { Env } from '../index';

export interface SendEmailPayload {
  to: string;
  subject: string;
  html: string;
  bcc?: string;
}

export async function sendResendEmail(env: Env, payload: SendEmailPayload): Promise<void> {
  if (!env.RESEND_API_KEY) return;
  if (!payload.to) return;

  const from = env.NOTIFY_EMAIL;
  if (!from) return;

  const body: any = {
    from,
    to: payload.to,
    subject: payload.subject,
    html: payload.html,
  };

  if (payload.bcc) body.bcc = payload.bcc;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    console.error('Resend email failed:', res.status, text);
  }
}
