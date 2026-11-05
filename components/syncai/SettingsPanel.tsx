"use client";

import React, { useState } from "react";
import {
  ArrowLeft,
  AtSign,
  Coins,
  Database,
  Gauge,
  KeyRound,
  LogOut,
  Mail,
  Palette,
  Play,
  Plug,
  Shield,
  ShieldAlert,
  Sparkles,
  User,
  Users,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SyncAILogo } from "./SyncAILogo";
import type { UserProfile } from "@/services/firebaseClient";

type Section = "profile" | "security" | "sessions" | "connections" | "members" | "capabilities" | "tokens" | "activity";

type NavIcon = React.ComponentType<{ size?: number; className?: string }>;

const ACCOUNT_ITEMS: Array<{ id: Section; label: string; icon: NavIcon }> = [
  { id: "profile", label: "Profile", icon: User },
  { id: "security", label: "Security", icon: Shield },
  { id: "sessions", label: "Sessions", icon: AtSign },
  { id: "connections", label: "Connections", icon: Plug },
];

const ORG_ITEMS: Array<{ id: Section; label: string; icon: NavIcon }> = [
  { id: "members", label: "Members", icon: Users },
  { id: "capabilities", label: "Capabilities", icon: Gauge },
  { id: "tokens", label: "API tokens", icon: KeyRound },
  { id: "activity", label: "Activity", icon: ActivityIcon },
];

function ActivityIcon(props: { size?: number; className?: string }) {
  return <Zap size={props.size ?? 14} className={props.className} />;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-1.5 mt-4 px-1 text-[9px] font-bold uppercase tracking-[0.14em] text-muted-foreground/70 first:mt-0">
      {children}
    </p>
  );
}

function NavButton({
  active,
  onClick,
  icon: Icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: NavIcon;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-left text-[13px] font-medium transition-colors",
        active ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
      )}
    >
      <Icon size={15} className="shrink-0" />
      {children}
    </button>
  );
}

