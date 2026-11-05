import type { VercelRequest, VercelResponse } from '@vercel/node';
import { checkRateLimit } from '../_lib/ratelimit';
import { requirePost, getClientIp, sendError, asString, asNumber } from '../_lib/http';
import { runChatCompletion, AiUnavailableError } from '../_lib/groq';
import { buildSystemPrompt } from '../_lib/prompt';
import type { AnswerMarks } from '../../types';

const MARKS_VALUES: AnswerMarks[] = [2, 5, 10, 15];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!requirePost(req, res)) return;

  const rl = checkRateLimit(`exam:${getClientIp(req)}`, 15, 60_000);
  if (!rl.allowed) {
    res.setHeader('Retry-After', String(rl.retryAfterSeconds));
    return sendError(res, 429, 'rate_limited', 'Too many answers generated. Please wait a minute and try again.');
  }

  const body = (req.body ?? {}) as Record<string, unknown>;
  const question = asString(body.question, 1000);
  if (!question) return sendError(res, 400, 'invalid_input', 'A question is required.');

  const marksRaw = asNumber(body.marks);
  const marks: AnswerMarks = MARKS_VALUES.includes(Math.round(marksRaw ?? 10) as AnswerMarks)
    ? (Math.round(marksRaw ?? 10) as AnswerMarks)
    : 10;

  const subject = asString(body.subject, 120) || '';
  const subjectCode = asString(body.subject_code ?? body.subjectCode, 32) || '';
  const scheme = asString(body.scheme, 16) || '';

  const system = buildSystemPrompt({
    context: { branch: '', semester: null, scheme, subject, subjectCode },
    marks,
    hasDocument: false,
    hasResources: false,
  });

  try {
    const answer = await runChatCompletion({
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: `Write a ${marks}-mark VTU exam answer for: ${question}` },
      ],
      maxTokens: marks === 15 ? 2600 : marks === 10 ? 2200 : 1200,
      temperature: 0.25,
    });

    return res.status(200).json({
      answer,
      marks,
      question,
      ai_generated: true,
      disclaimer: 'AI-generated answer. Not officially VTU-approved. Verify against your syllabus and scheme of evaluation.',
    });
  } catch (err) {
    if (err instanceof AiUnavailableError) {
      return sendError(res, 503, 'ai_unavailable', 'The AI service is temporarily unavailable or not configured. Please try again later.');
    }
    console.error('Exam answer generation failed:', err);
    return sendError(res, 502, 'ai_error', 'The AI service failed to generate the answer. Please try again.');
  }
}
