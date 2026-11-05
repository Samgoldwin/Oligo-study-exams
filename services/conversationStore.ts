/**
 * Conversation persistence for SyncAI.
 * Stored in localStorage (MVP — VTUSync accounts/sync come later).
 * All access is defensive: corrupted data is dropped, never thrown.
 */

import type { AcademicContext, ChatMessage, Conversation } from '../types';

const CONVERSATIONS_KEY = 'syncai.conversations.v1';
const CONTEXT_KEY = 'syncai.context.v1';
const MAX_CONVERSATIONS = 60;
const MAX_MESSAGES_PER_CONVERSATION = 200;

export const DEFAULT_CONTEXT: AcademicContext = {
  branch: 'CSE',
  semester: null,
  scheme: '2021',
  subject: '',
  subjectCode: '',
};

function safeParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function isValidMessage(m: unknown): m is ChatMessage {
  const msg = m as ChatMessage;
  return (
    !!msg &&
    typeof msg === 'object' &&
    (msg.role === 'user' || msg.role === 'assistant') &&
    typeof msg.content === 'string' &&
    typeof msg.id === 'string'
  );
}

function isValidConversation(c: unknown): c is Conversation {
  const conv = c as Conversation;
  return (
    !!conv &&
    typeof conv === 'object' &&
    typeof conv.id === 'string' &&
    typeof conv.title === 'string' &&
    Array.isArray(conv.messages) &&
    conv.messages.every(isValidMessage)
  );
}

export function loadContext(): AcademicContext {
  const parsed = safeParse<Partial<AcademicContext>>(localStorage.getItem(CONTEXT_KEY));
  if (!parsed) return { ...DEFAULT_CONTEXT };
  const semester = typeof parsed.semester === 'number' && parsed.semester >= 1 && parsed.semester <= 8
    ? parsed.semester
    : null;
  return {
    branch: typeof parsed.branch === 'string' ? parsed.branch : DEFAULT_CONTEXT.branch,
    semester,
    scheme: typeof parsed.scheme === 'string' ? parsed.scheme : DEFAULT_CONTEXT.scheme,
    subject: typeof parsed.subject === 'string' ? parsed.subject : '',
    subjectCode: typeof parsed.subjectCode === 'string' ? parsed.subjectCode : '',
  };
}

export function saveContext(context: AcademicContext): void {
  try {
    localStorage.setItem(CONTEXT_KEY, JSON.stringify(context));
  } catch {
    /* storage full — non-fatal */
  }
}

export function listConversations(): Conversation[] {
  const parsed = safeParse<Conversation[]>(localStorage.getItem(CONVERSATIONS_KEY));
  if (!Array.isArray(parsed)) return [];
  return parsed
    .filter(isValidConversation)
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

export function getConversation(id: string): Conversation | null {
  return listConversations().find((c) => c.id === id) ?? null;
}

export function saveConversation(conversation: Conversation): void {
  const trimmed: Conversation = {
    ...conversation,
    messages: conversation.messages.slice(-MAX_MESSAGES_PER_CONVERSATION),
  };
  const rest = listConversations().filter((c) => c.id !== trimmed.id);
  const next = [trimmed, ...rest]
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
    .slice(0, MAX_CONVERSATIONS);
  try {
    localStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(next));
  } catch {
    // Storage full: drop oldest conversations until it fits.
    let attempt = next;
    while (attempt.length > 1) {
      attempt = attempt.slice(0, attempt.length - 1);
      try {
        localStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(attempt));
        return;
      } catch {
        /* keep trimming */
      }
    }
  }
}

export function deleteConversation(id: string): void {
  const rest = listConversations().filter((c) => c.id !== id);
  try {
    localStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(rest));
  } catch {
    /* non-fatal */
  }
}

export function renameConversation(id: string, title: string): void {
  const trimmed = title.trim().slice(0, 80);
  if (!trimmed) return;
  const next = listConversations().map((c) =>
    c.id === id ? { ...c, title: trimmed, updatedAt: Date.now() } : c
  );
  try {
    localStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(next));
  } catch {
    /* non-fatal */
  }
}

export function clearAllConversations(): void {
  try {
    localStorage.removeItem(CONVERSATIONS_KEY);
  } catch {
    /* non-fatal */
  }
}

export function createConversation(context: AcademicContext, title = 'New conversation'): Conversation {
  const now = Date.now();
  return {
    id: `conv-${now.toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    title,
    createdAt: now,
    updatedAt: now,
    context,
    messages: [],
  };
}
