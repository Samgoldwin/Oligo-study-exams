import React, { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  Check,
  FlaskConical,
  Info,
  Loader2,
  Plus,
  Trash2,
  X,
} from "lucide-react";
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

const VERDICT_META: Record<
  ModelTestVerdict,
  { icon: string; tone: "ok" | "bad" | "warn" | "muted"; title: string; detail: string }
> = {
  ok: {
    icon: "✓",
    tone: "ok",
    title: "Success!",
    detail: "The API key is valid and working perfectly.",
  },
  invalid: {
    icon: "✗",
    tone: "bad",
    title: "Invalid",
    detail: "The key is incorrect, revoked, or lacks required permissions.",
  },
  no_balance: {
    icon: "⚠️",
    tone: "warn",
    title: "No Balance",
    detail: "The key is valid, but your account has insufficient balance or expired credits.",
  },
  rate_limit: {
    icon: "⚠️",
    tone: "warn",
    title: "Rate Limit",
    detail: "You are testing too fast. Please wait a bit before trying again.",
  },
  failed: {
    icon: "✗",
    tone: "bad",
    title: "Failed",
    detail: "Internal server error on the provider's side or network timeout.",
  },
  unknown: {
    icon: "—",
    tone: "muted",
    title: "Unknown",
    detail: "Testing is not yet supported for this specific provider.",
  },
};

const TONE_CLS: Record<"ok" | "bad" | "warn" | "muted", string> = {
  ok: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  bad: "border-red-500/30 bg-red-500/10 text-red-300",
  warn: "border-amber-500/30 bg-amber-500/10 text-amber-200",
  muted: "border-border bg-muted/30 text-muted-foreground",
};

