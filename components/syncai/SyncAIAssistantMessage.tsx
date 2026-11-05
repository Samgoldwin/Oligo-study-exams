"use client";

import {
  ActionBarPrimitive,
  AuiIf,
  MessagePrimitive,
  useAuiState,
} from "@assistant-ui/react";
import {
  BookOpenCheck,
  CheckIcon,
  CopyIcon,
  DownloadIcon,
  Info,
  RefreshCwIcon,
  ScrollText,
  ShieldCheck,
  TriangleAlert,
  Youtube,
} from "lucide-react";
import { type FC } from "react";
import { MarkdownText } from "@/components/assistant-ui/elements/markdown-text";
import { TooltipIconButton } from "@/components/assistant-ui/elements/tooltip-icon-button";
import { DotsLoader } from "@/components/ui/loader";
import { ResourceCard } from "@/components/syncai/ResourceCard";
import { YouTubeCard } from "@/components/syncai/YouTubeCard";
import { cn } from "@/lib/utils";
import type {
  ChatSource,
  Grounding,
  ResourceItem,
  YouTubeVideo,
} from "@/types";

/** Structured payload carried on each assistant message (metadata.custom). */
export interface SyncAIMessageCustom {
  relatedResources?: ResourceItem[];
  pyqResources?: ResourceItem[];
  videos?: YouTubeVideo[];
  videoError?: string | null;
  sources?: ChatSource[];
  grounded?: Grounding | null;
  error?: string | null;
}

const SECTION_LABEL =
  "flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground";

const GROUNDING_TEXT: Record<Grounding, { text: string; tone: "ok" | "warn" }> = {
  vtunsync: { text: "Grounded in VTUSync resources (stub dataset)", tone: "ok" },
  document: { text: "Grounded in your uploaded PDF", tone: "ok" },
  general: { text: "General AI explanation — not sourced from VTUSync", tone: "warn" },
};

const StubBadge = () => (
  <span className="rounded border border-amber-500/30 bg-amber-500/10 px-1 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-400">
    stub
  </span>
);

const VtunsyncResources: FC<{ title: string; icon: FC<{ size?: number; strokeWidth?: number; className?: string }>; resources: ResourceItem[] }> = ({ title, icon: Icon, resources }) => (
  <section className="flex flex-col gap-1.5 py-1.5">
    <h5 className={SECTION_LABEL}>
      <Icon size={12} strokeWidth={2.2} />
      {title}
      <StubBadge />
    </h5>
    <div className="flex flex-col gap-1.5">
      {resources.map((r) => (
        <ResourceCard key={r.id} resource={r} />
      ))}
    </div>
  </section>
);

const YouTubeSection: FC<{ videos: YouTubeVideo[]; videoError?: string | null }> = ({ videos, videoError }) => (
  <section className="flex flex-col gap-1.5 py-1.5">
    <h5 className={SECTION_LABEL}>
      <Youtube size={12} strokeWidth={2.2} className="text-red-400" />
      External · YouTube Videos
    </h5>
    {videos.length > 0 ? (
      <div className="-mx-1 flex snap-x snap-mandatory gap-2 overflow-x-auto px-1 pb-1">
        {videos.map((v) => (
          <span key={v.videoId} className="snap-start">
            <YouTubeCard video={v} />
          </span>
        ))}
      </div>
    ) : (
      <p className="flex items-start gap-1.5 rounded-lg border border-border bg-muted/20 px-2.5 py-2 text-[12px] leading-snug text-muted-foreground">
        <Info size={12} className="mt-0.5 shrink-0" />
        {videoError ??
          "Unable to retrieve YouTube videos right now. You can still use the explanation and VTUSync resources."}
      </p>
    )}
  </section>
);

