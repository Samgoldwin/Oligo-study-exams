import type { VercelRequest, VercelResponse } from '@vercel/node';
import { checkRateLimit } from '../_lib/ratelimit';
import { requirePost, getClientIp, sendError, asString } from '../_lib/http';
import { runChatCompletion, AiUnavailableError } from '../_lib/groq';

const SYSTEM = `You extract academic metadata from a VTU (Visvesvaraya Technological University) syllabus excerpt.
Return strict JSON with this exact shape and nothing else:
{"subject": string|null, "subjectCode": string|null, "semester": number|null, "branch": string|null, "scheme": string|null}

Rules:
- subject: the subject/course title as it appears, e.g. "Operating Systems". null if not identifiable.
- subjectCode: VTU subject code if visible, e.g. "BCS503", "22CSH07", "18CS65". null otherwise.
- semester: integer 1-8 if present or clearly inferable. null otherwise.
- branch: one of "CSE", "ISE", "AIML", "ECE", "EEE", "ME", "CE" if identifiable. null otherwise.
- scheme: "2022", "2021", or "2018" if identifiable. null otherwise.
- Never guess beyond what the text supports — use null when unsure.
- JSON only, no markdown, no commentary.`;

export interface SyllabusDetection {
  subject: string | null;
  subjectCode: string | null;
  semester: number | null;
  branch: string | null;
  scheme: string | null;
}

const BRANCHES = new Set(['CSE', 'ISE', 'AIML', 'ECE', 'EEE', 'ME', 'CE']);
const SCHEMES = new Set(['2022', '2021', '2018']);

function sanitize(raw: unknown): SyllabusDetection {
  const obj = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;

  const str = (v: unknown, max = 120): string | null =>
    typeof v === 'string' && v.trim().length > 0 ? v.trim().slice(0, max) : null;

  const semesterRaw = typeof obj.semester === 'number' ? obj.semester : Number(obj.semester);
  const semester =
    Number.isFinite(semesterRaw) && semesterRaw >= 1 && semesterRaw <= 8 ? Math.round(semesterRaw) : null;

  const branch = str(obj.branch, 8)?.toUpperCase() ?? null;
  const scheme = str(obj.scheme, 8) ?? null;

  return {
    subject: str(obj.subject, 120),
    subjectCode: str(obj.subjectCode, 32),
    semester,
    branch: branch && BRANCHES.has(branch) ? branch : null,
    scheme: scheme && SCHEMES.has(scheme) ? scheme : null,
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!requirePost(req, res)) return;

  const rl = checkRateLimit(`detect:${getClientIp(req)}`, 10, 60_000);
  if (!rl.allowed) {
    res.setHeader('Retry-After', String(rl.retryAfterSeconds));
    return sendError(res, 429, 'rate_limited', 'Too many detection requests. Please wait a minute.');
  }

  const body = (req.body ?? {}) as Record<string, unknown>;
  const text = asString(body.text, 8000);
  if (!text || text.length < 40) {
    return sendError(res, 400, 'invalid_input', 'Provide at least a short excerpt of the syllabus text.');
  }

  try {
    const raw = await runChatCompletion({
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: `Syllabus excerpt:\n"""\n${text}\n"""` },
      ],
      maxTokens: 600,
      temperature: 0,
    });

    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) {
      return res.status(502).json({ error: 'ai_error', message: 'Could not parse the detection result. Please try again.' });
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(match[0]);
    } catch {
      return res.status(502).json({ error: 'ai_error', message: 'Could not parse the detection result. Please try again.' });
    }

    return res.status(200).json({ detection: sanitize(parsed), ai_generated: true });
  } catch (err) {
    if (err instanceof AiUnavailableError) {
      // Chat may still work — auto-detect is just temporarily unable to run.
      return sendError(res, 503, 'ai_unavailable', 'Auto-detect is unavailable right now. You can still type or paste the syllabus details manually.');
    }
    console.error('Syllabus detection failed:', err);
    return sendError(res, 502, 'ai_error', 'Syllabus detection failed. Please try again.');
  }
}
