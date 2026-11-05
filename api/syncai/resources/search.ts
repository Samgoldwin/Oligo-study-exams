import type { VercelRequest, VercelResponse } from '@vercel/node';
import { checkRateLimit } from '../../_lib/ratelimit';
import { requirePost, getClientIp, sendError, asString, asNumber } from '../../_lib/http';
import { searchResources } from '../../_lib/resources';
import { searchOffline, hydrateHits } from '../../_lib/localIndex';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!requirePost(req, res)) return;

  const rl = checkRateLimit(`resources:${getClientIp(req)}`, 60, 60_000);
  if (!rl.allowed) {
    res.setHeader('Retry-After', String(rl.retryAfterSeconds));
    return sendError(res, 429, 'rate_limited', 'Too many searches. Please wait a minute and try again.');
  }

  const body = (req.body ?? {}) as Record<string, unknown>;
  const query = asString(body.query, 500);
  if (!query) return sendError(res, 400, 'invalid_input', 'A search query is required.');

  const semester = asNumber(body.semester);
  const limit = asNumber(body.limit);

  try {
    let resources = searchResources({
      query,
      branch: asString(body.branch, 32),
      semester: semester !== null && semester >= 1 && semester <= 8 ? Math.round(semester) : null,
      scheme: asString(body.scheme, 16),
      subjectCode: asString(body.subject_code ?? body.subjectCode, 32),
      module: asString(body.module, 8),
      limit: limit ?? 8,
      minScore: 2,
    });

    // Offline MiniSearch index as the FIRST fallback (no network, no AI).
    if (resources.length === 0) {
      const hits = searchOffline(query, limit ?? 8);
      if (hits.length) resources = hydrateHits(hits);
    }

    // On total miss, retry without the scheme/branch constraints so students
    // still see something relevant rather than an empty page.
    let relaxed = false;
    let finalResults = resources;
    if (finalResults.length === 0) {
      relaxed = true;
      finalResults = searchResources({
        query,
        subjectCode: asString(body.subject_code ?? body.subjectCode, 32),
        limit: limit ?? 8,
        minScore: 2,
      });
    }

    return res.status(200).json({
      resources: finalResults,
      count: finalResults.length,
      relaxed_context: relaxed,
      source: 'VTUSync',
    });
  } catch (err) {
    console.error('Resource search failed:', err);
    return sendError(res, 500, 'search_failed', 'Resource search failed. Please try again.');
  }
}
