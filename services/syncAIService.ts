/**
 * SyncAI API client — browser side.
 * All calls go to our own serverless endpoints; keys never touch the client.
 */

import type {
  AcademicContext,
  AnswerMarks,
  ChatRequest,
  ChatResponse,
  DocumentContext,
  ResourceItem,
  SyllabusDetection,
  YouTubeVideo,
} from '../types';

const REQUEST_TIMEOUT_MS = 60_000;

export class SyncAIApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    /** Full response body, when present — e.g. resources surviving an AI outage. */
    public payload?: Record<string, unknown> | null
  ) {
    super(message);
    this.name = 'SyncAIApiError';
  }
}

async function postJson<TResponse>(path: string, body: unknown): Promise<TResponse> {
  let response: Response;
  try {
    response = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (err) {
    const msg = err instanceof Error && err.name === 'TimeoutError'
      ? 'The request timed out. Please try again.'
      : 'Network error. Check your connection and try again.';
    throw new SyncAIApiError(0, 'network_error', msg);
  }

  let payload: any = null;
  try {
    payload = await response.json();
  } catch {
    /* non-JSON body */
  }

  if (!response.ok) {
    throw new SyncAIApiError(
      response.status,
      payload?.error || 'request_failed',
      payload?.message || `Request failed (HTTP ${response.status}).`,
      payload
    );
  }
  return payload as TResponse;
}

export const syncAI = {
  chat(request: ChatRequest): Promise<ChatResponse> {
    return postJson<ChatResponse>('/api/syncai/chat', request);
  },

  searchResources(params: {
    query: string;
    context?: AcademicContext;
    module?: string;
    limit?: number;
  }): Promise<{ resources: ResourceItem[]; count: number; relaxed_context: boolean }> {
    return postJson('/api/syncai/resources/search', {
      query: params.query,
      branch: params.context?.branch,
      semester: params.context?.semester,
      scheme: params.context?.scheme,
      subject_code: params.context?.subjectCode,
      module: params.module,
      limit: params.limit ?? 8,
    });
  },

  searchYouTube(params: {
    query: string;
    subject?: string;
    subjectCode?: string;
    language?: string;
    maxResults?: number;
  }): Promise<{
    videos: YouTubeVideo[];
    cached: boolean;
    error: string | null;
    message: string | null;
  }> {
    return postJson('/api/syncai/youtube/search', {
      query: params.query,
      subject: params.subject,
      subject_code: params.subjectCode,
      language: params.language || 'en',
      max_results: params.maxResults ?? 5,
      vtu_hint: params.subjectCode ? `VTU ${params.subjectCode}` : 'VTU',
    });
  },

  askDocument(params: {
    question: string;
    document: DocumentContext;
  }): Promise<{
    answer: string;
    filename: string;
    page_references: number[];
    pages_used: number[];
    ai_generated: true;
  }> {
    return postJson('/api/syncai/documents/ask', {
      question: params.question,
      filename: params.document.filename,
      pages: params.document.pages,
    });
  },

  generateExamAnswer(params: {
    question: string;
    marks: AnswerMarks;
    context?: AcademicContext;
  }): Promise<{
    answer: string;
    marks: AnswerMarks;
    question: string;
    ai_generated: true;
    disclaimer: string;
  }> {
    return postJson('/api/syncai/exam-answer', {
      question: params.question,
      marks: params.marks,
      subject: params.context?.subject,
      subject_code: params.context?.subjectCode,
      scheme: params.context?.scheme,
    });
  },

  detectSyllabus(text: string): Promise<{ detection: SyllabusDetection; ai_generated: true }> {
    return postJson('/api/syncai/detect-syllabus', {
      text: text.slice(0, 8000),
    });
  },
};
