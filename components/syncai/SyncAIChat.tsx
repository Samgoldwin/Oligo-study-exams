import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FileText, X, ChevronRight, Paperclip, Loader2 } from 'lucide-react';
import {
  AssistantRuntimeProvider,
  useExternalStoreRuntime,
  type AppendMessage,
  type ThreadMessageLike,
} from '@assistant-ui/react';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import { ModelPicker } from '@/components/ui/dropdown-menu';
import { Thread } from '@/components/assistant-ui/elements/thread.aui';
import type { AcademicContext, AnswerMarks, ChatMessage, Conversation, DocumentContext } from '../../types';
import { syncAI, SyncAIApiError } from '../../services/syncAIService';
import {
  listConversations,
  getConversation,
  saveConversation,
  deleteConversation,
  createConversation,
  loadContext,
  saveContext,
  renameConversation,
} from '../../services/conversationStore';
import type { PdfExtractionResult } from '../../services/pdfService';
import {
  listPyqHistory,
  savePyqPlan,
  removePyqHistory,
  type PyqHistoryItem,
} from '../../services/pyqStore';
import { SyncAISidebar } from './SyncAISidebar';
import { SyncAIAssistantMessage } from './SyncAIAssistantMessage';
import { SubjectCodePrompt } from './SubjectCodePrompt';
import { PyqAnalysis } from './PyqAnalysis';

const EMPTY_MESSAGES: ChatMessage[] = [];
const OPTIMISTIC_ID = 'aui-optimistic-running';

const SUGGESTIONS = [
  { title: 'Explain a topic', label: 'Deadlock in Operating Systems', prompt: 'Explain deadlock in Operating Systems with an example' },
  { title: 'Find notes', label: 'Normalization in DBMS', prompt: 'Find notes for normalization in DBMS' },
  { title: 'Generate an exam answer', label: '10 marks · TCP vs UDP', prompt: 'Write a 10-mark answer for TCP vs UDP' },
  { title: 'Find videos', label: 'Dynamic programming', prompt: 'Show me YouTube lectures on dynamic programming' },
];

// Marks are detected from the user's question text (e.g. "Write a 10-mark
// answer for X") — no composer selector needed; the chat endpoint applies
// the mark-aware rubric when the question asks for it.
const detectMarksFromText = (text: string): AnswerMarks | null => {
  const normalized = text.toLowerCase();
  // "10 marks", "10-mark", "10 mark" etc.
  const match = normalized.match(/\b(2|5|10|15)[ -]?marks?\b/);
  if (match) {
    const value = Number(match[1]) as AnswerMarks;
    if ([2, 5, 10, 15].includes(value)) return value;
  }
  return null;
};

function truncateTitle(text: string, max = 52): string {
  const single = text.replace(/\s+/g, ' ').trim();
  return single.length <= max ? single : `${single.slice(0, max - 1)}…`;
}

function makeId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function historyFrom(messages: ChatMessage[]): Array<{ role: 'user' | 'assistant'; content: string }> {
  return messages
    .slice(-10)
    .map((m) => ({ role: m.role, content: m.content }));
}

function docPayloadOf(conversation: Conversation | null, attachedDoc: PdfExtractionResult | null): DocumentContext | null {
  if (attachedDoc) return { filename: attachedDoc.filename, pages: attachedDoc.pages };
  if (conversation?.document) return conversation.document;
  return null;
}

