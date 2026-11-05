import type { VercelRequest, VercelResponse } from '@vercel/node';
import { checkRateLimit } from '../_lib/ratelimit';
import { requirePost, getClientIp, sendError, asString, asStringArray, asNumber } from '../_lib/http';
import { searchResources, RESOURCE_TYPE_LABELS } from '../_lib/resources';
import { searchYouTubeVideos } from '../_lib/youtube';
import { runChatCompletion, AiUnavailableError } from '../_lib/groq';
import {
  buildSystemPrompt,
  buildConversationalPrompt,
  buildResourceBlock,
  buildDocumentBlock,
  rankDocumentPages,
} from '../_lib/prompt';
import type {
  AcademicContext,
  AnswerMarks,
  ChatHistoryMessage,
  Grounding,
  ResourceItem,
} from '../../types';

const MARKS_VALUES: AnswerMarks[] = [2, 5, 10, 15];
const MAX_HISTORY = 12;
const MAX_HISTORY_CHARS = 1500;

// A message is "conversational" when it is not an academic question —
// greetings (done), thanks, short ack (kk, hmm, got it), small talk, or
// anything that is just a phrase with no academic intent. Only conversational
// messages skip retrieval, YouTube, and the general-explanation framing.
const CONVERSATIONAL = /^(hi|hello|hey|hii+|helloo|what's up|sup|namaste|good (morning|afternoon|evening|night)|thank you|thanks|thx|kk|ok|okay|sure|cool|great|hmm|hmm+|got it|understood|yes|no|yeah|yep|bye|goodbye|see you|take care|can you help|what are you|who are you|how are you|can you hear me|are you there|hello bot|hi bot)[\s!?.,…]*$/i;
const isConversationalMessage = (text: string): boolean =>
  CONVERSATIONAL.test(text.trim()) || text.trim().split(/\s+/).length <= 2;

function parseMarks(raw: unknown): AnswerMarks | null {
  const n = asNumber(raw);
  if (n === null) return null;
  const rounded = Math.round(n) as AnswerMarks;
  return MARKS_VALUES.includes(rounded) ? rounded : null;
}

function parseContext(raw: unknown): AcademicContext | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const semester = asNumber(obj.semester);
  return {
    branch: asString(obj.branch, 32) || '',
    semester: semester !== null && semester >= 1 && semester <= 8 ? Math.round(semester) : null,
    scheme: asString(obj.scheme, 16) || '',
    subject: asString(obj.subject, 120) || '',
    subjectCode: asString(obj.subjectCode, 32) || '',
  };
}

function parseHistory(raw: unknown): ChatHistoryMessage[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (m): m is ChatHistoryMessage =>
        !!m &&
        typeof m === 'object' &&
        ((m as ChatHistoryMessage).role === 'user' || (m as ChatHistoryMessage).role === 'assistant') &&
        typeof (m as ChatHistoryMessage).content === 'string'
    )
    .slice(-MAX_HISTORY)
    .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_HISTORY_CHARS) }));
}

function parseDocument(raw: unknown): { filename: string; pages: string[] } | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const filename = asString(obj.filename, 200) || 'Uploaded document';
  const pages = asStringArray(obj.pages, 120, 4000);
  if (!pages || pages.length === 0) return null;
  // Cap total payload — keep the prompt within budget.
  let total = 0;
  const kept: string[] = [];
  for (const page of pages) {
    if (total >= 20000) break;
    kept.push(page);
    total += page.length;
  }
  return { filename, pages: kept };
}