const MessageFooter: FC<{ meta: SyncAIMessageCustom }> = ({ meta }) => {
  const grounding = meta.grounded ? GROUNDING_TEXT[meta.grounded] : undefined;
  const sources = meta.sources ?? [];
  if (!grounding && sources.length === 0) return null;

  return (
    <div className="mt-1 flex flex-col gap-1.5 border-t border-border/60 pt-2 text-[11px] text-muted-foreground">
      {grounding && (
        <span
          className={cn(
            "inline-flex items-center gap-1.5 font-medium",
            grounding.tone === "ok" ? "text-emerald-400" : "text-amber-400",
          )}
        >
          {grounding.tone === "ok" ? <ShieldCheck size={12} /> : <TriangleAlert size={12} />}
          {grounding.text}
        </span>
      )}
      {sources.length > 0 && (
        <details>
          <summary className="cursor-pointer select-none font-medium transition-colors hover:text-foreground">
            Sources ({sources.length})
          </summary>
          <ul className="mt-1.5 flex flex-col gap-1">
            {sources.map((s, i) => (
              <li key={`${s.label}-${i}`} className="flex items-baseline gap-1.5 leading-snug">
                <span className="shrink-0 font-mono text-[10px] text-primary">{s.label}</span>
                <span className="min-w-0">{s.title}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
};

const AssistantActionBar: FC = () => (
  <ActionBarPrimitive.Root
    hideWhenRunning
    autohide="not-last"
    className="aui-assistant-action-bar-root text-muted-foreground animate-in fade-in col-start-3 row-start-2 -ms-1 flex gap-1 duration-200"
  >
    <ActionBarPrimitive.Copy asChild>
      <TooltipIconButton tooltip="Copy">
        <AuiIf condition={(s) => s.message.isCopied}>
          <CheckIcon className="animate-in zoom-in-50 fade-in duration-200 ease-out" />
        </AuiIf>
        <AuiIf condition={(s) => !s.message.isCopied}>
          <CopyIcon className="animate-in zoom-in-75 fade-in duration-150" />
        </AuiIf>
      </TooltipIconButton>
    </ActionBarPrimitive.Copy>
    <ActionBarPrimitive.Reload asChild>
      <TooltipIconButton tooltip="Regenerate">
        <RefreshCwIcon />
      </TooltipIconButton>
    </ActionBarPrimitive.Reload>
    <ActionBarPrimitive.ExportMarkdown asChild>
      <TooltipIconButton tooltip="Export markdown">
        <DownloadIcon />
      </TooltipIconButton>
    </ActionBarPrimitive.ExportMarkdown>
  </ActionBarPrimitive.Root>
);

const TypingIndicator: FC = () => (
  <span
    data-slot="aui_assistant-message-indicator"
    role="status"
    aria-label="SyncAI is working"
    className="inline-flex px-1 py-1"
  >
    <DotsLoader size="sm" />
  </span>
);

export const SyncAIAssistantMessage: FC = () => {
  const meta = useAuiState(
    (s) => (s.message.metadata.custom ?? {}) as unknown as SyncAIMessageCustom,
  );

  const notes = (meta.relatedResources ?? []).filter((r) => r.type !== "pyq");
  const pyqs = meta.pyqResources ?? [];
  const videos = meta.videos ?? [];
  const hasVideosBlock = videos.length > 0 || Boolean(meta.videoError);

  // Error state — retrieved resources survive the failure.
  if (meta.error) {
    const recovered = [...(meta.relatedResources ?? []), ...(meta.pyqResources ?? [])];
    return (
      <MessagePrimitive.Root
        data-slot="syncai-assistant-error"
        className="fade-in slide-in-from-bottom-1 animate-in relative -mb-7.5 pb-7.5 duration-150 [contain-intrinsic-size:auto_200px] [content-visibility:auto]"
      >
        <div className="px-2 leading-relaxed">
          <div className="mt-2 rounded-xl border border-destructive/40 bg-destructive/10 p-3">
            <div className="flex items-start gap-2 text-red-200">
              <TriangleAlert size={15} className="mt-0.5 shrink-0" />
              <span className="text-[13px] leading-snug">{meta.error}</span>
            </div>
            <ActionBarPrimitive.Reload asChild>
              <button
                type="button"
                className="mt-2.5 inline-flex items-center gap-1.5 rounded-lg border border-destructive/40 bg-background/40 px-2.5 py-1.5 text-[12px] font-medium text-red-100 transition-colors hover:bg-destructive/20"
              >
                <RefreshCwIcon size={12} />
                Try again
              </button>
            </ActionBarPrimitive.Reload>
          </div>
          {recovered.length > 0 && (
            <div className="mt-2 flex flex-col gap-1.5">
              {recovered.map((r) => (
                <ResourceCard key={r.id} resource={r} />
              ))}
            </div>
          )}
        </div>
      </MessagePrimitive.Root>
    );
  }

  // Conversational turns (greetings/small talk) never render the grounding
  // footer or the YouTube fallback notice. Server leaves `grounded` unset.
  const isConversational = meta.grounded === null;

  return (
    <MessagePrimitive.Root
      data-slot="syncai-assistant-message-root"
      data-role="assistant"
      className="fade-in slide-in-from-bottom-1 animate-in relative -mb-7.5 pb-7.5 duration-150 [contain-intrinsic-size:auto_200px] [content-visibility:auto]"
    >
      <div
        data-slot="syncai-assistant-message-content"
        className="text-foreground px-2 text-[15px] leading-relaxed wrap-break-word"
      >
        {/* Priority policy: VTUSync resources render above the explanation */}
        {notes.length > 0 && <VtunsyncResources title="VTUSync Notes & Resources" icon={BookOpenCheck} resources={notes} />}

        <MessagePrimitive.GroupedParts groupBy={() => []}>
          {({ part }) => {
            switch (part.type) {
              case "text":
                return <MarkdownText />;
              case "indicator":
                return <TypingIndicator />;
              default:
                return null;
            }
          }}
        </MessagePrimitive.GroupedParts>

        {pyqs.length > 0 && <VtunsyncResources title="VTUSync PYQs" icon={ScrollText} resources={pyqs} />}
        {!isConversational && hasVideosBlock && <YouTubeSection videos={videos} videoError={meta.videoError} />}
        {!isConversational && <MessageFooter meta={meta} />}
      </div>

      <div
        data-slot="syncai-assistant-message-footer"
        className="ms-2 flex min-h-7.5 items-center pt-1.5"
      >
        <AssistantActionBar />
      </div>
    </MessagePrimitive.Root>
  );
};
