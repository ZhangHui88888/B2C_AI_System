import type { Env } from '../index';
import { jsonResponse } from './response';

export function validateCronSecret(
  request: Request,
  env: Env
): { ok: true } | { ok: false; response: Response } {
  const secret = (env as any).CRON_SECRET as string | undefined;
  if (!secret) {
    return { ok: false, response: jsonResponse({ error: 'CRON_SECRET is not configured' }, 403) };
  }

  const header = request.headers.get('x-cron-secret') || request.headers.get('X-Cron-Secret');
  if (!header || header !== secret) {
    return { ok: false, response: jsonResponse({ error: 'Invalid cron secret' }, 403) };
  }

  return { ok: true };
}
