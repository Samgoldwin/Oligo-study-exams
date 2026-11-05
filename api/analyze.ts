import { Groq } from 'groq-sdk';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

const MAX_PER_FILE_CHARS = 12000;
const MAX_TOTAL_CHARS = 30000;

/**
 * Best-effort JSON extraction from a model response:
 *  1. Strips markdown code fences.
 *  2. Finds the first '{' or '[' and scans for its balanced closing token
 *     (handles nested objects/arrays and braces inside strings), then JSON.parse.
 *  3. Falls back to greedy regex slices for both roots.
 * Returns the parsed value, or null when nothing parses.
 */
function extractJson(raw: string): unknown {
  let text = raw.trim();

  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) text = fence[1].trim();

  const tryBalanced = (open: string, close: string): unknown => {
    const start = text.indexOf(open);
    if (start === -1) return undefined;
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let i = start; i < text.length; i += 1) {
      const ch = text[i];
      if (inString) {
        if (escaped) escaped = false;
        else if (ch === '\\') escaped = true;
        else if (ch === '"') inString = false;
        continue;
      }
      if (ch === '"') inString = true;
      else if (ch === open) depth += 1;
      else if (ch === close) {
        depth -= 1;
        if (depth === 0) {
          try {
            return JSON.parse(text.slice(start, i + 1));
          } catch {
            return undefined; // corrupted candidate — fall through to greedy
          }
        }
      }
    }
    return undefined;
  };

  const objectAttempt = tryBalanced('{', '}');
  if (objectAttempt !== undefined) return objectAttempt;

  const arrayAttempt = tryBalanced('[', ']');
  if (arrayAttempt !== undefined) return arrayAttempt;

  const greedyObject = text.match(/\{[\s\S]*\}/);
  if (greedyObject) {
    try {
      return JSON.parse(greedyObject[0]);
    } catch {
      /* fall through */
    }
  }
  const greedyArray = text.match(/\[[\s\S]*\]/);
  if (greedyArray) {
    try {
      return JSON.parse(greedyArray[0]);
    } catch {
      /* fall through */
    }
  }
  return null;
}

const STRICT_SUFFIX =
  '\n\nIMPORTANT: Respond with ONLY a single valid JSON object. ' +
  'No explanatory text, no markdown, no code fences, no trailing content after the closing brace. ' +
  'Fill every field with real content derived from the provided syllabus and papers — never return empty arrays or empty strings.';

