import type { VercelRequest, VercelResponse } from '@vercel/node';
import { AVAILABLE_MODELS, getGroqClient, SYNCAI_MODEL } from '../_lib/groq';

/**
 * Returns the curated list of chat models the picker may offer, filtered
 * against the live Groq catalog so models that are not actually accessible
 * for the configured key never reach the UI.
 *
 * GET or POST are both accepted (the picker uses GET; the dev harness also
 * supports POST for debugging).
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'method_not_allowed', message: 'Method not allowed' });
  }

  let accessible = new Set<string>(AVAILABLE_MODELS.map((m) => m.id));
  const groq = getGroqClient();

  if (groq) {
    try {
      const list = await groq.models.list();
      accessible = new Set(
        (list.data ?? []).map((m) => m.id).filter((id: string) => AVAILABLE_MODELS.some((a) => a.id === id))
      );
    } catch {
      // Fall through to the curated list — or, on failure, at least the default.
      accessible = new Set([SYNCAI_MODEL]);
    }
  }

  const models = AVAILABLE_MODELS.filter((m) => accessible.has(m.id)).map((m) => ({
    id: m.id,
    label: m.label,
    current: m.id === SYNCAI_MODEL,
  }));

  // Ensure the default is always present even if the catalog call filtered it out.
  if (models.length === 0) {
    return res.status(200).json({
      models: [{ id: SYNCAI_MODEL, label: SYNCAI_MODEL, current: true }],
      defaultModel: SYNCAI_MODEL,
    });
  }

  return res.status(200).json({
    models,
    defaultModel: SYNCAI_MODEL,
  });
}

