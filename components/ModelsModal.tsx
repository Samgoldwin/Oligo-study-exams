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

function hostOf(baseUrl: string): string {
  try {
    return new URL(baseUrl).host.replace(/^www\./, "");
  } catch {
    return baseUrl;
  }
}

function sigOf(baseUrl: string, model: string, key: string): string {
  return `${baseUrl.trim()}|${model.trim()}|${key.trim()}`;
}

export const ModelsModal: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  const [models, setModels] = useState<CustomModelMeta[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [model, setModel] = useState("");
  const [key, setKey] = useState("");
  const [showKey, setShowKey] = useState(false);

  const [testStage, setTestStage] = useState<TestStage>("idle");
  const [testResult, setTestResult] = useState<ModelTestResult | null>(null);
  const [showLegend, setShowLegend] = useState(false);
  const [verifiedSig, setVerifiedSig] = useState<string | null>(null);
  const testing = testStage === "encrypting" || testStage === "sending";
  const currentSig = sigOf(baseUrl, model, key);
  const isVerified = verifiedSig === currentSig && currentSig !== "||" && Boolean(baseUrl && model && key);

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
      setOk(null);
      setTestStage("idle");
      setTestResult(null);
      setShowLegend(false);
      setVerifiedSig(null);
      void refresh();
      const t = setTimeout(() => firstInputRef.current?.focus(), 60);
      return () => clearTimeout(t);
    }
  }, [open, refresh]);

  if (!open) return null;

  const runTest = async (): Promise<boolean> => {
    if (!baseUrl.trim() || !model.trim() || !key.trim()) {
      setError("Fill in Base URL, model, and API key to test the connection.");
      return false;
    }
    setError(null);
    setOk(null);
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
    if (!name.trim() || !baseUrl.trim() || !model.trim() || !key.trim()) {
      setError("Fill in all fields (name, base URL, model, API key).");
      return;
    }
    if (!isVerified) {
      const passed = await runTest();
      if (!passed) {
        setError("Connection not verified. Fix the issue above, then save again.");
        return;
      }
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
      setVerifiedSig(null);
      setOk("Model saved. Your API key is encrypted — we never see it in plaintext.");
      await refresh();
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

  const inputCls =
    "w-full rounded-xl border border-border bg-background/60 px-3.5 py-2.5 text-sm outline-none transition-colors placeholder:text-muted-foreground/50 focus:border-foreground/30 focus:bg-background";
  const secondaryBtnCls =
    "flex h-9 flex-1 items-center justify-center rounded-xl border border-border bg-muted/40 text-[13px] font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-50";
  const meta = testResult ? VERDICT_META[testResult.verdict] : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-background/70 backdrop-blur-sm md:items-center md:p-4"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[92dvh] w-full max-w-lg flex-col rounded-t-2xl border border-white/5 bg-popover shadow-2xl shadow-black/50 animate-in slide-in-from-bottom-4 fade-in-0 md:max-h-[86vh] md:rounded-2xl md:animate-in md:fade-in-0 md:zoom-in-95">
        {/* Mobile grabber */}
        <div className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-muted-foreground/20 md:hidden" />

        {/* Header */}
        <div className="flex shrink-0 items-start justify-between gap-4 px-5 pt-4 pb-2">
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

        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5 pt-1">
          {/* Connected models */}
          {models.length > 0 && (
            <div className="mb-5">
              <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Connected</p>
              <div className="flex flex-col gap-2">
                {models.map((m) => (
                  <div key={m.id} className="flex items-center gap-3 rounded-xl border border-border bg-background/40 px-3.5 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-semibold text-foreground">{m.name}</p>
                      <p className="truncate text-[11px] text-muted-foreground">{m.model} · {hostOf(m.baseUrl)}</p>
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

          {/* Add a model */}
          <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Connect a model</p>
          <div className="flex flex-col gap-2 rounded-xl border border-border bg-background/30 p-3">
            <input className={inputCls} placeholder="Give this model a name" value={name} onChange={(e) => setName(e.target.value)} />
            <input className={inputCls} placeholder="API base URL · https://your-provider.example.com/v1" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} />
            <input className={inputCls} placeholder="Model ID · your-model-v1" value={model} onChange={(e) => setModel(e.target.value)} />
            <div className="relative">
              <input
                className={cn(inputCls, "pe-16 font-mono")}
                type={showKey ? "text" : "password"}
                placeholder="API key"
                value={key}
                onChange={(e) => setKey(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowKey((v) => !v)}
                className="absolute end-2 top-1/2 -translate-y-1/2 rounded-md px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                {showKey ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          {/* Actions */}
          <div className="mt-3 flex items-center gap-2">
            <button type="button" onClick={() => void runTest()} disabled={testing} className={secondaryBtnCls}>
              {testing ? (testStage === "encrypting" ? "Encrypting…" : "Sending…") : "Test connection"}
            </button>
            <button
              type="button"
              onClick={() => setShowLegend((v) => !v)}
              className="shrink-0 rounded-xl px-3 py-2 text-xs font-medium text-muted-foreground underline decoration-muted-foreground/40 underline-offset-4 transition-colors hover:text-foreground"
            >
              How results work
            </button>
          </div>

          {isVerified && (
            <p className="mt-2 text-[11px] font-medium text-emerald-400">Verified — connection is working.</p>
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
            <div className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 text-[12px] leading-relaxed text-red-300">{error}</div>
          )}
          {ok && (
            <div className="mt-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2.5 text-[12px] leading-relaxed text-emerald-300">{ok}</div>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-border/70 bg-background/40 px-5 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={() => void save()}
            disabled={busy || testing}
            className="flex h-10 w-full items-center justify-center rounded-xl bg-foreground text-sm font-semibold text-background transition-colors hover:opacity-90 disabled:opacity-50"
          >
            {busy ? "Saving…" : "Save model"}
          </button>
          <p className="mt-1.5 text-center text-[10.5px] text-muted-foreground/80">
            {isVerified ? "Verified — safe to save." : "We verify the connection before saving."}
          </p>
        </div>
      </div>
    </div>
  );
};