export const SettingsPanel: React.FC<{
  user: UserProfile | null;
  onBack: () => void;
  onManageModels: () => void;
  onSignOut: () => void;
  initialSection?: Section;
}> = ({ user, onBack, onManageModels, onSignOut, initialSection = "profile" }) => {
  const [section, setSection] = useState<Section>(initialSection);
  const avatarSrc =
    user?.photoURL ??
    `https://api.dicebear.com/9.x/thumbs/svg?seed=${encodeURIComponent(user?.uid ?? "syncai-guest")}`;

  return (
    <div className="flex min-h-0 flex-1 flex-col md:flex-row">
      {/* Left nav (settings) */}
      <div className="hidden w-48 shrink-0 flex-col gap-0.5 border-r border-border/70 p-3 md:flex">
        <SectionLabel>Account</SectionLabel>
        {ACCOUNT_ITEMS.map((i) => (
          <NavButton key={i.id} active={section === i.id} onClick={() => setSection(i.id)} icon={i.icon}>
            {i.label}
          </NavButton>
        ))}
        <SectionLabel>Organization</SectionLabel>
        {ORG_ITEMS.map((i) => (
          <NavButton key={i.id} active={section === i.id} onClick={() => setSection(i.id)} icon={i.icon}>
            {i.label}
          </NavButton>
        ))}
      </div>

      {/* Mobile top nav */}
      <div className="flex gap-1.5 overflow-x-auto border-b border-border/70 p-2 md:hidden">
        {[...ACCOUNT_ITEMS, ...ORG_ITEMS].map((i) => {
          const Icon = i.icon;
          const active = section === i.id;
          return (
            <button
              key={i.id}
              type="button"
              onClick={() => setSection(i.id)}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[11px] font-semibold transition-colors",
                active ? "border-border bg-accent text-accent-foreground" : "border-border text-muted-foreground"
              )}
            >
              <Icon size={12} /> {i.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1 overflow-y-auto p-4 md:p-6">
        <div className="mb-5 flex items-center gap-2">
          <button
            type="button"
            onClick={onBack}
            aria-label="Back to chat"
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <ArrowLeft size={16} />
          </button>
          <h2 className="text-base font-semibold tracking-tight text-foreground">Settings</h2>
        </div>

        {section === "profile" && (
          <div className="max-w-lg">
            <ProfilePanel avatarSrc={avatarSrc} user={user} />
            <DetailRow icon={Mail} label="Email" value={user?.email ?? "—"} />
            <DetailRow icon={AtSign} label="User ID" value={user?.uid ?? "guest"} mono />
          </div>
        )}

        {section === "security" && (
          <div className="max-w-lg">
            <SecurityPanel onSignOut={onSignOut} />
          </div>
        )}

        {section === "sessions" && (
          <div className="max-w-lg">
            <SessionsPanel user={user} />
          </div>
        )}

        {section === "connections" && (
          <div className="max-w-lg">
            <ConnectionsPanel onManageModels={onManageModels} />
          </div>
        )}

        {section === "members" && <MembersPanel />}
        {section === "capabilities" && <CapabilitiesPanel />}
        {section === "tokens" && <TokensPanel />}
        {section === "activity" && <ActivityPanel />}
      </div>
    </div>
  );
};

const DetailRow: React.FC<{ icon: typeof Mail; label: string; value: string; mono?: boolean }> = ({ icon: Icon, label, value, mono }) => (
  <div className="flex items-center gap-3 border-b border-border/50 px-1 py-2.5">
    <span className="flex size-8 items-center justify-center rounded-lg bg-muted/50 text-muted-foreground">
      <Icon size={14} />
    </span>
    <div className="min-w-0 flex-1">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className={cn("truncate text-[13px] font-medium text-foreground", mono && "font-mono text-[12px]")}>{value}</p>
    </div>
  </div>
);

const ProfilePanel: React.FC<{ avatarSrc: string; user: UserProfile | null }> = ({ avatarSrc, user }) => (
  <div className="mb-5 rounded-2xl border border-border bg-card p-5">
    <div className="flex items-center gap-4">
      <img src={avatarSrc} alt="" className="size-14 rounded-2xl border border-border bg-background/60" />
      <div className="min-w-0">
        <p className="truncate text-base font-semibold text-foreground">{user?.displayName ?? user?.email ?? "SyncAI user"}</p>
        <p className="text-xs text-muted-foreground">{user?.email ?? "Signed in"}</p>
      </div>
    </div>
    <div className="mt-4 flex items-center gap-2 rounded-xl border border-border bg-muted/30 px-3 py-2.5">
      <SyncAILogo className="size-4" variant="light" />
      <span className="text-xs text-muted-foreground">
        Your avatar and history are stored per workspace. Model keys stay encrypted — only the model sees them.
      </span>
    </div>
  </div>
);

const SecurityPanel: React.FC<{ onSignOut: () => void }> = ({ onSignOut }) => (
  <div className="flex flex-col gap-3">
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-red-500/10 text-red-400">
          <ShieldAlert size={16} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">Sign out everywhere</p>
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
            Ends your current session on this device. Access to chats, models, and history will require signing in again.
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={onSignOut}
        className="mt-4 flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 text-[12.5px] font-semibold text-red-400 transition-colors hover:bg-red-500/20"
      >
        <LogOut size={14} /> Sign out
      </button>
    </div>
    <div className="rounded-2xl border border-border bg-muted/20 px-4 py-3">
      <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
        <Shield size={12} /> Password &amp; sign-in
      </p>
      <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
        Manage your password and connected sign-in methods (Email/Password, Google) from the Firebase console — SyncAI only stores the
        encrypted view of your data.
      </p>
    </div>
  </div>
);

const SessionsPanel: React.FC<{ user: UserProfile | null }> = ({ user }) => (
  <div className="rounded-2xl border border-border bg-card p-5">
    <p className="text-sm font-semibold text-foreground">Current session</p>
    <div className="mt-3">
      <DetailRow icon={AtSign} label="User ID" value={user?.uid ?? "guest"} mono />
      <DetailRow icon={Mail} label="Email" value={user?.email ?? "—"} />
    </div>
    <p className="mt-3 flex items-start gap-1.5 text-[11px] leading-relaxed text-muted-foreground">
      <InfoLine /> Your session tokens refresh automatically every hour. Sign out to end it.
    </p>
  </div>
);

const ConnectionsPanel: React.FC<{ onManageModels: () => void }> = ({ onManageModels }) => (
  <div className="flex flex-col gap-3">
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center gap-2">
        <span className="flex size-9 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-300">
          <Sparkles size={16} />
        </span>
        <div>
          <p className="text-sm font-semibold text-foreground">Your models</p>
          <p className="text-xs text-muted-foreground">Bring your own OpenAI-compatible endpoint</p>
        </div>
      </div>
      <button
        type="button"
        onClick={onManageModels}
        className="mt-4 flex h-9 w-full items-center justify-center gap-1.5 rounded-lg bg-foreground px-2.5 text-[12.5px] font-semibold text-background transition-opacity hover:opacity-90"
      >
        <KeyRound size={14} /> Manage my models
      </button>
      <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground/80">
        API keys are encrypted in your browser (RSA-OAEP) before upload. The server stores ciphertext only.
      </p>
    </div>
    <div className="rounded-2xl border border-border bg-muted/20 px-4 py-3">
      <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
        <Database size={12} /> Backend
      </p>
      <p className="mt-1.5 text-xs text-muted-foreground">Default providers: Groq (chat) and YouTube Data API v3 (videos).</p>
    </div>
  </div>
);

const MembersPanel: React.FC = () => (
  <div className="max-w-lg rounded-2xl border border-border bg-card p-5">
    <p className="text-sm font-semibold text-foreground">Workspace members</p>
    <p className="mt-1 text-xs text-muted-foreground">SyncAI workspaces are single-user in this build.</p>
    <div className="mt-3 flex items-center gap-2.5 rounded-xl border border-border bg-muted/30 px-3 py-2.5">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-indigo-500/15 text-[11px] font-bold text-indigo-300">
        You
      </span>
      <span className="text-[13px] font-medium text-foreground">Owner</span>
      <span className="ml-auto text-[11px] text-muted-foreground">Only member</span>
    </div>
  </div>
);

const CapabilitiesPanel: React.FC = () => (
  <div className="max-w-lg rounded-2xl border border-border bg-card p-5">
    <p className="text-sm font-semibold text-foreground">Capabilities</p>
    <p className="mt-1 text-xs text-muted-foreground">What's enabled for this workspace.</p>
    <div className="mt-3 flex flex-col gap-2">
      <CapRow icon={Zap} label="AI study chat" desc="Grounded answers from VTUSync resources" on />
      <CapRow icon={Play} label="YouTube videos" desc="External lecture search (YouTube Data API v3)" on />
      <CapRow icon={Sparkles} label="BYO model keys" desc="Encrypt & store your own API keys" on />
      <CapRow icon={Palette} label="Dark mode" desc="Dark zinc theme (assistant-ui style)" on />
    </div>
  </div>
);

const CapRow: React.FC<{ icon: NavIcon; label: string; desc: string; on: boolean }> = ({ icon: Icon, label, desc, on }) => (
  <div className="flex items-center gap-3 rounded-xl border border-border bg-background/40 px-3 py-2.5">
    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted/50 text-muted-foreground">
      <Icon size={14} />
    </span>
    <div className="min-w-0 flex-1">
      <p className="text-[13px] font-medium text-foreground">{label}</p>
      <p className="truncate text-[11px] text-muted-foreground">{desc}</p>
    </div>
    <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide", on ? "bg-emerald-500/10 text-emerald-400" : "bg-muted text-muted-foreground")}>
      {on ? "On" : "Off"}
    </span>
  </div>
);

const TokensPanel: React.FC = () => (
  <div className="flex max-w-lg flex-col gap-3">
    <div className="rounded-2xl border border-border bg-card p-5">
      <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
        <Coins size={12} /> Providers
      </p>
      <div className="mt-2">
        <DetailRow icon={Sparkles} label="Groq" value="Server key (SYNCAI_MODEL default)" />
        <DetailRow icon={Plug} label="YouTube Data API v3" value="Server key" />
      </div>
    </div>
    <div className="rounded-2xl border border-border bg-muted/20 px-4 py-3">
      <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
        <KeyRound size={12} /> Your keys
      </p>
      <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
        Keys you add via "My models" are RSA-encrypted in your browser and decrypted only in-memory for the request — never stored in plaintext.
      </p>
    </div>
  </div>
);

const ActivityPanel: React.FC = () => (
  <div className="max-w-lg rounded-2xl border border-border bg-card p-5">
    <p className="text-sm font-semibold text-foreground">Activity</p>
    <p className="mt-1 text-xs text-muted-foreground">Recent SyncAI activity in this workspace.</p>
    <ul className="mt-3 flex flex-col gap-2">
      {["Signed in", "Opened AI Chat", "Generated a PYQ analysis", "Updated model preference"].map((a, i) => (
        <li key={i} className="flex items-center gap-2.5 rounded-lg border border-border/70 bg-background/40 px-3 py-2 text-[12.5px] text-foreground">
          <span className="size-1.5 shrink-0 rounded-full bg-emerald-400" />
          {a}
        </li>
      ))}
    </ul>
  </div>
);

const InfoLine: React.FC = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mt-0.5 shrink-0">
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="16" x2="12" y2="12" />
    <line x1="12" y1="8" x2="12.01" y2="8" />
  </svg>
);
