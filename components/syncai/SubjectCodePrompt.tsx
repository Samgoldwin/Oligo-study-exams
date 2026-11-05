import React, { useState } from 'react';
import { BookOpenCheck, X, Loader2, GraduationCap } from 'lucide-react';
import { syncAI } from '@/services/syncAIService';

const CODE_RE = /\b([A-Z]{2,4}\s?[0-9]{2,4}[A-Z]?)\b/i;

/**
 * Friendlier than the old context bar: asks the student for their subject
 * code in conversation (e.g. BCS503), looks it up in the same stub resource
 * index the chat uses, and shows matching VTU resources so the answer is
 * grounded in the right subject.
 */
export const SubjectCodePrompt: React.FC<{
  onDismiss: () => void;
  onResolved: (subject: string, subjectCode: string) => void;
}> = ({ onDismiss, onResolved }) => {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [notFound, setNotFound] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = code.trim().toUpperCase().replace(/\s+/g, '');
    if (!trimmed || busy) return;

    setBusy(true);
    setNotFound(false);
    try {
      const { resources } = await syncAI.searchResources({
        query: trimmed,
        context: { branch: '', semester: null, scheme: '', subject: '', subjectCode: trimmed },
        limit: 8,
      });

      const match = resources.find(
        (r) => r.subjectCode.replace(/\s+/g, '').toUpperCase() === trimmed ||
               r.subjectCode.replace(/\s+/g, '').toUpperCase().startsWith(trimmed),
      ) ?? resources[0];

      if (match) {
        onResolved(match.subject, match.subjectCode);
      } else {
        // Keep the prompt open with a soft miss — the user may have typed a new code.
        setNotFound(true);
      }
    } catch {
      setNotFound(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      data-slot="syncai-subject-prompt"
      className="fade-in slide-in-from-bottom-2 mb-3 animate-in rounded-xl border border-indigo-500/20 bg-indigo-500/[0.06] px-3 py-2.5 duration-200"
    >
      <div className="flex items-center gap-2">
        <GraduationCap size={14} className="shrink-0 text-indigo-300" />
        <p className="min-w-0 flex-1 text-[12.5px] font-medium leading-snug text-indigo-100">
          Paste your subject code to sharpen answers — e.g. <span className="rounded bg-indigo-400/15 px-1 font-mono text-[11px]">BCS503</span>.<span className="hidden sm:inline"> Skip, we&apos;ll still help.</span>
        </p>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="shrink-0 rounded-md p-1 text-indigo-300/60 transition-colors hover:bg-indigo-400/10 hover:text-indigo-100"
        >
          <X size={14} />
        </button>
      </div>

      <form onSubmit={submit} className="mt-2 flex items-center gap-1.5">
        <BookOpenCheck size={13} className="shrink-0 text-indigo-300/60" />
        <input
          value={code}
          onChange={(e) => {
            const raw = e.target.value;
            if (CODE_RE.test(raw)) setNotFound(false);
            setCode(raw.toUpperCase());
          }}
          placeholder="e.g. BCS503, BCS402, 18CS65"
          aria-label="Subject code"
          className="h-8 min-w-0 flex-1 rounded-md border border-indigo-500/20 bg-background/60 px-2 font-mono text-[12px] uppercase text-indigo-100 outline-none transition-colors placeholder:font-sans placeholder:normal-case placeholder:text-indigo-300/40 focus:border-indigo-400/50 focus:bg-background"
          maxLength={12}
          autoComplete="off"
        />
        <button
          type="submit"
          disabled={busy || code.trim().length < 2}
          className="h-8 shrink-0 rounded-md bg-indigo-600 px-2.5 text-[11.5px] font-semibold text-white transition-all hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? <Loader2 size={12} className="animate-spin" /> : 'Find'}
        </button>
      </form>

      {notFound && (
        <p className="mt-1.5 text-[11px] leading-snug text-amber-300/90">
          Couldn&apos;t find that code in the VTU stub index. Check the code or skip — general answers still work.
        </p>
      )}

      <p className="mt-1.5 text-[10px] leading-snug text-indigo-300/50">
        On mobile we&apos;ll ask for the code right here so answers match your subject. Nothing is stored anywhere else.
      </p>
    </div>
  );
};