/** A "parsed" object is usable only if it carries any real content. */
function isEmptyPlan(parsed: unknown): boolean {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return true;
  const o = parsed as Record<string, unknown>;
  const hasSubject = typeof o.subject === 'string' && o.subject.trim().length > 0;
  const hasArrays =
    (Array.isArray(o.modules) && o.modules.length > 0) ||
    (Array.isArray(o.extractedQuestions) && o.extractedQuestions.length > 0) ||
    (Array.isArray(o.keyTopics) && o.keyTopics.length > 0) ||
    (Array.isArray(o.studySchedule) && o.studySchedule.length > 0);
  return !hasSubject && !hasArrays;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'method_not_allowed', message: 'Method not allowed' });
  }

  try {
    const { syllabus, files } = req.body ?? {};

    if (typeof syllabus !== 'string' || syllabus.trim().length === 0) {
      return res.status(400).json({ error: 'invalid_input', message: 'A syllabus is required.' });
    }
    if (!Array.isArray(files) || files.length === 0) {
      return res.status(400).json({ error: 'invalid_input', message: 'At least one document is required.' });
    }

    // Client extracts text in the browser; accept only extracted text now.
    let budget = MAX_TOTAL_CHARS;
    const fileContents = files
      .map((f: any) => {
        const name = typeof f?.name === 'string' ? f.name.slice(0, 200) : 'document.pdf';
        const text = typeof f?.text === 'string' ? f.text : '';
        const clipped = text.slice(0, Math.min(MAX_PER_FILE_CHARS, budget));
        budget -= clipped.length;
        return `[File: ${name}]\n${clipped}`;
      })
      .join('\n\n');

    if (budget === MAX_TOTAL_CHARS) {
      return res.status(400).json({ error: 'invalid_input', message: 'The uploaded files contained no readable text.' });
    }

    const prompt = `You are an expert educational advisor helping a VTU student quickly revise for an upcoming exam. The student has DAYS, not months — plan a focused exam sprint, not a semester course.

SYLLABUS:
${syllabus.slice(0, 4500)}

QUESTION PAPERS:
${fileContents}

Respond with JSON only, with these fields:
1. keyTopics: array of important topics from syllabus
2. questionsByTopic: object mapping topics to extracted questions
3. studySchedule: array of SHORT day-based sprint entries, max 6 entries: { day (number), focus (string), activities (array of strings, 2-4 items), estimatedHours (number, 2-5 per day) }. Start with the highest-yield topic on day 1. No multi-week plans.
4. focusAreas: array of areas needing extra attention
5. estimatedHours: TOTAL focused study hours (realistic for an exam sprint, e.g. 8-30). Keep it small.
6. subject: short subject name
7. summary: 2-3 sentence summary
8. modules: array of objects with { topicName, priority ("High"|"Medium"|"Low"), description, questions: array of { text, marks, yearAppeared, difficulty ("Easy"|"Medium"|"Hard"), reference } }
9. extractedQuestions: array of { text, marks, yearAppeared, difficulty, reference }
10. priorityOrder: array of up to 8 topics ordered by what to complete first (most likely to be tested first) — e.g. ["Banker's algorithm", "Process scheduling", ...].

Keep estimatedHours modest, and order studySchedule so day 1 is the most important topic. Format as valid JSON only. No markdown fences.`;

    const DEFAULT_MODEL = process.env.SYNCAI_MODEL || 'openai/gpt-oss-120b';
    const FALLBACK_MODEL = 'qwen/qwen3.8-27b';

    const complete = async (model: string, messages: Array<{ role: 'user' | 'system'; content: string }>, maxTokens: number) => {
      const message = await groq.chat.completions.create({
        model,
        max_tokens: maxTokens,
        temperature: 0.2,
        messages,
      });
      return message.choices[0]?.message?.content || '';
    };

    let raw = await complete(DEFAULT_MODEL, [{ role: 'user', content: prompt }], 4096);
    let studyPlan = extractJson(raw);
    if (isEmptyPlan(studyPlan)) studyPlan = null;

    // Retry ladder: stricter instruction on the same model, then a second model
    // known for clean JSON output, before giving up.
    if (studyPlan === null) {
      console.warn('Analyze: first response unusable (default model). sample:', raw.slice(0, 200));
      raw = await complete(DEFAULT_MODEL, [{ role: 'user', content: prompt + STRICT_SUFFIX }], 7000);
      studyPlan = extractJson(raw);
      if (isEmptyPlan(studyPlan)) studyPlan = null;
    }
    if (studyPlan === null) {
      console.warn('Analyze: strict retry unusable; trying fallback model. sample:', raw.slice(0, 160));
      raw = await complete(FALLBACK_MODEL, [{ role: 'user', content: prompt + STRICT_SUFFIX }], 7000);
      studyPlan = extractJson(raw);
      if (isEmptyPlan(studyPlan)) studyPlan = null;
    }

    if (studyPlan === null) {
      console.error('Analyze: no usable plan after retries. sample:', raw.slice(0, 300));
      return res.status(422).json({
        error: 'empty_result',
        message: 'Could not generate a usable plan from the uploaded documents. Try pasting a fuller syllabus or clearer question papers.',
      });
    }

    return res.status(200).json(studyPlan);
  } catch (error: any) {
    const rawMessage = String(error?.message ?? "");
    const status = error?.status ?? error?.response?.status ?? 500;

    console.error("Analyze error:", { status, rawMessage });

    // Groq / provider rate limits & quota exhaustion.
    if (status === 429 || /rate[_ -]?limit|quota|429/i.test(rawMessage)) {
      return res.status(429).json({
        error: "rate_limited",
        message: "The AI service is busy right now (quota/rate limit). Please wait about a minute and try again.",
      });
    }

    // Timeouts / dropped connections.
    if (status === 504 || /timeout|ETIMEDOUT|ECONNRESET|socket hang up/i.test(rawMessage)) {
      return res.status(504).json({
        error: "timeout",
        message: "Analysis is taking too long — please try again, or reduce the number/size of uploaded papers.",
      });
    }

    return res.status(500).json({
      error: "analysis_failed",
      message: "Failed to analyze documents. Please try again.",
    });
  }
}
