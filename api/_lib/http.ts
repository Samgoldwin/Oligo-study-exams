import type { VercelRequest, VercelResponse } from '@vercel/node';

export function requirePost(req: VercelRequest, res: VercelResponse): boolean {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method_not_allowed', message: 'Method not allowed' });
    return false;
  }
  return true;
}

export function getClientIp(req: VercelRequest): string {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.length > 0) {
    return fwd.split(',')[0].trim();
  }
  const realIp = req.headers['x-real-ip'];
  if (typeof realIp === 'string') return realIp;
  return req.socket?.remoteAddress || 'unknown';
}

export function sendError(
  res: VercelResponse,
  status: number,
  error: string,
  message: string
): void {
  res.status(status).json({ error, message });
}

/** Coerce an unknown body field to a trimmed string, capped to maxLen. */
export function asString(value: unknown, maxLen = 4000): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  return trimmed.slice(0, maxLen);
}

export function asStringArray(value: unknown, maxItems: number, maxItemLen: number): string[] | null {
  if (!Array.isArray(value)) return null;
  return value
    .filter((v): v is string => typeof v === 'string')
    .slice(0, maxItems)
    .map((v) => v.slice(0, maxItemLen));
}

export function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Number(value))) {
    return Number(value);
  }
  return null;
}
