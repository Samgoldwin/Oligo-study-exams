"use client";

import React, { useState } from "react";
import {
  ArrowLeft,
  AtSign,
  Coins,
  FileText,
  Gauge,
  KeyRound,
  LogOut,
  Mail,
  Play,
  Plug,
  Shield,
  Sparkles,
  User,
  Users,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { UserProfile } from "@/services/firebaseClient";
import type { CustomModelMeta } from "@/services/syncAIService";

export interface SettingsActivityItem {
  id: string;
  kind: "chat" | "pyq" | "model" | "signin";
  text: string;
  time: number;
}

type Section =
  | "profile"
  | "security"
  | "sessions"
  | "connections"
  | "members"
  | "capabilities"
  | "tokens"
  | "activity";

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
        active ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
      )}
    >
      <Icon size={15} className="shrink-0" />
      {children}
    </button>
  );
}

/** Compact assistant-ui-style setting card. */
function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-card">
      <header className="border-b border-border px-4 py-3 text-sm font-medium text-foreground">{title}</header>
      {children}
    </section>
  );
}

function Row({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-center gap-3 px-4 py-3", className)}>
      {children}
    </div>
  );
}

function IconChip({ icon: Icon, className }: { icon: NavIcon; className?: string }) {
  return (
    <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-md bg-muted/60 text-muted-foreground", className)}>
      <Icon size={15} />
    </span>
  );
}

function TextRow({
  icon: Icon,
  label,
  value,
}: {
  icon: NavIcon;
  label: string;
  value: string;
}) {
  return (
    <Row>
      <IconChip icon={Icon} />
      <div className="min-w-0 flex-1">
        <p className="text-[11px] text-muted-foreground">{label}</p>
        <p className="truncate text-[13px] font-medium text-foreground">{value}</p>
      </div>
    </Row>
  );
}

function Badge({ children, tone = "on" }: { children: React.ReactNode; tone?: "on" | "off" }) {
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
        tone === "on" ? "bg-emerald-500/10 text-emerald-400" : "bg-muted text-muted-foreground",
      )}
    >
      {children}
    </span>
  );
}

function hostOf(baseUrl: string): string {
  try {
    return new URL(baseUrl).host;
  } catch {
    return baseUrl;
  }
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000) return "just now";
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return days === 1 ? "yesterday" : `${days}d ago`;
}