export const SyncAIChat: React.FC = () => {
  const [context, setContext] = useState<AcademicContext>(() => loadContext());
  const [view, setView] = useState<"chat" | "pyq">("chat");
  const [conversations, setConversations] = useState<Conversation[]>(() => listConversations());
  const [pyqHistory, setPyqHistory] = useState<PyqHistoryItem[]>(() => listPyqHistory());
  const [activePyqId, setActivePyqId] = useState<string | null>(null);
  const [active, setActive] = useState<Conversation | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [attachedDoc, setAttachedDoc] = useState<PdfExtractionResult | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showSubjectPrompt, setShowSubjectPrompt] = useState<boolean>(
    () => !loadContext().subjectCode,
  );

  const fileInputRef = useRef<HTMLInputElement>(null);

  const messages = active?.messages ?? EMPTY_MESSAGES;

  useEffect(() => {
    saveContext(context);
  }, [context]);

  const persist = useCallback((conv: Conversation) => {
    saveConversation(conv);
    setConversations(listConversations());
    setActive(conv);
  }, []);

  const handleNewChat = useCallback(() => {
    setView('chat');
    setActive(createConversation(context));
    setAttachedDoc(null);
    setNotice(null);
    // Empty thread = first chat → show the subject-code prompt again if unset.
    setShowSubjectPrompt(!loadContext().subjectCode);
  }, [context]);

  const handleSelect = useCallback((id: string) => {
    setView('chat');
    const conv = getConversation(id);
    if (!conv) return;
    setActive(conv);
    // Empty thread = first chat → show the subject-code prompt again if unset.
    setShowSubjectPrompt(!loadContext().subjectCode);
    setAttachedDoc(
      conv.document
        ? {
            filename: conv.document.filename,
            pages: conv.document.pages,
            totalPages: conv.document.pages.length,
            truncated: false,
            extractedCharacters: conv.document.pages.join('').length,
            ocrApplied: false,
            ocrPages: [],
          }
        : null
    );
    setNotice(null);
  }, []);

  const handleDelete = useCallback((id: string) => {
    deleteConversation(id);
    setConversations(listConversations());
    setActive((current) => (current?.id === id ? null : current));
  }, []);

  const handleRename = useCallback((id: string, title: string) => {
    renameConversation(id, title);
    setConversations(listConversations());
    setActive((current) => (current?.id === id ? { ...current, title: title.trim().slice(0, 80) } : current));
  }, []);

  const handleAnalyzed = useCallback((plan: import('../../types').StudyPlan) => {
    const item = savePyqPlan(plan);
    setPyqHistory(listPyqHistory());
    setActivePyqId(item.id);
  }, []);

  const handleOpenPyq = useCallback((id: string) => {
    setActivePyqId(id);
    setView('pyq');
  }, []);

  const handleDeletePyq = useCallback((id: string) => {
    removePyqHistory(id);
    setPyqHistory(listPyqHistory());
    setActivePyqId((current) => (current === id ? null : current));
  }, []);

  const handleFilePick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setNotice(null);
    setIsExtracting(true);
    try {
      const { extractPdfText } = await import('../../services/pdfService');
      const result = await extractPdfText(file);
      setAttachedDoc(result);
      const notes: string[] = [];
      if (result.truncated) {
        notes.push(`"${result.filename}" was large — only the first ${result.pages.length} pages / ${Math.round(result.extractedCharacters / 1000)}k characters are used as context.`);
      }
      if (result.ocrApplied) {
        notes.push(`Scanned PDF — OCR applied to ${result.ocrPages.length} page${result.ocrPages.length === 1 ? '' : 's'} (${result.ocrPages.join(', ')}).`);
      }
      setNotice(notes.join(' '));
    } catch (err) {
      if (err instanceof Error && err.name === 'PdfExtractionError') {
        setNotice(err.message);
      } else {
        console.error('PDF extraction failed:', err);
        setNotice(`"${file.name}" could not be read. Please try another PDF.`);
      }
    } finally {
      setIsExtracting(false);
    }
  }, []);

  /** Shared by send + regenerate: conversation is already persisted up to the triggering user message. */
  const runGeneration = useCallback(
    async (conversation: Conversation, text: string, marksValue: AnswerMarks | null) => {
      setIsSending(true);
      setNotice(null);
      const docPayload = docPayloadOf(conversation, attachedDoc);
      const history = historyFrom(conversation.messages.slice(0, -1));

      try {
        const response = await syncAI.chat({
          message: text,
          conversation_id: conversation.id,
          history,
          context,
          marks: marksValue,
          document: docPayload,
          model: modelRef.current ?? undefined,
        });

        const assistantMessage: ChatMessage = {
          id: makeId('msg'),
          role: 'assistant',
          content: response.answer,
          createdAt: Date.now(),
          relatedResources: response.related_resources,
          pyqResources: response.pyq_resources,
          videos: response.videos,
          videoError: response.video_error,
          sources: response.sources,
          grounded: response.grounded,
        };
        persist({
          ...conversation,
          messages: [...conversation.messages, assistantMessage],
          updatedAt: Date.now(),
        });
      } catch (err) {
        console.error('SyncAI chat failed:', err);
        const apiPayload = err instanceof SyncAIApiError ? err.payload : null;
        const message2 =
          err instanceof SyncAIApiError
            ? err.message
            : 'Something went wrong while contacting SyncAI. Please try again.';
        const assistantMessage: ChatMessage = {
          id: makeId('msg'),
          role: 'assistant',
          content: '',
          createdAt: Date.now(),
          error: message2,
          relatedResources: Array.isArray(apiPayload?.related_resources)
            ? (apiPayload.related_resources as ChatMessage['relatedResources'])
            : undefined,
          pyqResources: Array.isArray(apiPayload?.pyq_resources)
            ? (apiPayload.pyq_resources as ChatMessage['pyqResources'])
            : undefined,
        };
        persist({
          ...conversation,
          messages: [...conversation.messages, assistantMessage],
          updatedAt: Date.now(),
        });
      } finally {
        setIsSending(false);
      }
    },
    [attachedDoc, context, persist]
  );

  const sendText = useCallback(
    async (rawText: string) => {
      const text = rawText.trim();
      if (!text || isSending) return;

      const selectedMarks = detectMarksFromText(text);

      const base = active ?? createConversation(context);
      const now = Date.now();
      const userMessage: ChatMessage = {
        id: makeId('msg'),
        role: 'user',
        content: text,
        createdAt: now,
        marks: selectedMarks,
      };
      const docPayload = docPayloadOf(base, attachedDoc);
      const withUser: Conversation = {
        ...base,
        title: base.messages.length === 0 ? truncateTitle(text) : base.title,
        messages: [...base.messages, userMessage],
        updatedAt: now,
        document: docPayload ?? base.document ?? null,
      };
      persist(withUser);
      await runGeneration(withUser, text, selectedMarks);
    },
    [active, attachedDoc, context, isSending, persist, runGeneration]
  );

  /** Regenerate: keep the triggering user message, drop trailing assistant output, re-run. */
  const handleReload = useCallback(
    async (parentId: string | null) => {
      if (isSending) return;
      const current = active;
      if (!current) return;
      const msgs = current.messages;

      let idx = parentId ? msgs.findIndex((m) => m.id === parentId) : -1;
      if (idx === -1 || msgs[idx].role !== 'user') {
        for (let i = msgs.length - 1; i >= 0; i -= 1) {
          if (msgs[i].role === 'user') {
            idx = i;
            break;
          }
        }
      }
      const userMsg = idx >= 0 ? msgs[idx] : undefined;
      if (!userMsg) return;

      const trimmed: Conversation = { ...current, messages: msgs.slice(0, idx + 1), updatedAt: Date.now() };
      persist(trimmed);
      await runGeneration(trimmed, userMsg.content, userMsg.marks ?? null);
    },
    [active, isSending, persist, runGeneration]
  );

  const convertMessage = useCallback((message: ChatMessage): ThreadMessageLike => {
    // The optimistic entry is render-only (never persisted) — it keeps its
    // empty body so the thread shows the running indicator while waiting.
    const running = message.id === OPTIMISTIC_ID;
    if (message.role === 'user') {
      return {
        role: 'user',
        content: [{ type: 'text', text: message.content }],
        id: message.id,
        createdAt: new Date(message.createdAt),
        metadata: { custom: { marks: message.marks ?? null } },
      };
    }
    return {
      role: 'assistant',
      content: [{ type: 'text', text: message.content || '' }],
      id: message.id,
      createdAt: new Date(message.createdAt),
      status: running
        ? { type: 'running' }
        : message.error
          ? { type: 'incomplete', reason: 'error', error: message.error }
          : { type: 'complete', reason: 'stop' },
      metadata: {
        custom: {
          relatedResources: message.relatedResources,
          pyqResources: message.pyqResources,
          videos: message.videos,
          videoError: message.videoError,
          sources: message.sources,
          grounded: message.grounded,
          error: message.error ?? null,
        },
      },
    };
  }, []);

  // My store is the source of truth — the external-store runtime converts.
  // The optimistic entry is render-only (never persisted) — it keeps the
  // thread showing the running indicator while the API call is in flight.
  const runtimeMessages = useMemo<ChatMessage[]>(() => {
    if (!isSending) return messages;
    return [
      ...messages,
      {
        id: OPTIMISTIC_ID,
        role: 'assistant',
        content: '',
        createdAt: Date.now(),
      },
    ];
  }, [messages, isSending]);

  const threadList = useMemo(
    () => ({
      threadId: active?.id,
      threads: conversations.map((c) => ({
        status: 'regular' as const,
        id: c.id,
        title: c.title,
        // Non-typed extra — the external-store passes it through to thread items.
        lastMessageAt: new Date(c.updatedAt),
      })),
      onSwitchToNewThread: handleNewChat,
      onSwitchToThread: handleSelect,
      onRename: handleRename,
      onDelete: handleDelete,
    }),
    [active?.id, conversations, handleDelete, handleNewChat, handleRename, handleSelect]
  );

  const hasChatted = messages.length > 0;
  const runtime = useExternalStoreRuntime({
    messages: runtimeMessages,
    isRunning: isSending,
    convertMessage,
    // Official assistant-ui starter suggestions (rendered by the registry's
    // ThreadWelcome/ThreadSuggestions, shown only on the empty thread).
    suggestions: hasChatted ? [] : SUGGESTIONS,
    adapters: { threadList },
    onNew: async (message: AppendMessage) => {
      const text = message.content
        .filter((part) => part.type === 'text')
        .map((part) => (part as { text: string }).text)
        .join('\n');
      await sendText(text);
    },
    onReload: async (parentId) => {
      await handleReload(parentId);
    },
  });

  // Composer extras — rendered by the official Thread inside its action row.
  // Marks are no longer a composer selector: the model detects marks intent
  // in the question text (e.g. "Write a 10-mark answer for ...") per the
  // system prompt, so the composer carries model selection instead.
  const [model, setModel] = useState<string | null>(null);
  const modelRef = useRef<string | null>(null);
  modelRef.current = model;
  const [models, setModels] = useState<
    Array<{ id: string; label: string; current: boolean }>
  >([]);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/syncai/models');
        if (!res.ok) return;
        const data = (await res.json()) as {
          models?: Array<{ id: string; label: string; current: boolean }>;
          defaultModel?: string;
        };
        if (cancelled) return;
        if (Array.isArray(data.models) && data.models.length > 0) {
          setModels(data.models);
          setModel((prev: string | null) => prev ?? data.defaultModel ?? data.models![0]!.id);
        }
      } catch {
        /* offline — selector stays hidden */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const ComposerAttachment = useMemo(() => {
    const Attach = () => (
      <button
        type="button"
        onClick={handleFilePick}
        disabled={isExtracting}
        title={isExtracting ? 'Reading PDF…' : 'Attach a PDF (max 8MB)'}
        aria-label="Attach PDF"
        className="text-muted-foreground hover:text-foreground hover:bg-muted-foreground/15 dark:hover:bg-muted-foreground/30 size-7 rounded-full active:scale-[0.96] inline-flex items-center justify-center transition-transform disabled:opacity-50"
      >
        {isExtracting ? <Loader2 size={15} className="animate-spin" /> : <Paperclip size={15} />}
      </button>
    );
    return Attach;
  }, [handleFilePick, isExtracting]);

  // Model picker — a Radix dropdown (not a bare <select>) with model
  // metadata so the student sees labels + current/default markers.
  const ComposerExtra = useMemo(() => {
    const ModelSelector = () => {
      if (models.length === 0) return null;
      return (
        <ModelPicker
          models={models}
          selectedId={model}
          onSelect={(id) => setModel(id)}
        />
      );
    };
    return ModelSelector;
  }, [model, models]);

  const threadComponents = useMemo(
    () => ({
      AssistantMessage: SyncAIAssistantMessage,
      ComposerAttachment,
      ComposerExtra,
    }),
    [ComposerAttachment, ComposerExtra]
  );

  const docChip = attachedDoc ? (
    <div className="flex items-center gap-2 rounded-lg border border-indigo-500/25 bg-indigo-500/10 px-2.5 py-1.5 text-[12px] text-indigo-200">
      <FileText size={14} className="shrink-0 text-indigo-300" />
      <span className="min-w-0 flex-1 truncate font-medium" title={attachedDoc.filename}>
        {attachedDoc.filename}
        <span className="font-normal text-indigo-300/70"> · {attachedDoc.pages.length} page{attachedDoc.pages.length === 1 ? '' : 's'} as context</span>
      </span>
      <button
        type="button"
        onClick={() => setAttachedDoc(null)}
        aria-label="Remove document"
        className="rounded-md p-1 text-indigo-300/80 transition-colors hover:bg-indigo-500/15 hover:text-indigo-100"
      >
        <X size={14} />
      </button>
    </div>
  ) : null;

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <SidebarProvider defaultOpen className="h-dvh overflow-hidden bg-background text-foreground">
        <SyncAISidebar
          collapsible="offcanvas"
          view={view}
          onViewChange={setView}
          pyqHistory={pyqHistory}
          activePyqId={activePyqId}
          onOpenPyq={handleOpenPyq}
          onDeletePyq={handleDeletePyq}
        />

        <SidebarInset>
          {/* Header — assistant-ui starter style */}
          <header className="flex h-14 shrink-0 items-center gap-2 border-b border-sidebar-border px-2.5">
            <SidebarTrigger className="size-8 text-muted-foreground hover:text-foreground" />
            <Separator orientation="vertical" className="mr-1 h-4 data-[orientation=vertical]:h-4" />
            <nav className="flex min-w-0 items-center gap-1.5 text-sm" aria-label="Breadcrumb">
              <span className="hidden font-medium text-muted-foreground sm:inline">SyncAI</span>
              <ChevronRight size={14} className="hidden text-muted-foreground sm:inline" />
              <span className="max-w-[38vw] truncate font-medium text-foreground">
                {view === "pyq" ? "PYQ Analysis" : (active?.title ?? "New Chat")}
              </span>
            </nav>
            <div className="ml-auto flex shrink-0 items-center gap-2">
              <span className="hidden rounded-full border border-border bg-muted/40 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground sm:inline">
                {view === "pyq" ? "AI-Generated" : "AI Chat"}
              </span>
            </div>
          </header>

          {/* Chat view */}
          {view === "chat" ? (
            <>
              {/* Academic context (subject code from the chat) + attachments */}
              {showSubjectPrompt && (
                <div className="border-b border-border bg-background/60 px-3 pt-2">
                  <SubjectCodePrompt
                    onDismiss={() => setShowSubjectPrompt(false)}
                    onResolved={(subject, subjectCode) => {
                      setContext((c) => ({ ...c, subject, subjectCode }));
                      setShowSubjectPrompt(false);
                      setNotice(null);
                    }}
                  />
                </div>
              )}
              {notice && (
                <div className="flex items-center gap-2 border-b border-amber-500/20 bg-amber-500/10 px-3 py-1.5 text-[12px] text-amber-200">
                  <span className="min-w-0 flex-1">{notice}</span>
                  <button type="button" onClick={() => setNotice(null)} aria-label="Dismiss" className="rounded p-0.5 opacity-70 hover:opacity-100">
                    <X size={14} />
                  </button>
                </div>
              )}
              {docChip && <div className="border-b border-border bg-background px-3 py-1.5">{docChip}</div>}

              {/* Chat thread — assistant-ui Thread */}
              <div className="relative min-h-0 flex-1 overflow-hidden">
                <Thread components={threadComponents} autoFocus />
              </div>

              <p className="px-4 py-2 text-center text-[10px] leading-relaxed text-muted-foreground/70">
                SyncAI can make mistakes. Please verify important information.
              </p>

              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf,.pdf"
                className="hidden"
                onChange={handleFileChange}
                aria-hidden="true"
              />
            </>
          ) : (
            <div className="min-h-0 flex-1 overflow-y-auto">
              <PyqAnalysis
                key={activePyqId ?? "new"}
                seedPlan={activePyqId ? pyqHistory.find((h) => h.id === activePyqId)?.plan ?? null : null}
                onSave={handleAnalyzed}
              />
            </div>
          )}
        </SidebarInset>
      </SidebarProvider>
    </AssistantRuntimeProvider>
  );
};
