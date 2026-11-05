import React, { useCallback, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import {
  syncAI,
  SyncAIApiError,
  type CustomModelMeta,
  type ModelTestResult,
  type ModelTestVerdict,
} from "@/services/syncAIService";
import { encryptWithPublicKey } from "@/lib/crypto";
import { cn } from "@/lib/utils";

type TestStage = "idle" | "encrypting" | "sending" | "done";
type Step = 1 | 2 | 3;

const VERDICT_META: Record<
  ModelTestVerdict,
  { icon: string; tone: "ok" | "bad" | "warn" | "muted"; title: string; detail: string }
> = {
  ok: { icon: "✓", tone: "ok", title: "Success!", detail: "The API key is valid and working perfectly." },
  invalid: { icon: "✗", tone: "bad", title: "Invalid", detail: "The key is incorrect, revoked, or lacks required permissions." },
  no_balance: { icon: "⚠️", tone: "warn", title: "No Balance", detail: "The key is valid, but your account has insufficient balance or expired credits." },
  rate_limit: { icon: "⚠️", tone: "warn", title: "Rate Limit", detail: "You are testing too fast. Please wait a bit before trying again." },
  failed: { icon: "✗", tone: "bad", title: "Failed", detail: "Internal server error on the provider's side or network timeout." },
  unknown: { icon: "—", tone: "muted", title: "Unknown", detail: "Testing is not yet supported for this specific provider." },
};

const TONE_CLS: Record<"ok" | "bad" | "warn" | "muted", string> = {
  ok: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  bad: "border-red-500/30 bg-red-500/10 text-red-300",
  warn: "border-amber-500/30 bg-amber-500/10 text-amber-200",
  muted: "border-border bg-muted/30 text-muted-foreground",
};

function sigOf(baseUrl: string, model: string, key: string): string {
  return `${baseUrl.trim()}|${model.trim()}|${key.trim()}`;
}

const PRESETS = [
  { name: "Google Gemini", info: "Free tier available", baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai", model: "gemini-2.5-flash" },
  { name: "NVIDIA", info: "Free tier available", baseUrl: "https://integrate.api.nvidia.com/v1", model: "meta/llama-3.3-70b-instruct" },
  { name: "OpenRouter", info: "Free models available", baseUrl: "https://openrouter.ai/api/v1", model: "google/gemini-2.5-flash" },
  { name: "Groq", info: "Free tier available", baseUrl: "https://api.groq.com/openai/v1", model: "llama-3.3-70b-versatile" },
  { name: "Cohere", info: "Free tier available", baseUrl: "https://api.cohere.ai/v2", model: "command-r7b-12b" },
  { name: "Mistral", info: "Free tier available", baseUrl: "https://api.mistral.ai/v1", model: "mistral-small-latest" },
  { name: "Together AI", info: "Free tier available", baseUrl: "https://api.together.xyz/v1", model: "meta-llama/Llama-3.3-70B-Instruct-Turbo" },
  { name: "DeepSeek", info: "Low-cost", baseUrl: "https://api.deepseek.com/v1", model: "deepseek-chat" },
  { name: "OpenAI", info: "Paid", baseUrl: "https://api.openai.com/v1", model: "gpt-4o-mini" },
  { name: "Anthropic", info: "Paid", baseUrl: "https://api.anthropic.com/v1", model: "claude-3-5-haiku-latest" },
];

function ResultsLegend() {
  return (
    <div className="rounded-xl border border-border bg-muted/25 px-3.5 py-3">
      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Understanding test results</p>
      <ul className="mt-2 flex flex-col gap-1.5 text-[11.5px] leading-snug text-muted-foreground">
        <li><span className="rounded bg-emerald-500/15 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-emerald-400">200</span> <span className="font-medium text-foreground">Success</span> — The API key is valid and working perfectly.</li>
        <li><span className="rounded bg-red-500/15 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-red-400">401/403</span> <span className="font-medium text-foreground">Invalid</span> — The key is incorrect, revoked, or lacks required permissions.</li>
        <li><span className="rounded bg-amber-500/15 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-amber-300">402</span> <span className="font-medium text-foreground">No Balance</span> — The key is valid, but your account has insufficient balance or expired credits.</li>
        <li><span className="rounded bg-amber-500/15 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-amber-300">429</span> <span className="font-medium text-foreground">Rate Limit</span> — You are testing too fast. Please wait a bit before trying again.</li>
        <li><span className="rounded bg-red-500/15 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-red-400">500/502/503</span> <span className="font-medium text-foreground">Failed</span> — Internal server error on the provider's side or network timeout.</li>
        <li><span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] font-semibold text-muted-foreground">Unknown</span> — Testing is not yet supported for this specific provider.</li>
      </ul>
    </div>
  );
}

export const ModelsModal: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  const [models, setModels] = useState<CustomModelMeta[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [model, setModel] = useState("");
  const [key, setKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [missing, setMissing] = useState<Record<string, boolean>>({});

  const [step, setStep] = useState<Step>(1);
  const [testStage, setTestStage] = useState<TestStage>("idle");
  const [testResult, setTestResult] = useState<ModelTestResult | null>(null);
  const [showLegend, setShowLegend] = useState(false);
  const [verifiedSig, setVerifiedSig] = useState<string | null>(null);
  const testing = testStage === "encrypting" || testStage === "sending";
  const currentSig = sigOf(baseUrl, model, key);
  const isVerified = verifiedSig === currentSig && currentSig !== "||" && Boolean(baseUrl && model && key);
  const savedSigRef = useRef<string | null>(null);

  const firstInputRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await syncAI.listCustomModels();
      setModels(res.models);
    } catch {
      /* keep list */
    }
  }, []);

  useEffect(() => {
    if (open) {
      setError(null);
      setTestStage("idle");
      setTestResult(null);
      setShowLegend(false);
      setVerifiedSig(null);
      savedSigRef.current = null;
      setStep(1);
      setMissing({});
      void refresh();
      const t = setTimeout(() => firstInputRef.current?.focus(), 60);
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prevOverflow;
        clearTimeout(t);
      };
    }
  }, [open, refresh]);

  if (!open) return null;

  const missingNow = (): Record<string, boolean> => {
    const m: Record<string, boolean> = {};
    if (!name.trim()) m.name = true;
    if (!baseUrl.trim()) m.baseUrl = true;
    if (!model.trim()) m.model = true;
    if (!key.trim()) m.key = true;
    return m;
  };
  const fieldCls = (field: string) => cn(inputCls, missing[field] && "border-red-500/60 focus:border-red-500/70");

  const runTest = async (): Promise<boolean> => {
    if (!baseUrl.trim() || !model.trim() || !key.trim()) {
      setError("Fill in Base URL, model, and API key to test the connection.");
      return false;
    }
    setError(null);
    setTestResult(null);
    setTestStage("encrypting");
    try {
      const { publicKey } = await syncAI.getPublicKey();
      const encryptedKey = await encryptWithPublicKey(publicKey, key.trim());
      setTestStage("sending");
      const result = await syncAI.testCustomModel({ baseUrl: baseUrl.trim(), model: model.trim(), encryptedKey });
      setTestResult(result);
      if (result.ok) setVerifiedSig(currentSig);
      return result.ok;
    } catch (e) {
      setTestResult({ ok: false, status: null, verdict: "unknown", ms: 0, message: e instanceof Error ? e.message : "Test failed." });
      return false;
    } finally {
      setTestStage("done");
    }
  };

  const save = async () => {
    const m = missingNow();
    setMissing(m);
    if (Object.values(m).some(Boolean)) {
      setStep(1);
      return;
    }
    if (!isVerified) {
      const passed = await runTest();
      if (!passed) return; // result is shown on the verify step
    }
    setBusy(true);
    setError(null);
    try {
      const { publicKey } = await syncAI.getPublicKey();
      const encryptedKey = await encryptWithPublicKey(publicKey, key.trim());
      await syncAI.saveCustomModel({ name: name.trim(), baseUrl: baseUrl.trim(), model: model.trim(), encryptedKey });
      savedSigRef.current = currentSig;
      await refresh();
      setStep(3);
    } catch (e) {
      setError(e instanceof SyncAIApiError || e instanceof Error ? e.message : "Could not save the model.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    setBusy(true);
    setError(null);
    try {
      await syncAI.deleteCustomModel(id);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete the model.");
    } finally {
      setBusy(false);
    }
  };

  const resetForm = () => {
    setName("");
    setBaseUrl("");
    setModel("");
    setKey("");
    setTestStage("idle");
    setTestResult(null);
    setVerifiedSig(null);
    setError(null);
    setMissing({});
    setStep(1);
    setTimeout(() => firstInputRef.current?.focus(), 60);
  };

  const applyPreset = (p: (typeof PRESETS)[number]) => {
    setName(p.name);
    setBaseUrl(p.baseUrl);
    setModel(p.model);
    setMissing({});
    setError(null);
    // keep savedSigRef logic — snapshot clear; verify step re-runs on change
    setVerifiedSig(null);
    setTestStage("idle");
    setTestResult(null);
    firstInputRef.current?.focus();
  };

  const inputCls =
    "w-full rounded-xl border border-border bg-background/60 px-3.5 py-2.5 text-sm outline-none transition-colors placeholder:text-muted-foreground/50 focus:border-foreground/30 focus:bg-background";
  const secondaryBtnCls =
    "flex h-9 items-center justify-center rounded-xl border border-border bg-muted/40 px-4 text-[13px] font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-50";
  const primaryBtnCls =
    "flex h-9 flex-1 items-center justify-center rounded-xl bg-foreground px-4 text-[13px] font-semibold text-background transition-colors hover:opacity-90 disabled:opacity-50";
  const meta = testResult ? VERDICT_META[testResult.verdict] : null;
  const activeProvider = PRESETS.find((p) => p.baseUrl === baseUrl.trim());
  const TEST_STEPS = [
    { text: "Encrypting your API key in this browser", desc: "RSA-OAEP · your key never travels in plain text" },
    { text: "Sending the encrypted key to SyncAI over HTTPS", desc: "Ciphertext only crosses the network" },
    { text: "Decrypting in memory to make the provider call", desc: "Never written to disk or shown again" },
    { text: "Calling the provider to verify the model", desc: "Checking the key against a live generation request" },
  ];
  const activeTestStep =
    testStage === "encrypting" ? 0 : testStage === "sending" ? 2 : testStage === "done" ? TEST_STEPS.length : -1;

  const TrustTimeline: React.FC = () => (
    <div className="mt-3 rounded-xl border border-indigo-500/25 bg-indigo-500/10 p-3.5">
      <ol className="flex flex-col gap-2.5">
        {TEST_STEPS.map((s, i) => {
          const isActive = i === activeTestStep;
          const isDone = i < activeTestStep;
          return (
            <li key={s.text} className="flex items-start gap-2.5">
              <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center">
                {isActive ? (
                  <span className="size-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                ) : (
                  <span className={cn("size-1.5 rounded-full", isDone ? "bg-indigo-300" : "bg-indigo-300/30")} />
                )}
              </span>
              <div className="min-w-0">
                <p className="text-[12.5px] font-medium leading-snug text-indigo-100">{s.text}</p>
                <p className="text-[11px] leading-snug text-indigo-200/70">{s.desc}</p>
              </div>
            </li>
          );
        })}
      </ol>
      <div className="mt-3 border-t border-indigo-500/20 pt-2.5 text-[11px] leading-relaxed text-indigo-200/80">
        {testStage === "encrypting"
          ? "Your API key is being locked before it leaves this device."
          : "We never store your API key in plain text. Ciphertext only, decrypted in memory for a single call."}
      </div>
    </div>
  );

  const steps: Array<{ n: Step; label: string }> = [
    { n: 1, label: "Connect" },
    { n: 2, label: "Verify" },
    { n: 3, label: "Done" },
  ];

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-background/70 backdrop-blur-sm md:items-center md:p-4"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[92dvh] w-full max-w-lg flex-col rounded-t-2xl border border-white/5 bg-popover shadow-2xl shadow-black/50 animate-in slide-in-from-bottom-4 fade-in-0 md:max-h-[86vh] md:rounded-2xl md:animate-in md:fade-in-0 md:zoom-in-95">
        {/* Mobile grabber — tappable to dismiss */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close sheet"
          className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-muted-foreground/20 transition-colors hover:bg-muted-foreground/40 md:hidden"
        />

        {/* Header */}
        <div className="flex shrink-0 items-start justify-between gap-4 px-5 pt-4 pb-3">
          <div>
            <h3 className="text-[15px] font-semibold tracking-tight text-popover-foreground">My models</h3>
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
              Connect your own model endpoint. Keys are encrypted in your browser before they leave the device.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <X size={16} />
          </button>
        </div>

        {/* Step indicator */}
        <div className="shrink-0 border-b border-border/70 px-5 pb-3">
          <div className="flex items-center gap-2">
            {steps.map((s, i) => {
              const state = step > s.n ? "done" : step === s.n ? "active" : "todo";
              return (
                <React.Fragment key={s.n}>
                  {i > 0 && <div className={cn("h-px flex-1", step > s.n ? "bg-foreground/30" : "bg-border")} />}
                  <button
                    type="button"
                    onClick={() => s.n < step && setStep(s.n)}
                    disabled={s.n >= step}
                    className={cn(
                      "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors",
                      state === "active" && "bg-accent text-accent-foreground",
                      state === "done" && "text-foreground/80 hover:bg-accent/60",
                      state === "todo" && "text-muted-foreground/70",
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-4 items-center justify-center rounded-full text-[9px] font-bold",
                        state === "active" ? "bg-foreground text-background" : state === "done" ? "bg-foreground/20 text-foreground" : "bg-muted text-muted-foreground",
                      )}
                    >
                      {s.n}
                    </span>
                    {s.label}
                  </button>
                </React.Fragment>
              );
            })}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5 pt-4">
          {/* Step 1 — Connect */}
          {step === 1 && (
            <div className="animate-in fade-in-0">
              {/* Popular providers */}
              <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Popular providers</p>
              <div className="mb-3 flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1 snap-x">
                {PRESETS.map((p) => {
                  const isActive = activeProvider?.baseUrl === p.baseUrl;
                  return (
                    <button
                      key={p.name}
                      type="button"
                      onClick={() => applyPreset(p)}
                      title={`${p.name} · ${p.info}`}
                      className={cn(
                        "flex shrink-0 snap-start items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-medium transition-colors",
                        isActive
                          ? "border-indigo-500/40 bg-indigo-500/10 text-indigo-200"
                          : "border-border bg-background/40 text-muted-foreground hover:bg-accent hover:text-foreground",
                      )}
                    >
                      <span>{p.name}</span>
                      <span className={cn("text-[9px] font-semibold uppercase tracking-wide", p.info === "Paid" ? "text-muted-foreground/60" : "text-emerald-400")}>
                        {p.info}
                      </span>
                    </button>
                  );
                })}
              </div>

              {models.length > 0 && (
                <div className="mb-5">
                  <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Connected</p>
                  <div className="flex flex-col gap-2">
                    {models.map((m) => (
                      <div key={m.id} className="flex items-center gap-3 rounded-xl border border-border bg-background/40 px-3.5 py-2.5">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] font-semibold text-foreground">{m.name}</p>
                          <p className="truncate text-[11px] text-muted-foreground">{m.model} · {m.baseUrl.replace(/^https?:\/\//, "").replace(/\/+$/, "")}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => void remove(m.id)}
                          disabled={busy}
                          className="shrink-0 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-red-500/10 hover:text-red-400 disabled:opacity-50"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Model details</p>
              <div className="flex flex-col gap-2 rounded-xl border border-border bg-background/30 p-3">
                <div>
                  <input className={fieldCls("name")} placeholder="Give this model a name" value={name} onChange={(e) => { setName(e.target.value); setMissing((m) => ({ ...m, name: false })); }} />
                  {missing.name && <p className="mt-1 text-[10.5px] font-medium text-red-400">Name is required.</p>}
                </div>
                <div>
                  <input className={fieldCls("baseUrl")} placeholder="API base URL · https://your-provider.example.com/v1" value={baseUrl} onChange={(e) => { setBaseUrl(e.target.value); setMissing((m) => ({ ...m, baseUrl: false })); }} />
                  {missing.baseUrl && <p className="mt-1 text-[10.5px] font-medium text-red-400">Base URL is required.</p>}
                </div>
                <div>
                  <input className={fieldCls("model")} placeholder="Model ID · your-model-v1" value={model} onChange={(e) => { setModel(e.target.value); setMissing((m) => ({ ...m, model: false })); }} />
                  {missing.model && <p className="mt-1 text-[10.5px] font-medium text-red-400">Model ID is required.</p>}
                </div>
                <div>
                  <div className="relative">
                    <input
                      ref={firstInputRef}
                      className={cn(fieldCls("key"), "pe-16 font-mono")}
                      type={showKey ? "text" : "password"}
                      placeholder="API key"
                      value={key}
                      onChange={(e) => { setKey(e.target.value); setMissing((m) => ({ ...m, key: false })); }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowKey((v) => !v)}
                      className="absolute end-2 top-1/2 -translate-y-1/2 rounded-md px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {showKey ? "Hide" : "Show"}
                    </button>
                  </div>
                  {missing.key && <p className="mt-1 text-[10.5px] font-medium text-red-400">API key is required.</p>}
                </div>
              </div>

              {testing && <TrustTimeline />}

              {error && (
                <div className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 text-[12px] leading-relaxed text-red-300">{error}</div>
              )}

              {showLegend && <ResultsLegend />}
            </div>
          )}

          {/* Step 2 — Verify */}
          {step === 2 && (
            <div className="animate-in fade-in-0">
              <p className="text-sm font-medium text-foreground">Verify the connection</p>
              <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                We send a tiny request to <span className="font-medium text-foreground">{model.trim() || "your model"}</span> using an encrypted key. Nothing is saved yet.
              </p>

              {testing && <TrustTimeline />}

              {testResult && meta && (
                <div className={cn("mt-3 flex items-start gap-2.5 rounded-xl border px-3.5 py-2.5 text-[12.5px]", TONE_CLS[meta.tone])}>
                  <span className="mt-0.5 rounded bg-black/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold">
                    {testResult.status ?? "—"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">
                      {meta.title} {meta.tone === "ok" && testResult.ms != null && `(${testResult.ms}ms)`}
                    </p>
                    <p className="mt-0.5 leading-relaxed opacity-90">{testResult.message ?? meta.detail}</p>
                  </div>
                </div>
              )}

              {isVerified && !testing && (
                <p className="mt-3 text-[12px] font-medium text-emerald-400">Verified — this model is ready to save.</p>
              )}

              {showLegend && <ResultsLegend />}

              {error && (
                <div className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 text-[12px] leading-relaxed text-red-300">{error}</div>
              )}
            </div>
          )}

          {/* Step 3 — Done */}
          {step === 3 && (
            <div className="animate-in fade-in-0 py-4 text-center">
              <div className="mx-auto w-fit rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-1.5 text-[11px] font-bold uppercase tracking-wide text-emerald-400">
                Connected
              </div>
              <p className="mt-3 text-base font-semibold text-foreground">Model connected</p>
              <p className="mx-auto mt-1 max-w-xs text-[13px] leading-relaxed text-muted-foreground">
                <span className="font-medium text-foreground">{name.trim() || "Your model"}</span> is saved and ready to use in chat. Your API key stays encrypted.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-border/70 bg-background/40 px-5 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          {step === 1 && (
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setShowLegend((v) => !v)} className="shrink-0 px-2 text-xs font-medium text-muted-foreground underline decoration-muted-foreground/40 underline-offset-4 transition-colors hover:text-foreground">
                How results work
              </button>
              <button
                type="button"
                onClick={() =>
                  void (async () => {
                    const m = missingNow();
                    setMissing(m);
                    if (Object.values(m).some(Boolean)) {
                      return;
                    }
                    await runTest();
                    setStep(2);
                  })()
                }
                disabled={testing}
                className={primaryBtnCls}
              >
                {testing ? (testStage === "encrypting" ? "Encrypting…" : "Sending…") : "Test & verify"}
              </button>
            </div>
          )}
          {step === 2 && (
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setStep(1)} disabled={testing || busy} className={secondaryBtnCls}>
                Back
              </button>
              <button type="button" onClick={() => setShowLegend((v) => !v)} className="shrink-0 px-2 text-xs font-medium text-muted-foreground underline decoration-muted-foreground/40 underline-offset-4 transition-colors hover:text-foreground">
                How results work
              </button>
              {isVerified ? (
                <button type="button" onClick={() => void save()} disabled={busy} className={primaryBtnCls}>
                  {busy ? "Saving…" : "Save model"}
                </button>
              ) : (
                <button type="button" onClick={() => void runTest()} disabled={testing} className={primaryBtnCls}>
                  {testing ? (testStage === "encrypting" ? "Encrypting…" : "Sending…") : "Try again"}
                </button>
              )}
            </div>
          )}
          {step === 3 && (
            <div className="flex items-center gap-2">
              <button type="button" onClick={resetForm} className={secondaryBtnCls}>
                Add another
              </button>
              <button type="button" onClick={onClose} className={primaryBtnCls}>
                Done
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
