import type { VercelRequest, VercelResponse } from '@vercel/node';
import { checkRateLimit } from '../../_lib/ratelimit';
import { requirePost, getClientIp, sendError, asString, asNumber } from '../../_lib/http';
import { searchYouTubeVideos } from '../../_lib/youtube';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!requirePost(req, res)) return;

  const rl = checkRateLimit(`youtube:${getClientIp(req)}`, 30, 60_000);
  if (!rl.allowed) {
    res.setHeader('Retry-After', String(rl.retryAfterSeconds));
    return sendError(res, 429, 'rate_limited', 'Too many video searches. Please wait a minute and try again.');
  }

  const body = (req.body ?? {}) as Record<string, unknown>;
  const query = asString(body.query, 300);
  if (!query) return sendError(res, 400, 'invalid_input', 'A search query is required.');

  const language = asString(body.language, 10);
  const maxResults = asNumber(body.max_results);

  try {
    const result = await searchYouTubeVideos({
      query,
      subject: asString(body.subject, 120),
      language: language || 'en',
      maxResults: maxResults ?? 5,
      vtuHint: asString(body.vtu_hint, 40) || (asString(body.subject_code, 32) ? `VTU ${asString(body.subject_code, 32)}` : 'VTU'),
    });

    if (result.error) {
      // Graceful degradation — this is not a server error, it is a known state.
      return res.status(200).json({
        videos: [],
        cached: result.cached,
        error: result.error,
        message: result.message,
      });
    }

    return res.status(200).json({
      videos: result.videos,
      cached: result.cached,
      error: null,
      message: null,
    });
  } catch (err) {
    console.error('YouTube search failed:', err);
    return res.status(200).json({
      videos: [],
      cached: false,
      error: 'api_error',
      message: 'Unable to retrieve YouTube videos right now. You can still use the explanation and VTUSync resources.',
    });
  }
}
