import type { VercelRequest, VercelResponse } from '@vercel/node';
import { checkRateLimit } from '../../_lib/ratelimit';
import { requirePost, getClientIp, sendError, asString, asStringArray } from '../../_lib/http';
import { runChatCompletion, AiUnavailableError } from '../../_lib/groq';
import { buildDocumentBlock, rankDocumentPages } from '../../_lib/prompt';

const SYSTEM = `You are SyncAI, answering a student's question strictly from the uploaded PDF whose pages are provided below.

RULES:
1. Answer only from the provided pages. If the answer is not present, reply exactly with what is missing and say you could not find it in this document.
2. Cite the page you used as [Page N]. Never invent page numbers.
3. Be concise and use simple language. Use markdown for structure.
4. This answer is AI-generated and not an official VTU document.`;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!requirePost(req, res)) return;

  const rl = checkRateLimit(`docask:${getClientIp(req)}`, 20, 60_000);
  if (!rl.allowed) {
    res.setHeader('Retry-After', String(rl.retryAfterSeconds));
    return sendError(res, 429, 'rate_limited', 'Too many document questions. Please wait a minute and try again.');
  }

  const body = (req.body ?? {}) as Record<string, unknown>;
  const question = asString(body.question, 2000);
  if (!question) return sendError(res, 400, 'invalid_input', 'A question is required.');

  const filename = asString(body.filename, 200) || 'Uploaded PDF';
  const pages = asStringArray(body.pages, 120, 4000);
  if (!pages || pages.length === 0 || pages.every((p) => p.trim().length === 0)) {
    return sendError(
      res,
      400,
      'invalid_document',
      'This PDF contains no extractable text. It may be a scanned image — OCR is not supported yet.'
    );
  }

  const ranked = rankDocumentPages(pages, question, { topPages: 6, maxTotalChars: 9000 });
  const totalText = pages.reduce((sum, p) => sum + p.trim().length, 0);

  const userContent = `PDF "${filename}" (relevant pages):\n${buildDocumentBlock(ranked)}\n\nStudent question: ${question}`;

  try {
    const answer = await runChatCompletion({
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: userContent },
      ],
      maxTokens: 1500,
      temperature: 0.2,
    });

    // Prefer explicit [Page N] citations in the answer; fall back to the pages that were injected.
    const cited = Array.from(answer.matchAll(/\[Page\s*(\d+)\]/gi)).map((m) => Number(m[1]));
    const validCited = Array.from(new Set(cited.filter((n) => n >= 1 && n <= pages.length))).sort((a, b) => a - b);
    const pageReferences = validCited.length > 0 ? validCited : ranked.map((r) => r.page).sort((a, b) => a - b);

    return res.status(200).json({
      answer,
      filename,
      page_references: pageReferences,
      pages_used: ranked.map((r) => r.page),
      extracted_characters: totalText,
      ai_generated: true,
    });
  } catch (err) {
    if (err instanceof AiUnavailableError) {
      return sendError(res, 503, 'ai_unavailable', 'The AI service is temporarily unavailable or not configured. Please try again later.');
    }
    console.error('Document QA failed:', err);
    return sendError(res, 502, 'ai_error', 'The AI service failed to answer from this document. Please try again.');
  }
}