export const ModelsModal: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  const [models, setModels] = useState<CustomModelMeta[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [model, setModel] = useState("");
  const [key, setKey] = useState("");

  const [testStage, setTestStage] = useState<TestStage>("idle");
  const [testResult, setTestResult] = useState<ModelTestResult | null>(null);
  const [showLegend, setShowLegend] = useState(false);
  const testing = testStage === "encrypting" || testStage === "sending";

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
      setOk(null);
      setTestStage("idle");
      setTestResult(null);
      void refresh();
    }
  }, [open, refresh]);

  if (!open) return null;

  const save = async () => {
    if (!name.trim() || !baseUrl.trim() || !model.trim() || !key.trim()) {
      setError("Fill in all fields (name, base URL, model, API key).");
      return;
    }
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      const { publicKey } = await syncAI.getPublicKey();
      const encryptedKey = await encryptWithPublicKey(publicKey, key.trim());
      await syncAI.saveCustomModel({ name: name.trim(), baseUrl: baseUrl.trim(), model: model.trim(), encryptedKey });
      setKey("");
      setName("");
      setBaseUrl("");
      setModel("");
      setTestStage("idle");
      setTestResult(null);
      setOk("Model saved. Your API key is encrypted — we never see it in plaintext.");
      await refresh();
    } catch (e) {
      setError(e instanceof SyncAIApiError || e instanceof Error ? e.message : "Could not save the model.");
    } finally {
      setBusy(false);
    }
  };

  const test = async () => {
    if (!baseUrl.trim() || !model.trim() || !key.trim()) {
      setError("Fill in Base URL, model, and API key to test the connection.");
      return;
    }
    setError(null);
    setOk(null);
    setTestResult(null);
    setTestStage("encrypting");
    try {
      const { publicKey } = await syncAI.getPublicKey();
      const encryptedKey = await encryptWithPublicKey(publicKey, key.trim());
      setTestStage("sending");
      const result = await syncAI.testCustomModel({
        baseUrl: baseUrl.trim(),
        model: model.trim(),
        encryptedKey,
      });
      setTestResult(result);
    } catch (e) {
      setTestResult({
        ok: false,
        status: null,
        verdict: "unknown",
        ms: 0,
        message: e instanceof Error ? e.message : "Test failed.",
      });
    } finally {
      setTestStage("done");
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

  const inputCls =
    "w-full rounded-xl border border-border bg-background/60 px-3.5 py-2.5 text-sm outline-none placeholder:text-muted-foreground/60 focus:border-foreground/30";

  const meta = testResult ? VERDICT_META[testResult.verdict] : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 p-4 backdrop-blur-sm" role="dialog" aria-modal="true">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/5 bg-popover p-5 shadow-2xl shadow-black/50">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold text-popover-foreground">My models</h3>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
            <X size={16} />
          </button>
        </div>

        <div className="mb-1 text-[11px] leading-relaxed text-muted-foreground">
          Bring your own compatible endpoint (OpenAI-compatible <code className="font-mono">/chat/completions</code>). Your API key is
          encrypted in the browser with our RSA public key before upload — the server only ever stores ciphertext and decrypts it
          in-memory for the request.
        </div>

        {models.length > 0 && (
          <div className="mb-4 flex flex-col gap-2">
            {models.map((m) => (
              <div key={m.id} className="flex items-center gap-2.5 rounded-xl border border-border bg-background/40 px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13.5px] font-semibold text-foreground">{m.name}</p>
                  <p className="truncate text-[11px] text-muted-foreground">{m.model} · {m.baseUrl}</p>
                </div>
                <button type="button" onClick={() => void remove(m.id)} disabled={busy} aria-label="Delete model" className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-red-500/10 hover:text-red-400 disabled:opacity-50">
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Add a model</div>
        <input className={inputCls} placeholder="Name (e.g. My Groq)" value={name} onChange={(e) => setName(e.target.value)} />
        <input className={`${inputCls} mt-2`} placeholder="Base URL (e.g. https://api.groq.com)" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} />
        <input className={`${inputCls} mt-2`} placeholder="Model (e.g. llama-3.3-70b-versatile)" value={model} onChange={(e) => setModel(e.target.value)} />
        <input className={`${inputCls} mt-2 font-mono`} type="password" placeholder="API key (encrypted before upload)" value={key} onChange={(e) => setKey(e.target.value)} />

        {/* Playground: test before saving */}
        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={() => void test()}
            disabled={testing}
            className="flex h-9 flex-1 items-center justify-center gap-2 rounded-xl border border-indigo-500/30 bg-indigo-500/10 text-[13px] font-semibold text-indigo-200 transition-colors hover:bg-indigo-500/20 disabled:opacity-50"
          >
            {testing ? <Loader2 size={15} className="animate-spin" /> : <FlaskConical size={15} />}
            Test connection
          </button>
          <button
            type="button"
            onClick={() => setShowLegend((v) => !v)}
            aria-label="Understanding test results"
            aria-expanded={showLegend}
            className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-border bg-background/40 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <Info size={15} />
          </button>
        </div>

        {testing && (
          <div className="mt-3 flex items-center gap-2.5 rounded-xl border border-indigo-500/25 bg-indigo-500/10 px-3.5 py-2.5 text-[12.5px] text-indigo-200">
            <Loader2 size={15} className="shrink-0 animate-spin" />
            <span>
              {testStage === "encrypting" ? "Encrypting your API key…" : "Sending request securely…"}
            </span>
          </div>
        )}

        {testResult && meta && (
          <div className={cn("mt-3 flex items-start gap-2.5 rounded-xl border px-3.5 py-2.5 text-[12.5px]", TONE_CLS[meta.tone])}>
            <span className="mt-0.5 shrink-0 text-sm font-bold">{meta.icon}</span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold">
                {testResult.status ?? "Unknown"} · {meta.title} {meta.tone === "ok" && testResult.ms != null && `(${testResult.ms}ms)`}
              </p>
              <p className="mt-0.5 leading-relaxed opacity-90">{testResult.message ?? meta.detail}</p>
            </div>
          </div>
        )}

        {/* Understanding Test Results legend (revealed via the info button) */}
        {showLegend && (
          <div className="mt-3 rounded-xl border border-border bg-muted/25 px-3.5 py-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Understanding test results</p>
            <ul className="mt-2 flex flex-col gap-1.5 text-[11.5px] leading-snug text-muted-foreground">
              <li><span className="font-semibold text-emerald-400">200:</span> ✓ <span className="font-medium text-foreground">Success!</span> The API key is valid and working perfectly.</li>
              <li><span className="font-semibold text-red-400">401/403:</span> ✗ <span className="font-medium text-foreground">Invalid</span> — The key is incorrect, revoked, or lacks required permissions.</li>
              <li><span className="font-semibold text-amber-300">402:</span> ⚠️ <span className="font-medium text-foreground">No Balance</span> — The key is valid, but your account has insufficient balance or expired credits.</li>
              <li><span className="font-semibold text-amber-300">429:</span> ⚠️ <span className="font-medium text-foreground">Rate Limit</span> — You are testing too fast. Please wait a bit before trying again.</li>
              <li><span className="font-semibold text-red-400">500/502/503:</span> ✗ <span className="font-medium text-foreground">Failed</span> — Internal server error on the provider's side or network timeout.</li>
              <li><span className="font-semibold text-muted-foreground">Unknown:</span> — — Testing is not yet supported for this specific provider.</li>
            </ul>
          </div>
        )}

        {error && (
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-[12px] text-red-300">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" /> <span>{error}</span>
          </div>
        )}
        {ok && (
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-[12px] text-emerald-300">
            <Check size={14} className="mt-0.5 shrink-0" /> <span>{ok}</span>
          </div>
        )}

        <button
          type="button"
          onClick={() => void save()}
          disabled={busy}
          className="mt-4 flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-foreground text-sm font-semibold text-background transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
          Save model
        </button>
      </div>
    </div>
  );
};
