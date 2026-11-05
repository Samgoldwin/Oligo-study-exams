"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  BookText,
  Check,
  ChevronDown,
  ClipboardList,
  Clock,
  Download,
  FileText,
  GraduationCap,
  Info,
  Loader2,
  Rocket,
  Sparkles,
  UploadCloud,
  Wand2,
  X,
} from "lucide-react";
import { aiService } from "@/services/groqService";
import { syncAI, SyncAIApiError } from "@/services/syncAIService";
import { loadContext, saveContext } from "@/services/conversationStore";
import { cn } from "@/lib/utils";
import type { FileUpload, StudyPlan, SyllabusDetection } from "@/types";
import { SyncAILogo } from "./SyncAILogo";

const MAX_FILE_SIZE_MB = 8;

const InputShell: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <div
    className={cn(
      "rounded-xl border border-border bg-muted/20 p-3 transition-colors focus-within:border-foreground/30",
      className
    )}
  >
    {children}
  </div>
);

/** Prompt Kit-style field label. */
const FieldLabel: React.FC<{ icon: React.ReactNode; children: React.ReactNode; right?: React.ReactNode }> = ({ icon, children, right }) => (
  <div className="mb-2 flex items-center justify-between gap-2">
    <span className="text-muted-foreground flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em]">
      {icon}
      {children}
    </span>
    {right}
  </div>
);

const Badge: React.FC<{ tone?: "high" | "medium" | "low" | "neutral"; children: React.ReactNode }> = ({ tone = "neutral", children }) => (
  <span
    className={cn(
      "rounded border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide",
      tone === "high" && "border-red-500/40 bg-red-500/10 text-red-400",
      tone === "medium" && "border-amber-500/40 bg-amber-500/10 text-amber-400",
      tone === "low" && "border-emerald-500/40 bg-emerald-500/10 text-emerald-400",
      tone === "neutral" && "border-border bg-muted/40 text-muted-foreground"
    )}
  >
    {children}
  </span>
);

const priorityTone = (p: string): "high" | "medium" | "low" =>
  p?.toLowerCase() === "high" ? "high" : p?.toLowerCase() === "medium" ? "medium" : "low";
const difficultyTone = (d: string): "high" | "medium" | "low" =>
  d?.toLowerCase() === "hard" ? "high" : d?.toLowerCase() === "medium" ? "medium" : "low";

/** Defensive normalization of the analyzer's JSON so render never crashes on
 *  odd shapes (objects instead of arrays, numeric years, missing fields). */
const normalizePlan = (raw: any): StudyPlan => {
  const modules = Array.isArray(raw?.modules)
    ? raw.modules.map((m: any) => ({
        topicName: typeof m?.topicName === "string" ? m.topicName : "Module",
        priority: typeof m?.priority === "string" ? m.priority : "Medium",
        description: typeof m?.description === "string" ? m.description : "",
        questions: Array.isArray(m?.questions)
          ? m.questions.map((q: any) => ({
              text: typeof q?.text === "string" ? q.text : String(q?.text ?? ""),
              marks: typeof q?.marks === "number" ? q.marks : Number(q?.marks) || undefined,
              yearAppeared: q?.yearAppeared !== undefined && q?.yearAppeared !== null ? String(q.yearAppeared) : undefined,
              difficulty: typeof q?.difficulty === "string" ? q.difficulty : "Medium",
              reference: q?.reference !== undefined && q?.reference !== null ? String(q.reference) : undefined,
            }))
          : [],
      }))
    : [];

  return {
    subject: typeof raw?.subject === "string" ? raw.subject : "",
    summary: typeof raw?.summary === "string" ? raw.summary : "",
    extractedQuestions: Array.isArray(raw?.extractedQuestions)
      ? raw.extractedQuestions.map((q: any) => ({
          text: typeof q?.text === "string" ? q.text : String(q?.text ?? ""),
          marks: typeof q?.marks === "number" ? q.marks : Number(q?.marks) || undefined,
          yearAppeared: q?.yearAppeared !== undefined && q?.yearAppeared !== null ? String(q.yearAppeared) : undefined,
          difficulty: typeof q?.difficulty === "string" ? q.difficulty : "Medium",
          reference: q?.reference !== undefined && q?.reference !== null ? String(q.reference) : undefined,
        }))
      : [],
    modules,
    keyTopics: Array.isArray(raw?.keyTopics) ? raw.keyTopics.map(String) : [],
    questionsByTopic: raw?.questionsByTopic ?? {},
    studySchedule: Array.isArray(raw?.studySchedule) ? raw.studySchedule : [],
    focusAreas: Array.isArray(raw?.focusAreas) ? raw.focusAreas.map(String) : [],
    priorityOrder: Array.isArray(raw?.priorityOrder) ? raw.priorityOrder.map(String) : [],
    estimatedHours:
      typeof raw?.estimatedHours === "number"
        ? raw.estimatedHours
        : raw?.estimatedHours !== undefined && raw?.estimatedHours !== null
          ? Number(raw.estimatedHours) || undefined
          : undefined,
  };
};

