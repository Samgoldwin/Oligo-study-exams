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
  const controller = new AbortController();
  setTimeout(() => controller.abort(), 60_000);

  // Some providers expose the API under /v1, others expect the completion path
  // directly (or the user already pasted a URL ending in /v1). Try the most
  // likely candidates; a 404 on one path is not a verdict, so move on.
  const trimmedBase = baseUrl.replace(/\/+$/, '');
  const candidates: string[] = [];
  if (/\/v1\/?$/i.test(trimmedBase)) {
    candidates.push(`${trimmedBase}/chat/completions`);
    candidates.push(`${trimmedBase.replace(/\/v1\/?$/i, '')}/v1/chat/completions`);
  } else {
    candidates.push(`${trimmedBase}/v1/chat/completions`);
    candidates.push(`${trimmedBase}/chat/completions`);
  }

  let lastResponse: Response | null = null;
  let lastNotFoundBody = '';
  for (const endpoint of candidates) {
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

      if (upstream.status === 404) {
        lastResponse = upstream;
        try {
          lastNotFoundBody = await upstream.text();
        } catch {
          /* ignore */
        }
        continue; // wrong path or bad model — try the next candidate
      }

      const ms = Date.now() - started;
      const status = upstream.status;

      let verdict: string;
      if (status === 200) verdict = 'ok';
      else if (status === 401 || status === 403) verdict = 'invalid';
      else if (status === 402) verdict = 'no_balance';
      else if (status === 429) verdict = 'rate_limit';
      else if (status === 500 || status === 502 || status === 503) verdict = 'failed';
      else verdict = 'unknown';

      const payload: Record<string, unknown> = { ok: status === 200, status, verdict, ms };
      if (status !== 200) {
        // Peel the provider's own error out of the body so the verdict is
        // actionable (e.g. "model too large", "insufficient quota", ...).
        let providerMsg = '';
        try {
          const raw = await upstream.text();
          const parsed = JSON.parse(raw) as { error?: unknown; message?: unknown };
          const err = parsed.error ?? {};
          providerMsg =
            typeof err === 'string'
              ? err
              : String((err as { message?: unknown })?.message ?? '').trim();
          if (!providerMsg && typeof parsed.message === 'string') providerMsg = String(parsed.message);
        } catch {
          /* non-JSON body — keep the default message */
        }
        if (verdict === 'unknown') {
          payload.message = providerMsg || 'The provider responded with an unexpected status — testing may not be supported for this endpoint.';
        } else if (providerMsg) {
          payload.message = providerMsg;
        }
      }
      return res.status(200).json(payload);
    } catch {
      // Network/timeout — same for every candidate
      const ms = Date.now() - started;
      return res.status(200).json({
        ok: false,
        status: null,
        verdict: 'unknown',
        ms,
        message: 'Network timeout or unreachable provider.',
      });
    }
  }

  // Every candidate returned 404. Peel the provider's error body so we can
  // tell a bad URL apart from a bad model ID.
  const ms = Date.now() - started;
  let message = 'Endpoint returned 404 — double-check the Base URL (use the host root, e.g. https://api.openai.com).';
  try {
    const parsed = JSON.parse(lastNotFoundBody) as { error?: unknown };
    const err = parsed?.error ?? {};
    const errMsg = typeof err === 'string' ? err : String((err as { message?: unknown })?.message ?? '').trim();
    const code =
      typeof err === 'object' && err !== null && 'code' in err ? String((err as { code?: unknown }).code) : '';
    if (/model/i.test(code) || /model|not available|not found/i.test(errMsg)) {
      message = `The provider couldn't find that model — double-check the model ID (${errMsg || 'model_not_found'}).`;
    } else if (errMsg) {
      message = `Provider error: ${errMsg}`;
    }
  } catch {
    /* non-JSON body — keep the generic URL hint */
  }
  return res.status(200).json({
    ok: false,
    status: lastResponse?.status ?? 404,
    verdict: 'unknown',
    ms,
    message,
  });
}