export const SettingsPanel: React.FC<{
  user: UserProfile | null;
  customModels?: CustomModelMeta[];
  activity?: SettingsActivityItem[];
  onBack: () => void;
  onManageModels: () => void;
  onSignOut: () => void;
  initialSection?: Section;
}> = ({ user, customModels = [], activity = [], onBack, onManageModels, onSignOut, initialSection = "profile" }) => {
  const [section, setSection] = useState<Section>(initialSection);
  const avatarSrc =
    user?.photoURL ??
    `https://api.dicebear.com/9.x/thumbs/svg?seed=${encodeURIComponent(user?.uid ?? "syncai-guest")}`;

  const activityIcon: Record<SettingsActivityItem["kind"], NavIcon> = {
    chat: Zap,
    pyq: FileText,
    model: KeyRound,
    signin: User,
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col md:flex-row">
      {/* Left nav (settings) */}
      <div className="hidden w-52 shrink-0 flex-col gap-0.5 border-r border-border/70 p-3 md:flex">
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
                active ? "border-border bg-accent text-accent-foreground" : "border-border text-muted-foreground",
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

        <div className="max-w-xl space-y-4">
          {section === "profile" && (
            <>
              <section className="rounded-lg border border-border bg-card">
                <div className="flex items-center gap-3.5 px-4 py-4">
                  <img src={avatarSrc} alt="" className="size-12 rounded-full border border-border bg-background/60" />
                  <div className="min-w-0">
                    <p className="truncate text-[15px] font-semibold text-foreground">
                      {user?.displayName ?? user?.email ?? "SyncAI user"}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">{user?.email ?? "Signed in"}</p>
                  </div>
                </div>
                <div className="divide-y divide-border border-t border-border">
                  <TextRow icon={Mail} label="Email" value={user?.email ?? "—"} />
                  <TextRow icon={User} label="Account" value={user?.uid ? "Firebase account" : "Guest"} />
                </div>
              </section>
              <p className="px-1 text-xs leading-relaxed text-muted-foreground">
                Your chat history and saved analyses live in this workspace. Model keys stay encrypted — only the model sees them.
              </p>
            </>
          )}

          {section === "security" && (
            <Card title="Sign out">
              <Row className="flex-col items-start gap-2">
                <p className="text-[13px] leading-relaxed text-muted-foreground">
                  Ends your session on this device. Access to chats, models, and history will require signing in again.
                </p>
                <button
                  type="button"
                  onClick={onSignOut}
                  className="flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 text-[12.5px] font-semibold text-red-400 transition-colors hover:bg-red-500/20"
                >
                  <LogOut size={14} /> Sign out
                </button>
              </Row>
            </Card>
          )}

          {section === "sessions" && (
            <Card title="Sessions">
              <Row>
                <IconChip icon={AtSign} />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium text-foreground">This device</p>
                  <p className="text-xs text-muted-foreground">Active browser session</p>
                </div>
                <Badge>Active</Badge>
              </Row>
              <div className="border-t border-border px-4 py-3">
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Your session refreshes automatically. Sign out to end it.
                </p>
              </div>
            </Card>
          )}

          {section === "connections" && (
            <>
              <Card title="Connected models">
                {customModels.length === 0 ? (
                  <Row>
                    <IconChip icon={Plug} />
                    <p className="text-[13px] text-muted-foreground">No connected models yet.</p>
                  </Row>
                ) : (
                  customModels.map((m) => (
                    <Row key={m.id} className="border-t border-border first:border-t-0">
                      <IconChip icon={Plug} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-medium text-foreground">{m.name}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {m.model} · {hostOf(m.baseUrl)}
                        </p>
                      </div>
                    </Row>
                  ))
                )}
              </Card>
              <button
                type="button"
                onClick={onManageModels}
                className="flex h-9 w-full items-center justify-center gap-1.5 rounded-lg bg-foreground px-2.5 text-[12.5px] font-semibold text-background transition-opacity hover:opacity-90"
              >
                <KeyRound size={14} /> Manage my models
              </button>
            </>
          )}

          {section === "members" && (
            <Card title="Workspace members">
              <Row>
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-indigo-500/15 text-[11px] font-bold text-indigo-300">
                  You
                </span>
                <span className="text-[13px] font-medium text-foreground">You</span>
                <span className="ml-auto text-xs text-muted-foreground">Only member</span>
              </Row>
            </Card>
          )}

          {section === "capabilities" && (
            <Card title="Capabilities">
              <div className="divide-y divide-border">
                <Row className="border-t border-border first:border-t-0">
                  <IconChip icon={Zap} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium text-foreground">AI study chat</p>
                    <p className="text-xs text-muted-foreground">Grounded answers from VTUSync resources</p>
                  </div>
                  <Badge>On</Badge>
                </Row>
                <Row>
                  <IconChip icon={Play} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium text-foreground">YouTube videos</p>
                    <p className="text-xs text-muted-foreground">External lecture search</p>
                  </div>
                  <Badge>On</Badge>
                </Row>
                <Row>
                  <IconChip icon={FileText} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium text-foreground">PDF upload & OCR</p>
                    <p className="text-xs text-muted-foreground">Attach notes and past papers</p>
                  </div>
                  <Badge>On</Badge>
                </Row>
                <Row>
                  <IconChip icon={Sparkles} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium text-foreground">Bring-your-own model keys</p>
                    <p className="text-xs text-muted-foreground">Encrypted model endpoints</p>
                  </div>
                  <Badge>On</Badge>
                </Row>
              </div>
            </Card>
          )}

          {section === "tokens" && (
            <>
              <Card title="Your model keys">
                {customModels.length === 0 ? (
                  <Row>
                    <IconChip icon={KeyRound} />
                    <p className="text-[13px] text-muted-foreground">No keys added yet.</p>
                  </Row>
                ) : (
                  customModels.map((m) => (
                    <Row key={m.id} className="border-t border-border first:border-t-0">
                      <IconChip icon={Coins} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-medium text-foreground">{m.name}</p>
                        <p className="truncate text-xs text-muted-foreground">{hostOf(m.baseUrl)}</p>
                      </div>
                      <span className="font-mono text-xs tracking-widest text-muted-foreground">••••••••</span>
                    </Row>
                  ))
                )}
              </Card>
              <p className="px-1 text-xs leading-relaxed text-muted-foreground">
                Keys are encrypted in your browser with RSA-OAEP before upload. The server stores ciphertext only — plaintext is never stored or shown.
              </p>
              <button
                type="button"
                onClick={onManageModels}
                className="flex h-9 w-full items-center justify-center gap-1.5 rounded-lg bg-foreground px-2.5 text-[12.5px] font-semibold text-background transition-opacity hover:opacity-90"
              >
                <KeyRound size={14} /> Manage my models
              </button>
            </>
          )}

          {section === "activity" && (
            <Card title="Recent activity">
              {activity.length === 0 ? (
                <Row>
                  <p className="text-[13px] text-muted-foreground">No activity yet.</p>
                </Row>
              ) : (
                activity.map((a) => {
                  const Icon = activityIcon[a.kind];
                  return (
                    <Row key={a.id} className="border-t border-border first:border-t-0">
                      <IconChip icon={Icon} />
                      <p className="min-w-0 flex-1 truncate text-[13px] text-foreground">{a.text}</p>
                      <span className="shrink-0 text-xs text-muted-foreground">{timeAgo(a.time)}</span>
                    </Row>
                  );
                })
              )}
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};