const DetectChips: React.FC<{ d: SyllabusDetection; applied: boolean; onDismiss: () => void; onApply: () => void }> = ({ d, applied, onDismiss, onApply }) => {
  const chips: Array<[string, string | null]> = [
    ["Subject", d.subject],
    ["Code", d.subjectCode],
    ["Sem", d.semester !== null ? String(d.semester) : null],
    ["Branch", d.branch],
    ["Scheme", d.scheme],
  ];
  const any = chips.some(([, v]) => v);
  return (
    <div className="fade-in animate-in mt-3 rounded-lg border border-indigo-500/25 bg-indigo-500/[0.06] p-2.5">
      <div className="mb-1.5 flex items-center gap-1.5">
        <GraduationCap size={13} className="text-indigo-300" />
        <span className="text-[10px] font-bold uppercase tracking-wide text-indigo-200">Detected from syllabus</span>
        {applied && (
          <span className="ml-auto inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-1.5 text-[9px] font-bold uppercase text-emerald-400">
            <Check size={10} /> applied
          </span>
        )}
        <button type="button" onClick={onDismiss} aria-label="Dismiss" className="rounded p-0.5 text-indigo-300/60 hover:text-indigo-100">
          <X size={13} />
        </button>
      </div>
      {any ? (
        <div className="flex flex-wrap gap-1.5">
          {chips.map(([k, v]) =>
            v ? (
              <span key={k} className="rounded border border-indigo-500/25 bg-background/40 px-1.5 py-0.5 text-[11px] text-indigo-100">
                <span className="text-indigo-300/70">{k}:</span> {v}
              </span>
            ) : null
          )}
        </div>
      ) : (
        <p className="text-[11px] text-indigo-200/70">Nothing identifiable found in that text.</p>
      )}
      <div className="mt-2 flex items-center gap-2">
        <button
          type="button"
          onClick={onApply}
          disabled={!any}
          className="rounded-md bg-indigo-600 px-2.5 py-1 text-[11px] font-semibold text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Apply to SyncAI
        </button>
        <span className="text-[10px] text-indigo-300/50">Syncs branch/sem/scheme/subject.</span>
      </div>
    </div>
  );
};

