import type { VercelRequest, VercelResponse } from '@vercel/node';
import { resolveAuth } from '../../_lib/auth';
import { decryptKey } from '../../_lib/secrets';
import { asString } from '../../_lib/http';

/**
 * POST /api/syncai/models/test
 *
 * Verifies a BYO model endpoint WITHOUT persisting anything. The API key is
 * still encrypted client-side (RSA-OAEP) before it reaches this route; we
 * decrypt in-memory only to make the upstream call, then never store it.
 */

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'method_not_allowed', message: 'Method not allowed' });
  }

  // Mirrors chat.ts: auth is enforced only when a service account is
  // configured; otherwise the dev/guest path is allowed.
  const auth = await resolveAuth(req);
  if (process.env.FIREBASE_SERVICE_ACCOUNT && !auth.uid) {
    return res.status(401).json({ error: 'unauthorized', message: 'Sign in to test custom models.' });
  }

  const body = (req.body ?? {}) as Record<string, unknown>;
  const baseUrl = (asString(body.base_url ?? body.baseUrl, 300) ?? '').replace(/\/+$/, '');
  const model = asString(body.model, 120) ?? '';
  const encryptedKey = asString(body.encrypted_key ?? body.encryptedKey, 6000) ?? '';

  if (!baseUrl || !model || !encryptedKey) {
    return res.status(400).json({
      error: 'invalid_input',
      message: 'base_url, model, and encrypted_key are required.',
    });
  }
  if (!/^https:\/\//i.test(baseUrl)) {
    return res.status(400).json({ error: 'invalid_input', message: 'base_url must start with https://' });
  }

  let apiKey: string;
  try {
    apiKey = decryptKey(encryptedKey);
  } catch {
    return res.status(200).json({
      ok: false,
      status: null,
      verdict: 'unknown',
      ms: 0,
      message: 'Could not decrypt the key — please re-enter it and try again.',
    });
  }

  const started = Date.now();
  const endpoint = `${baseUrl}/v1/chat/completions`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);

  try {
    const upstream = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 4,
      }),
      signal: controller.signal,
    });

    const ms = Date.now() - started;
    const status = upstream.status;

    let verdict: string;
    if (status === 200) verdict = 'ok';
    else if (status === 401 || status === 403) verdict = 'invalid';
    else if (status === 402) verdict = 'no_balance';
    else if (status === 429) verdict = 'rate_limit';
    else if (status === 500 || status === 502 || status === 503) verdict = 'failed';
    else verdict = 'unknown';

    return res.status(200).json({ ok: status === 200, status, verdict, ms });
  } catch {
    const ms = Date.now() - started;
    return res.status(200).json({
      ok: false,
      status: null,
      verdict: 'unknown',
      ms,
      message: 'Network timeout or unreachable provider.',
    });
  } finally {
    clearTimeout(timer);
  }
}
