import React, { useState } from "react";
import { AlertTriangle, Loader2, Sparkles, X } from "lucide-react";
import { firebaseConfigured, signIn, signUp, signInWithGoogle } from "@/services/firebaseClient";
import { SyncAILogo } from "@/components/syncai/SyncAILogo";

export const AuthScreen: React.FC = () => {
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (busy) return;
    if (!email.trim() || password.length < 6) {
      setError("Enter a valid email and a password of at least 6 characters.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (mode === "up") await signUp(email.trim(), password);
      else await signIn(email.trim(), password);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Authentication failed.");
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    setBusy(true);
    setError(null);
    try {
      await signInWithGoogle();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Google sign-in failed. Authorize localhost in Firebase console.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4 text-foreground">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <span className="mb-3 flex size-14 items-center justify-center rounded-2xl bg-indigo-500/10 ring-1 ring-inset ring-indigo-500/20">
            <SyncAILogo className="size-7" variant="light" />
          </span>
          <h1 className="text-2xl font-bold tracking-tight">SyncAI</h1>
          <p className="mt-1 text-sm text-muted-foreground">Sign in to save your own models &amp; history</p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="mb-4 flex rounded-xl border border-border p-0.5">
            <button
              type="button"
              onClick={() => { setMode("in"); setError(null); }}
              className={`flex-1 rounded-lg py-2 text-sm font-semibold transition-colors ${mode === "in" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"}`}
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => { setMode("up"); setError(null); }}
              className={`flex-1 rounded-lg py-2 text-sm font-semibold transition-colors ${mode === "up" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"}`}
            >
              Create account
            </button>
          </div>

          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className="mb-2 w-full rounded-xl border border-border bg-background/60 px-3.5 py-2.5 text-sm outline-none placeholder:text-muted-foreground/60 focus:border-foreground/30"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") void submit(); }}
            placeholder="Password"
            className="mb-4 w-full rounded-xl border border-border bg-background/60 px-3.5 py-2.5 text-sm outline-none placeholder:text-muted-foreground/60 focus:border-foreground/30"
          />

          {error && (
            <div className="mb-3 flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-[12.5px] text-red-300">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              <span className="min-w-0 flex-1">{error}</span>
              <button type="button" onClick={() => setError(null)} aria-label="Dismiss" className="rounded p-0.5 hover:bg-red-500/20">
                <X size={13} />
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={() => void submit()}
            disabled={busy}
            className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-foreground text-sm font-semibold text-background transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
            {mode === "up" ? "Create account" : "Sign in"}
          </button>

          <div className="my-4 flex items-center gap-3">
            <span className="h-px flex-1 bg-border" />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">or</span>
            <span className="h-px flex-1 bg-border" />
          </div>

          <button
            type="button"
            onClick={() => void google()}
            disabled={busy || !firebaseConfigured}
            className="flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-border text-sm font-semibold text-foreground transition-colors hover:bg-accent disabled:opacity-50"
          >
            <GLogo />
            Continue with Google
          </button>
        </div>

        <p className="mt-4 text-center text-[11px] text-muted-foreground">
          You must be signed in to use SyncAI.
        </p>
      </div>
    </div>
  );
};

const GLogo: React.FC = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" />
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
    <path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18A10.97 10.97 0 0 0 1 12c0 1.77.43 3.45 1.18 4.94l3.66-2.84z" />
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
  </svg>
);
