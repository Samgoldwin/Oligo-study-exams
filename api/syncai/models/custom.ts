import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  listCustomModels,
  saveCustomModel,
  deleteCustomModel,
} from '../../_lib/customModels';
import { asString } from '../../_lib/http';
import { resolveAuth } from '../../_lib/auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Mirrors chat.ts: auth is enforced only when a service account is
  // configured. Otherwise (local dev) we use a shared guest identity so the
  // flow works end-to-end without a verified token.
  const auth = await resolveAuth(req);
  if (process.env.FIREBASE_SERVICE_ACCOUNT && !auth.uid) {
    return res.status(401).json({ error: 'unauthorized', message: 'Sign in to manage custom models.' });
  }
  const uid = auth.uid ?? 'guest';

  // List
  if (req.method === 'GET') {
    try {
      const models = await listCustomModels(uid);
      return res.status(200).json({ models });
    } catch (err) {
      console.error('list custom models failed:', err);
      return res.status(500).json({ error: 'server_error', message: 'Could not list custom models.' });
    }
  }

  // Save / update
  if (req.method === 'POST') {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const name = asString(body.name, 80);
    const baseUrl = asString(body.base_url ?? body.baseUrl, 300);
    const model = asString(body.model, 120);
    const encryptedKey = asString(body.encrypted_key ?? body.encryptedKey, 6000);

    if (!name || !baseUrl || !model || !encryptedKey) {
      return res.status(400).json({
        error: 'invalid_input',
        message: 'name, base_url, model, and encrypted_key are required.',
      });
    }
    if (!/^https:\/\//i.test(baseUrl)) {
      return res.status(400).json({ error: 'invalid_input', message: 'base_url must start with https://' });
    }
    try {
      const meta = await saveCustomModel(uid, { name, baseUrl, model, encryptedKey });
      return res.status(200).json({ model: meta });
    } catch (err) {
      console.error('save custom model failed:', err);
      return res.status(500).json({ error: 'server_error', message: 'Could not save custom model.' });
    }
  }

  // Delete
  if (req.method === 'DELETE') {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const id = asString(body.id, 120);
    if (!id) {
      return res.status(400).json({ error: 'invalid_input', message: 'id is required.' });
    }
    try {
      await deleteCustomModel(uid, id);
      return res.status(200).json({ ok: true });
    } catch (err) {
      console.error('delete custom model failed:', err);
      return res.status(500).json({ error: 'server_error', message: 'Could not delete custom model.' });
    }
  }

  return res.status(405).json({ error: 'method_not_allowed', message: 'Method not allowed' });
}