const EXTERNAL_INTENT = /(youtube|video|lecture|watch|channel)/i;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!requirePost(req, res)) return;

  const rl = checkRateLimit(`chat:${getClientIp(req)}`, 20, 60_000);
  if (!rl.allowed) {
    res.setHeader('Retry-After', String(rl.retryAfterSeconds));
    return sendError(res, 429, 'rate_limited', 'Too many questions. Please wait a minute and try again.');
  }

  const body = (req.body ?? {}) as Record<string, unknown>;
  const message = asString(body.message, 4000);
  if (!message) return sendError(res, 400, 'invalid_input', 'A question is required.');

  const conversationId = asString(body.conversation_id, 80) || `conv-${Date.now().toString(36)}`;
  const context = parseContext(body.context);
  const marks = parseMarks(body.marks);
  const history = parseHistory(body.history);
  const document = parseDocument(body.document);
  const model = asString(body.model, 60) ?? undefined;
  const conversational = isConversationalMessage(message);

  /* ---------- Step 1: VTUSync retrieval (mandatory, retrieval-first) ----------
   * Conversational messages (hi, thanks, etc.) skip retrieval entirely —
   * they need no grounding and must not trigger resource cards. */
  let resources: ResourceItem[] = [];
  let retrievalFailed = false;
  if (!conversational) {
    try {
      resources = searchResources({
        query: message,
        branch: context?.branch,
        semester: context?.semester,
        scheme: context?.scheme,
        subjectCode: context?.subjectCode,
        limit: 8,
        minScore: 2,
      });
    } catch (err) {
      console.error('SyncAI resource retrieval failed:', err);
      retrievalFailed = true;
      resources = [];
    }
  }

  // PYQ-looking intent: keep papers in a separate section downstream.
  const pyqResources = resources.filter((r) => r.type === 'pyq');
  const nonPyqResources = resources.filter((r) => r.type !== 'pyq');

  /* ---------- Step 2: YouTube — only if needed/requested ----------
   * Also skipped for conversational messages. */
  const wantsVideos = !conversational && EXTERNAL_INTENT.test(message);
  const vtuInsufficient = !conversational && resources.length < 2;
  let videos: Awaited<ReturnType<typeof searchYouTubeVideos>>['videos'] = [];
  let videoError: string | null = null;

  if (!conversational && (wantsVideos || vtuInsufficient)) {
    const yt = await searchYouTubeVideos({
      query: message,
      subject: context?.subject || context?.subjectCode || null,
      language: 'en',
      maxResults: 5,
      vtuHint: context?.subjectCode ? `VTU ${context.subjectCode}` : 'VTU',
    });
    videos = yt.videos;
    videoError = yt.error ? yt.message : null;
  }

  /* ---------- Step 3: Assemble grounded prompt ---------- */
  const rankedPages = document ? rankDocumentPages(document.pages, message) : [];

  const system = conversational
    ? buildConversationalPrompt({ context })
    : buildSystemPrompt({
        context,
        marks,
        hasDocument: rankedPages.length > 0,
        hasResources: resources.length > 0,
      });

  const resourceBlock = buildResourceBlock(
    resources.map((r, i) => ({
      label: `R${i + 1}`,
      title: r.title,
      type: RESOURCE_TYPE_LABELS[r.type] || r.type,
      subject: r.subject,
      subjectCode: r.subjectCode,
      module: r.module,
      scheme: r.scheme,
    }))
  );

  const blocks: string[] = [];
  if (resourceBlock) blocks.push(resourceBlock);
  if (document && rankedPages.length > 0) {
    blocks.push(`Uploaded PDF "${document.filename}" (relevant pages, page-tagged):\n${buildDocumentBlock(rankedPages)}`);
  } else if (document) {
    blocks.push(`An uploaded PDF "${document.filename}" was provided, but none of its pages matched this question. Tell the student the content is not in the document.`);
  }
  blocks.push(`Student question: ${message}`);

  const messages = [
    { role: 'system' as const, content: system },
    ...history.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    { role: 'user' as const, content: blocks.join('\n\n') },
  ];

  /* ---------- Step 4: LLM ---------- */
  let answer: string;
  try {
    answer = await runChatCompletion({
      messages,
      maxTokens: marks === 15 ? 2600 : marks === 10 ? 2200 : marks ? 1300 : 1600,
      temperature: marks ? 0.25 : 0.35,
      model,
    });
  } catch (err) {
    if (err instanceof AiUnavailableError) {
      console.error('SyncAI AI unavailable:', err.message);
      // Resources were already retrieved — hand them over even when the LLM fails.
      return res.status(503).json({
        error: 'ai_unavailable',
        message: 'The AI explanation is unavailable right now — but the VTUSync resources found for your question are listed below.',
        related_resources: nonPyqResources,
        pyq_resources: pyqResources,
      });
    }
    console.error('SyncAI AI error:', err);
    return sendError(res, 502, 'ai_error', 'The AI service failed to generate a response. Please try again.');
  }

  /* ---------- Step 5: Shape response ---------- */
  const sources = [
    ...resources.slice(0, 6).map((r, i) => ({
      label: `R${i + 1}`,
      title: r.title,
      type: 'vtunsync_resource' as const,
    })),
    ...rankedPages.map((p) => ({
      label: `Page ${p.page}`,
      title: document?.filename || 'Uploaded PDF',
      type: 'document' as const,
      page: p.page,
    })),
  ];

  // Conversational "general" framing — required on academic answers only.
  // For conversational messages, omit grounded entirely: the footer must not
  // claim "general AI explanation" for a greeting — that's the bug the user
  // reported ("not required for normal conversation").
  const grounded: Grounding | null = conversational ? null
    : document && rankedPages.length > 0
      ? 'document'
      : resources.length > 0
        ? 'vtunsync'
        : 'general';

  return res.status(200).json({
    answer,
    conversation_id: conversationId,
    sources,
    related_resources: nonPyqResources,
    pyq_resources: pyqResources,
    videos,
    video_error: videoError,
    grounded,
    retrieval_status: retrievalFailed ? 'failed' : 'ok',
    ai_generated: true,
  });
}
