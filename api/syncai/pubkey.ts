import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getPublicKeyPem } from '../_lib/secrets';

/**
 * Public RSA key used to encrypt user-supplied model keys before upload.
 * GET or POST are both accepted.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'method_not_allowed', message: 'Method not allowed' });
  }
  return res.status(200).json({ publicKey: getPublicKeyPem() });
}