export const PyqAnalysis: React.FC<{
  seedPlan?: StudyPlan | null;
  onSave?: (plan: StudyPlan) => void;
}> = ({ seedPlan, onSave }) => {
  const [syllabus, setSyllabus] = useState("");
  const [files, setFiles] = useState<FileUpload[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [plan, setPlan] = useState<StudyPlan | null>(seedPlan ?? null);
  const [analyzing, setAnalyzing] = useState(false);

  const [syllabusName, setSyllabusName] = useState<string | null>(null);
  const [readingSyllabus, setReadingSyllabus] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [detection, setDetection] = useState<SyllabusDetection | null>(null);
  const [detectionApplied, setDetectionApplied] = useState(false);
  const [syllabusNotice, setSyllabusNotice] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const ANALYZE_STEPS = [
    "Reading papers & syllabus…",
    "Extracting questions…",
    "Comparing with PYQ patterns…",
    "Analyzing syllabus coverage…",
    "Building your question bank…",
  ];
  const [stepIndex, setStepIndex] = useState(0);
  const stepTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(
    () => () => {
      if (stepTimer.current) clearInterval(stepTimer.current);
    },
    []
  );

  // Re-open a saved analysis (or clear when switching to "new").
  useEffect(() => {
    setPlan(seedPlan ?? null);
    setErrorMsg(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seedPlan]);

  const papersRef = useRef<HTMLInputElement>(null);
  const syllabusRef = useRef<HTMLInputElement>(null);

  const runDetection = async (text: string) => {
    setDetecting(true);
    setDetectionApplied(false);
    setSyllabusNotice(null);
    try {
      const { detection: r } = await syncAI.detectSyllabus(text);
      setDetection(r);
      if (!Object.values(r).some((v) => v)) setSyllabusNotice("Couldn't identify subject/sem. You can still type it in manually.");
    } catch (err) {
      setSyllabusNotice(err instanceof SyncAIApiError ? err.message : "Syllabus detection failed. Please try again.");
    } finally {
      setDetecting(false);
    }
  };

  const onSyllabusFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setSyllabusNotice(null);
    setReadingSyllabus(true);
    try {
      const { extractPdfText } = await import("@/services/pdfService");
      const extracted = await extractPdfText(file);
      const text = extracted.pages.join("\n\n").trim();
      setSyllabus(text.slice(0, 12000));
      setSyllabusName(file.name);
      const notes: string[] = [];
      if (text.length > 12000) notes.push("Syllabus was long — limited to the first 12,000 characters.");
      if (extracted.ocrApplied) notes.push(`Scanned PDF — OCR applied to ${extracted.ocrPages.length} page${extracted.ocrPages.length === 1 ? "" : "s"}.`);
      if (notes.length > 0) setSyllabusNotice(notes.join(" "));
      await runDetection(text.slice(0, 8000));
    } catch (err) {
      setSyllabusNotice(err instanceof Error && err.name === "PdfExtractionError" ? err.message : `"${file.name}" could not be read.`);
    } finally {
      setReadingSyllabus(false);
    }
  };

  const onPapers = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? []);
    e.target.value = "";
    acceptPapers(picked);
  };

  const acceptPapers = (files: File[]) => {
    const next: FileUpload[] = [];
    let err: string | null = null;
    for (const f of files) {
      if (!f.type.includes("pdf") && !f.name.toLowerCase().endsWith(".pdf")) {
        err = `"${f.name}" is not a PDF.`;
        continue;
      }
      if (f.size > MAX_FILE_SIZE_MB * 1024 * 1024) err = `"${f.name}" exceeds ${MAX_FILE_SIZE_MB}MB.`;
      else next.push({ file: f, id: Math.random().toString(36).slice(2) });
    }
    if (err) setErrorMsg(err);
    else setErrorMsg(null);
    setFiles((prev) => [...prev, ...next]);
  };

  const onDropPapers = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const files = Array.from(e.dataTransfer.files ?? []);
    if (files.length > 0) acceptPapers(files);
  };

  const generate = async () => {
    if (!syllabus.trim()) return setErrorMsg("Please enter or upload the syllabus.");
    if (files.length === 0) return setErrorMsg("Please upload at least one previous-year question paper.");
    setErrorMsg(null);
    setAnalyzing(true);
    setStepIndex(0);
    stepTimer.current = setInterval(() => {
      setStepIndex((s) => (s < ANALYZE_STEPS.length - 1 ? s + 1 : s));
    }, 4200);
    try {
      const result = await aiService.generateStudyPlan(syllabus.trim(), files.map((f) => f.file));
      const normalized = normalizePlan(result);
      const usable =
        normalized.subject ||
        normalized.modules.length > 0 ||
        normalized.extractedQuestions.length > 0 ||
        (normalized.keyTopics?.length ?? 0) > 0;
      if (!usable) {
        throw new Error("Could not generate a usable plan from the uploaded documents. Try pasting a fuller syllabus or clearer question papers.");
      }
      onSave?.(normalized);
      setPlan(normalized);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Analysis failed. Please try again.");
    } finally {
      if (stepTimer.current) clearInterval(stepTimer.current);
      stepTimer.current = null;
      setAnalyzing(false);
    }
  };

  const reset = () => {
    setPlan(null);
    setFiles([]);
    setSyllabus("");
    setSyllabusName(null);
    setDetection(null);
    setDetectionApplied(false);
    setErrorMsg(null);
  };

  const exportJson = () => {
    if (!plan) return;
    const blob = new Blob([JSON.stringify(plan, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(plan.subject || "question-bank").replace(/[^a-z0-9]/gi, "_")}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (plan) {
    const moduleCount = plan.modules.length;
    const questionCount = plan.extractedQuestions.length;
    const focusAreas = Array.isArray(plan.focusAreas) ? plan.focusAreas : [];
    const priorityOrder = Array.isArray(plan.priorityOrder) ? plan.priorityOrder : [];

    return (
      <div className="fade-in animate-in mx-auto w-full max-w-3xl px-4 py-6 md:px-6">
        {/* Header */}
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-indigo-500/10 ring-1 ring-inset ring-indigo-500/20">
              <SyncAILogo className="size-5" variant="light" />
            </span>
            <div>
              <h1 className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">
                {plan.subject || "Analysis Results"}
              </h1>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                <Badge tone="neutral">Question bank &amp; study plan</Badge>
                <Badge tone="neutral">AI-generated</Badge>
                {moduleCount > 0 && <Badge tone="neutral">{moduleCount} modules</Badge>}
                {questionCount > 0 && <Badge tone="neutral">{questionCount} questions</Badge>}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={exportJson}
              className="flex h-8 items-center gap-1.5 rounded-md border border-border px-2.5 text-[12px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <Download size={13} /> JSON
            </button>
            <button
              type="button"
              onClick={reset}
              className="flex h-8 items-center gap-1.5 rounded-md bg-foreground px-2.5 text-[12px] font-medium text-background transition-opacity hover:opacity-90"
            >
              New analysis
            </button>
          </div>
        </div>

        {/* Summary */}
        <div className="rounded-2xl border border-indigo-500/15 bg-gradient-to-b from-indigo-500/[0.06] to-transparent p-5">
          <p className="text-sm leading-relaxed text-foreground">{plan.summary}</p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {typeof plan.estimatedHours === "number" && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/60 px-3 py-1 text-[12px] font-medium text-foreground">
                <Clock size={13} className="text-muted-foreground" /> ~{plan.estimatedHours} study hours
              </span>
            )}
            {focusAreas.map((f, i) => (
              <Badge key={i} tone="medium">{f}</Badge>
            ))}
          </div>
        </div>

        {/* Do-this-first priority order */}
        {priorityOrder.length > 0 && (
          <div className="mt-4 rounded-2xl border border-border bg-card p-5">
            <h3 className="mb-3 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
              <Rocket size={13} /> Do this first
            </h3>
            <ol className="flex flex-col gap-1.5">
              {priorityOrder.map((p, i) => (
                <li key={i} className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-[13px] text-foreground transition-colors hover:bg-muted/50">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-indigo-500/10 font-mono text-[11px] font-bold text-indigo-300">
                    {i + 1}
                  </span>
                  <span className="min-w-0">{p}</span>
                </li>
              ))}
            </ol>
          </div>
        )}

        {/* Modules */}
        {moduleCount > 0 && (          <div className="mt-5">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                <ClipboardList size={15} className="text-muted-foreground" /> Modules
              </h2>
              <Badge tone="neutral">{moduleCount} total</Badge>
            </div>
            <div className="flex flex-col gap-2">
              {plan.modules.map((mod, mi) => (
                <details key={mi} open={mi === 0} className="group overflow-hidden rounded-2xl border border-border bg-card">
                  <summary className="flex cursor-pointer items-center gap-3 px-4 py-3.5 [&::-webkit-details-marker]:hidden">
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-indigo-500/10 font-mono text-[11px] font-bold text-indigo-300">
                      M{mi + 1}
                    </span>
                    <span className="min-w-0 flex-1 text-[13.5px] font-semibold text-foreground">{mod.topicName}</span>
                    <Badge tone={priorityTone(mod.priority)}>{mod.priority}</Badge>
                    <span className="rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                      {mod.questions.length}
                    </span>
                    <ChevronDown size={16} className="shrink-0 text-muted-foreground transition-transform open:rotate-180" />
                  </summary>
                  <div className="border-t border-border/70 px-4 py-3.5">
                    {mod.description && (
                      <p className="mb-3 text-[12.5px] leading-relaxed text-muted-foreground">{mod.description}</p>
                    )}
                    {mod.questions.length > 0 ? (
                      <ul className="flex flex-col gap-2">
                        {mod.questions.map((q, qi) => (
                          <li key={qi} className="rounded-xl border border-border/80 bg-background/50 p-3">
                            <p className="text-[13px] leading-snug text-foreground">{q.text}</p>
                            <div className="mt-2 flex flex-wrap items-center gap-1.5">
                              {q.marks ? <Badge tone="neutral">{q.marks}M</Badge> : null}
                              <Badge tone={difficultyTone(q.difficulty)}>{q.difficulty}</Badge>
                              {q.yearAppeared ? <Badge tone="neutral">'{String(q.yearAppeared).slice(-2)}</Badge> : null}
                              {q.reference ? (
                                <span className="text-[10px] text-muted-foreground">Ref {q.reference}</span>
                              ) : null}
                            </div>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs text-muted-foreground">No specific questions extracted for this module.</p>
                    )}
                  </div>
                </details>
              ))}
            </div>
          </div>
        )}

        <p className="mt-4 flex items-start gap-2 rounded-xl border border-border bg-muted/20 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
          <Info size={14} className="mt-0.5 shrink-0" />
          PYQ Analyses are for reference only and do not guarantee future exam questions.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6 md:px-6">
      <div className="mb-5 flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-xl bg-indigo-600/20 text-indigo-300">
          <SyncAILogo className="size-5" variant="light" />
        </span>
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">PYQ Analysis</h1>
          <p className="text-xs text-muted-foreground">Upload past papers + syllabus → AI-generated question bank &amp; plan</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        {/* Syllabus */}
        <InputShell className="lg:col-span-3">
          <FieldLabel icon={<BookText size={12} />} right={<span className="text-[9px] uppercase tracking-wide text-muted-foreground">{syllabusName ?? "required"}</span>}>
            Syllabus
          </FieldLabel>
          <textarea
            value={syllabus}
            onChange={(e) => setSyllabus(e.target.value)}
            placeholder="Paste syllabus chapters/topics/sub-topics — or upload the syllabus PDF."
            className="min-h-36 w-full resize-y rounded-lg border border-border bg-background/50 p-2.5 text-[13px] leading-relaxed text-foreground outline-none placeholder:text-muted-foreground/60 focus:border-foreground/30"
          />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => syllabusRef.current?.click()}
              disabled={readingSyllabus}
              className="flex h-8 items-center gap-1.5 rounded-md border border-border px-2.5 text-[12px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
            >
              {readingSyllabus ? <Loader2 size={13} className="animate-spin" /> : <FileText size={13} />}
              Upload PDF
            </button>
            <button
              type="button"
              onClick={() => runDetection(syllabus)}
              disabled={detecting || syllabus.trim().length < 30}
              className="flex h-8 items-center gap-1.5 rounded-md border border-border px-2.5 text-[12px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
            >
              {detecting ? <Loader2 size={13} className="animate-spin" /> : <Wand2 size={13} />}
              Detect subject &amp; sem
            </button>
            <input ref={syllabusRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={onSyllabusFile} aria-hidden="true" />
          </div>
          {syllabusNotice && (
            <p className="mt-2 flex items-start gap-1.5 text-[11px] text-amber-300/90">
              <AlertTriangle size={12} className="mt-0.5 shrink-0" /> {syllabusNotice}
            </p>
          )}
          {detection && (
            <DetectChips
              d={detection}
              applied={detectionApplied}
              onDismiss={() => setDetection(null)}
              onApply={() => {
                const ctx = loadContext();
                saveContext({
                  ...ctx,
                  subject: detection.subject ?? ctx.subject,
                  subjectCode: detection.subjectCode ?? ctx.subjectCode,
                  semester: detection.semester ?? ctx.semester,
                  scheme: detection.scheme ?? ctx.scheme,
                  branch: detection.branch ?? ctx.branch,
                });
                setDetectionApplied(true);
              }}
            />
          )}
        </InputShell>

        {/* Papers */}
        <InputShell className="lg:col-span-2">
          <FieldLabel icon={<UploadCloud size={12} />} right={<span className="text-[9px] uppercase tracking-wide text-muted-foreground">{files.length} file{files.length === 1 ? "" : "s"}</span>}>
            Question papers
          </FieldLabel>
          <div
            role="button"
            tabIndex={0}
            onClick={() => papersRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                papersRef.current?.click();
              }
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={onDropPapers}
            className={cn(
              "flex w-full flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed px-3 py-7 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
              dragActive
                ? "border-foreground/40 bg-foreground/[0.04]"
                : "border-border bg-background/40 hover:border-foreground/30 hover:bg-background/60"
            )}
          >
            <UploadCloud size={20} className={cn("transition-colors", dragActive ? "text-foreground" : "text-muted-foreground")} />
            <span className="text-[12.5px] font-medium text-muted-foreground">
              {dragActive ? "Drop to upload" : "Click or drag & drop PDFs"}
            </span>
            <span className="text-[10px] text-muted-foreground/70">Text-based PDF · max {MAX_FILE_SIZE_MB}MB each</span>
          </div>
          <input ref={papersRef} type="file" accept="application/pdf,.pdf" multiple className="hidden" onChange={onPapers} aria-hidden="true" />
          {files.length > 0 && (
            <ul className="mt-2.5 flex flex-col gap-1.5">
              {files.map((f) => (
                <li key={f.id} className="flex items-center gap-2 rounded-lg border border-border/70 bg-background/40 px-2.5 py-2">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-red-500/10 text-red-400">
                    <FileText size={13} />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[12.5px] text-foreground">{f.file.name}</span>
                  <button type="button" onClick={() => setFiles((p) => p.filter((x) => x.id !== f.id))} aria-label="Remove" className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground">
                    <X size={13} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </InputShell>
      </div>

      {errorMsg && (
        <div className="mt-4 flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-[12.5px] text-red-300">
          <AlertTriangle size={14} className="shrink-0" />
          <span className="min-w-0 flex-1">{errorMsg}</span>
          <button type="button" onClick={() => setErrorMsg(null)} aria-label="Dismiss" className="rounded p-0.5 hover:bg-red-500/20">
            <X size={13} />
          </button>
        </div>
      )}

      <button
        type="button"
        onClick={generate}
        disabled={analyzing || !syllabus.trim() || files.length === 0}
        className="mt-4 flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-foreground text-sm font-semibold text-background transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {analyzing ? (
          <Loader2 size={16} className="animate-spin" />
        ) : (
          <Sparkles size={16} />
        )}
        {analyzing ? ANALYZE_STEPS[stepIndex] : "Generate Question Bank"}
      </button>

      {analyzing && (
        <div className="fade-in animate-in mt-3 flex items-center justify-center gap-2 text-[11px] text-muted-foreground">
          <span className="inline-flex gap-1" aria-hidden="true">
            <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.3s]" />
            <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.15s]" />
            <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground" />
          </span>
          This may take up to a minute…
        </div>
      )}

      <p className="mt-4 text-center text-[10px] leading-relaxed text-muted-foreground/70">
        PYQ Analyses are for reference only and do not guarantee future exam questions.
      </p>
    </div>
  );
};
