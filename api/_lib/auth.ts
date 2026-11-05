/**
 * Firebase Auth verification for API requests.
 *
 * Requires FIREBASE_SERVICE_ACCOUNT (JSON of the service account). When it is
 * not configured, the app runs in "guest" mode: all endpoints still work but
 * per-user data (custom models) is unavailable.
 */

import { initializeApp, getApps, cert, type App } from 'firebase-admin';
import { getAuth } from 'firebase-admin/auth';
import type { VercelRequest } from '@vercel/node';

let app: App | null = null;
let attempted = false;

function getApp(): App | null {
  if (attempted) return app;
  attempted = true;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) return null;
  try {
    const sa = JSON.parse(raw) as Record<string, string>;
    const existing = getApps()[0];
    app = existing ?? initializeApp({ credential: cert(sa as any) });
  } catch {
    app = null;
  }
  return app;
}

export interface AuthedRequest {
  uid: string | null;
}

/** Resolve the Firebase UID from the Bearer token (null = guest). */
export async function resolveAuth(req: VercelRequest): Promise<AuthedRequest> {
  const activeApp = getApp();
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!activeApp || !token) return { uid: null };

  try {
    const decoded = await getAuth(activeApp).verifyIdToken(token);
    return { uid: decoded.uid ?? null };
  } catch {
    return { uid: null };
  }
}
