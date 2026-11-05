import React, { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Check, Loader2, Plus, Trash2, X } from "lucide-react";
import { syncAI, SyncAIApiError, type CustomModelMeta } from "@/services/syncAIService";
import { encryptWithPublicKey } from "@/lib/crypto";

export const ModelsModal: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  const [models, setModels] = useState<CustomModelMeta[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [model, setModel] = useState("");
  const [key, setKey] = useState("");

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
    "w-full rounded-xl border border-border bg-background/60 px-3.5 py-2.5 text-sm outline-none placeholder:text-muted-foreground/60 focus:border-foreground/30";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 p-4 backdrop-blur-sm" role="dialog" aria-modal="true">
      <div className="max-h-[86vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/5 bg-popover p-5 shadow-2xl shadow-black/50">
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
