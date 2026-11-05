"use client";

import {
  forwardRef,
  Fragment,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ComponentPropsWithoutRef,
  type FC,
} from "react";
import {
  AuiIf,
  ThreadListItemMorePrimitive,
  ThreadListItemPrimitive,
  ThreadListPrimitive,
  useAui,
  useAuiState,
} from "@assistant-ui/react";
import {
  Loader2Icon,
  MoreHorizontalIcon,
  PencilIcon,
  PlusIcon,
  SearchIcon,
  TrashIcon,
  BarChart3,
  FileText,
  KeyRoundIcon,
  LogOutIcon,
  ChevronUpIcon,
  SettingsIcon,
  MessageSquare,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SyncAILogo } from "./SyncAILogo";
import type { PyqHistoryItem } from "@/services/pyqStore";
import type { UserProfile } from "@/services/firebaseClient";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * SyncAI sidebar — assistant-ui's ThreadListSidebar pattern, re-skinned for
 * VTUSync. Threads are the student's persisted conversations; the runtime's
 * external-store threadList adapter is what feeds them (see SyncAIChat).
 */

export const SyncAIThreadList: FC = () => {
  const [search, setSearch] = useState("");
  const hasThreads = useAuiState((s) => s.threads.threadIds.length > 0);

  return (
    <ThreadListRoot>
      <ThreadListNew />
      {hasThreads && <ThreadListSearch value={search} onValueChange={setSearch} />}
      <ThreadListItems searchQuery={hasThreads ? search : ""} />
    </ThreadListRoot>
  );
};

const ThreadListRoot: FC<ComponentPropsWithoutRef<typeof ThreadListPrimitive.Root>> = ({ className, ...props }) => (
  <ThreadListPrimitive.Root
    data-slot="aui_thread-list-root"
    className={cn("flex flex-col gap-0.5", className)}
    {...props}
  />
);

const ThreadListSearch = forwardRef<
  HTMLInputElement,
  Omit<ComponentPropsWithoutRef<typeof Input>, "value" | "onChange"> & {
    value: string;
    onValueChange: (value: string) => void;
  }
>(({ className, value, onValueChange, ...props }, ref) => (
  <div data-slot="aui_thread-list-search" className="relative px-0.5 py-1">
    <SearchIcon className="text-muted-foreground pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2" />
    <Input
      ref={ref}
      type="search"
      value={value}
      onChange={(event) => onValueChange(event.target.value)}
      aria-label="Search conversations"
      placeholder="Search chats"
      className={cn("h-8 ps-8 text-sm", className)}
      {...props}
    />
  </div>
));
ThreadListSearch.displayName = "ThreadListSearch";

const ThreadListItems: FC<ComponentPropsWithoutRef<"div"> & { searchQuery?: string }> = ({ className, searchQuery = "", ...props }) => (
  <div data-slot="aui_thread-list-items" className={cn("flex flex-col gap-0.5", className)} {...props}>
    <AuiIf condition={(s) => s.threads.isLoading}>
      <ThreadListSkeleton />
    </AuiIf>
    <AuiIf condition={(s) => !s.threads.isLoading}>
      <ThreadListItemGroups searchQuery={searchQuery} />
    </AuiIf>
  </div>
);

const dateGroupLabel = (
  date: Date | undefined,
  startOfToday: number,
  startOfYesterday: number,
): string => {
  if (!date || date.getTime() >= startOfToday) return "Today";
  if (date.getTime() >= startOfYesterday) return "Yesterday";
  return "Earlier";
};

const startOfLocalDay = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

const subscribeToNextDay = (onDayChange: () => void) => {
  let timeout: number;
  const scheduleNextDay = () => {
    const now = new Date();
    const startOfTomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime();
    timeout = window.setTimeout(() => {
      onDayChange();
      scheduleNextDay();
    }, startOfTomorrow - now.getTime());
  };
  scheduleNextDay();
  return () => window.clearTimeout(timeout);
};

const useStartOfToday = () =>
  useSyncExternalStore<number | undefined>(
    subscribeToNextDay,
    () => startOfLocalDay(new Date()),
    () => undefined,
  );

const useThreadGroups = (searchQuery = "") => {
  const threadIds = useAuiState((s) => s.threads.threadIds);
  const threadItems = useAuiState((s) => s.threads.threadItems);
  const query = searchQuery.trim().toLowerCase();
  const startOfToday = useStartOfToday();

  return useMemo(() => {
    const itemsById = new Map(threadItems.map((item) => [item.id, item]));
    const dates = threadIds.map((id) => itemsById.get(id)?.lastMessageAt);
    const filteredIndices = threadIds
      .map((id, index) => ({ id, index }))
      .filter(({ id }) => !query || (itemsById.get(id)?.title || "").toLowerCase().includes(query))
      .map(({ index }) => index);

    if (startOfToday === undefined || !filteredIndices.some((index) => dates[index])) {
      return { threadIds, filteredIndices, groups: null };
    }

    const yesterday = new Date(startOfToday);
    yesterday.setDate(yesterday.getDate() - 1);
    const startOfYesterday = yesterday.getTime();
    const time = (index: number) => dates[index]?.getTime() ?? Number.MAX_SAFE_INTEGER;
    const sorted = [...filteredIndices].sort((a, b) => time(b) - time(a));

    const result: Array<{ label: string; indices: number[] }> = [];
    for (const index of sorted) {
      const label = dateGroupLabel(dates[index], startOfToday, startOfYesterday);
      const lastGroup = result[result.length - 1];
      if (lastGroup?.label === label) lastGroup.indices.push(index);
      else result.push({ label, indices: [index] });
    }
    return { threadIds, filteredIndices, groups: result };
  }, [threadIds, threadItems, query, startOfToday]);
};

const ThreadListItemGroups: FC<{ searchQuery?: string }> = ({ searchQuery = "" }) => {
  const { threadIds, filteredIndices, groups } = useThreadGroups(searchQuery);
  const query = searchQuery.trim();

  if (query && filteredIndices.length === 0) {
    return (
      <div className="text-muted-foreground px-2.5 py-4 text-sm">No conversations found</div>
    );
  }

  if (!groups) {
    return (
      <>
        {filteredIndices.map((index) => (
          <ThreadListPrimitive.ItemByIndex key={threadIds[index]} index={index} components={{ ThreadListItem }} />
        ))}
      </>
    );
  }

  return (
    <>
      {groups.map((group) => (
        <Fragment key={group.label}>
          <div className="text-muted-foreground px-2.5 pt-3 pb-1 text-xs font-medium">
            {group.label}
          </div>
          {group.indices.map((index) => (
            <ThreadListPrimitive.ItemByIndex key={threadIds[index]} index={index} components={{ ThreadListItem }} />
          ))}
        </Fragment>
      ))}
    </>
  );
};

const ThreadListItemItem: FC = () => {
  const isRunning = useAuiState((s) => s.threadListItem.isRunning);
  const [isRenaming, setIsRenaming] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const restoreFocusRef = useRef(false);

  useEffect(() => {
    if (isRenaming || !restoreFocusRef.current) return;
    restoreFocusRef.current = false;
    triggerRef.current?.focus();
  }, [isRenaming]);

  return (
    <ThreadListItemPrimitive.Root
      data-slot="aui_thread-list-item"
      className="group hover:bg-muted focus-visible:bg-muted data-active:bg-muted has-focus-visible:bg-muted has-data-[state=open]:bg-muted relative flex h-8 items-center rounded-md transition-colors focus-visible:outline-none"
    >
      {isRenaming ? (
        <ThreadListItemRename
          onDone={(restoreFocus) => {
            restoreFocusRef.current = restoreFocus;
            setIsRenaming(false);
          }}
        />
      ) : (
        <ThreadListItemPrimitive.Trigger
          ref={triggerRef}
          data-slot="aui_thread-list-item-trigger"
          className="focus-visible:ring-ring/50 flex h-full min-w-0 flex-1 items-center rounded-md px-2.5 text-start text-sm outline-none focus-visible:ring-1 group-hover:pe-9 group-has-focus-visible:pe-9 group-has-data-[state=open]:pe-9 group-data-active:pe-9"
        >
          {isRunning && <Loader2Icon aria-hidden className="text-muted-foreground me-1.5 size-3.5 shrink-0 animate-spin" />}
          <span data-slot="aui_thread-list-item-title" className="min-w-0 flex-1 truncate">
            <ThreadListItemPrimitive.Title fallback="New Chat" />
          </span>
          {isRunning && <span className="sr-only">Running</span>}
        </ThreadListItemPrimitive.Trigger>
      )}
      <ThreadListItemMore onRename={() => setIsRenaming(true)} />
    </ThreadListItemPrimitive.Root>
  );
};

const ThreadListItem = ThreadListItemItem;

const ThreadListItemRename: FC<{
  onDone: (restoreFocus: boolean) => void;
}> = ({ onDone }) => {
  const aui = useAui();
  const title = useAuiState((s) => s.threadListItem.title) ?? "";
  const [value, setValue] = useState(title);
  const inputRef = useRef<HTMLInputElement>(null);
  const settledRef = useRef(false);

  useEffect(() => {
    inputRef.current?.select();
  }, []);

  const commit = (restoreFocus: boolean) => {
    if (settledRef.current) return;
    settledRef.current = true;

    const next = value.trim();
    if (!next || next === title) {
      onDone(restoreFocus);
      return;
    }
    Promise.resolve()
      .then(() => aui.threadListItem.rename(next))
      .then(
        () => onDone(restoreFocus),
        () => {
          settledRef.current = false;
          if (restoreFocus) inputRef.current?.focus();
        },
      );
  };

  const cancel = () => {
    if (settledRef.current) return;
    settledRef.current = true;
    onDone(true);
  };

  return (
    <Input
      ref={inputRef}
      autoFocus
      aria-label="Rename conversation"
      value={value}
      className="h-7 min-w-0 flex-1 ps-2.5 pe-9 text-sm"
      onChange={(event) => setValue(event.target.value)}
      onBlur={() => commit(false)}
      onKeyDown={(event) => {
        if (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) return;
        if (event.key === "Enter") {
          event.preventDefault();
          commit(true);
        } else if (event.key === "Escape") {
          event.preventDefault();
          cancel();
        }
      }}
    />
  );
};

const ThreadListItemMore: FC<{ onRename: () => void }> = ({ onRename }) => (
  <ThreadListItemMorePrimitive.Root sharedFocusGroup>
    <ThreadListItemMorePrimitive.Trigger asChild>
      <Button
        variant="ghost"
        size="icon"
        data-slot="aui_thread-list-item-more"
        className="data-[state=open]:bg-accent absolute end-1.5 top-1/2 size-6 -translate-y-1/2 p-0 opacity-0 group-hover:opacity-100 group-has-focus-visible:opacity-100 group-data-active:opacity-100 data-[state=open]:opacity-100"
      >
        <MoreHorizontalIcon className="size-3.5" />
        <span className="sr-only">More options</span>
      </Button>
    </ThreadListItemMorePrimitive.Trigger>
    <ThreadListItemMorePrimitive.Content
      side="right"
      align="start"
      sideOffset={6}
      data-slot="aui_thread-list-item-more-content"
      className="bg-popover text-popover-foreground data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=closed]:animate-out z-50 min-w-32 overflow-hidden rounded-xl border border-white/5 p-1.5 shadow-2xl shadow-black/50"
    >
      <ThreadListItemMorePrimitive.Item
        data-slot="aui_thread-list-item-more-item"
        className="hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm outline-none select-none"
        onSelect={onRename}
      >
        <PencilIcon className="size-4" />
        Rename
      </ThreadListItemMorePrimitive.Item>
      <ThreadListItemPrimitive.Delete asChild>
        <ThreadListItemMorePrimitive.Item
          data-slot="aui_thread-list-item-more-item"
          className="text-destructive hover:bg-destructive/10 hover:text-destructive focus:bg-destructive/10 focus:text-destructive flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm outline-none select-none"
        >
          <TrashIcon className="size-4" />
          Delete
        </ThreadListItemMorePrimitive.Item>
      </ThreadListItemPrimitive.Delete>
    </ThreadListItemMorePrimitive.Content>
  </ThreadListItemMorePrimitive.Root>
);

const ThreadListNew: FC = () => (
  <ThreadListPrimitive.New asChild>
    <Button
      variant="ghost"
      data-slot="aui_thread-list-new"
      className="hover:bg-muted data-active:bg-muted h-8 justify-start gap-2 rounded-md px-2.5 text-sm font-normal"
    >
      <PlusIcon data-slot="aui_thread-list-new-icon" className="size-4 shrink-0" />
      <span className="whitespace-nowrap">New Chat</span>
    </Button>
  </ThreadListPrimitive.New>
);

const ThreadListSkeleton: FC = () => (
  <div role="status" aria-label="Loading conversations" className="flex flex-col gap-0.5">
    {Array.from({ length: 5 }, (_, i) => (
      <div key={i} aria-hidden="true" className="flex h-8 items-center px-2.5">
        <Skeleton className="h-3.5 w-full" />
      </div>
    ))}
  </div>
);

export function SyncAISidebar({
  view,
  onViewChange,
  pyqHistory = [],
  activePyqId = null,
  onOpenPyq,
  onDeletePyq,
  user = null,
  onManageModels,
  onSignOut,
  onOpenSettings,
  settingsOpen = false,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  view: "chat" | "pyq" | "settings";
  onViewChange: (view: "chat" | "pyq" | "settings") => void;
  pyqHistory?: PyqHistoryItem[];
  activePyqId?: string | null;
  onOpenPyq?: (id: string) => void;
  onDeletePyq?: (id: string) => void;
  user?: UserProfile | null;
  onManageModels?: () => void;
  onSignOut?: () => void;
  onOpenSettings?: () => void;
  settingsOpen?: boolean;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = () => setMenuOpen(false);

  return (
    <Sidebar {...props}>
      <SidebarHeader className="aui-sidebar-header mb-2 border-b border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <div className="flex items-center gap-2 px-2 py-2">
              <span className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                <SyncAILogo className="size-5" variant="light" />
              </span>
              <div className="flex flex-col gap-0.5 leading-none">
                <span className="font-semibold text-sidebar-foreground">SyncAI</span>
                <span className="text-[10px] font-normal text-muted-foreground">VTUSync Academic Assistant</span>
              </div>
            </div>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent className="aui-sidebar-content px-2">
        {/* Workspace nav — chat + PYQ live in the sidebar as views */}
        <div className="mb-1 px-0.5 py-1">
          <p className="text-muted-foreground mb-1.5 px-1 text-[9px] font-bold uppercase tracking-[0.14em]">Workspace</p>
          <div className="flex flex-col gap-0.5">
            <button
              type="button"
              onClick={() => onViewChange("chat")}
              className={cn(
                "flex h-8 items-center gap-2 rounded-md px-2.5 text-left text-[13px] font-medium transition-colors",
                view === "chat" ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
              )}
            >
              <MessageSquare className="size-4" />
              AI Chat
            </button>
            <button
              type="button"
              onClick={() => onViewChange("pyq")}
              className={cn(
                "flex h-8 items-center gap-2 rounded-md px-2.5 text-left text-[13px] font-medium transition-colors",
                view === "pyq" ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
              )}
            >
              <BarChart3 className="size-4" />
              PYQ Analysis
            </button>
          </div>
        </div>

        {/* PYQ Analyses history */}
        {pyqHistory.length > 0 && (
          <div className="mb-1 px-0.5 py-1">
            <p className="text-muted-foreground mb-1.5 px-1 text-[9px] font-bold uppercase tracking-[0.14em]">
              PYQ Analyses
            </p>
            <div className="flex flex-col gap-0.5">
              {pyqHistory.map((h) => (
                <div
                  key={h.id}
                  className={cn(
                    "group flex items-center rounded-md transition-colors",
                    activePyqId === h.id ? "bg-muted" : "hover:bg-muted/60"
                  )}
                >
                  <button
                    type="button"
                    onClick={() => onOpenPyq?.(h.id)}
                    className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-2.5 py-1.5 text-left"
                  >
                    <FileText size={14} className="shrink-0 text-muted-foreground" />
                    <span className="min-w-0">
                      <span className="block truncate text-[12.5px] font-medium text-foreground">{h.subject}</span>
                      <span className="block text-[10px] text-muted-foreground">
                        {new Date(h.createdAt).toLocaleDateString()}
                      </span>
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeletePyq?.(h.id)}
                    aria-label="Delete analysis"
                    className="mr-1.5 rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:text-red-400 group-hover:opacity-100 focus-visible:opacity-100"
                  >
                    <TrashIcon size={13} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <SyncAIThreadList />
      </SidebarContent>

      {props.collapsible !== "none" && <SidebarRail />}

      <SidebarFooter className="aui-sidebar-footer border-t border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            {user ? (
              <div className="group relative flex w-full flex-col">
                <div className="flex items-center gap-1">
                  <SidebarMenuButton
                    size="lg"
                    className="hover:bg-accent hover:text-sidebar-accent-foreground peer/menu-sub-trigger flex-1"
                    onClick={() => setMenuOpen((open) => !open)}
                  >
                    <div className="aui-sidebar-footer-icon-wrapper bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
                      <img
                        src={
                          user.photoURL ??
                          `https://api.dicebear.com/9.x/thumbs/svg?seed=${encodeURIComponent(user.uid)}`
                        }
                        alt=""
                        className="size-4 rounded-full"
                        loading="lazy"
                      />
                    </div>
                    <div className="aui-sidebar-footer-heading flex min-w-0 flex-1 flex-col gap-0.5 leading-none">
                      <span className="aui-sidebar-footer-title truncate font-semibold">
                        {user.displayName ?? user.email ?? "SyncAI user"}
                      </span>
                      <span className="truncate text-[11px] text-muted-foreground">
                        {user.email ?? "Signed in"}
                      </span>
                    </div>
                    <ChevronUpIcon className="size-3.5 shrink-0 text-muted-foreground" />
                  </SidebarMenuButton>
                </div>

                {menuOpen && (
                  <div className="animate-in fade-in-0 zoom-in-95 origin-bottom mb-2 w-full rounded-xl border border-white/5 bg-popover p-1.5 shadow-2xl shadow-black/50">
                    <button
                      type="button"
                      onClick={() => {
                        closeMenu();
                        onOpenSettings?.();
                      }}
                      className="hover:bg-accent hover:text-accent-foreground flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm outline-none select-none"
                    >
                      <SettingsIcon className="size-4" /> Settings
                    </button>
                    {onManageModels && (
                      <button
                        type="button"
                        onClick={() => {
                          closeMenu();
                          onManageModels();
                        }}
                        className="hover:bg-accent hover:text-accent-foreground flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm outline-none select-none"
                      >
                        <KeyRoundIcon className="size-4" /> My models
                      </button>
                    )}
                    <div className="-mx-1 my-1 h-px bg-border/70" />
                    <button
                      type="button"
                      onClick={() => {
                        closeMenu();
                        onSignOut?.();
                      }}
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm outline-none select-none"
                    >
                      <LogOutIcon className="size-4" /> Sign out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex w-full items-center gap-2 rounded-md px-2 py-1.5">
                <span className="flex size-6 shrink-0 items-center justify-center rounded border border-amber-500/30 bg-amber-500/10 text-[9px] font-bold uppercase tracking-wider text-amber-400">
                  v1
                </span>
                <span className="flex flex-col gap-0.5 leading-none">
                  <span className="text-[11px] font-medium text-sidebar-foreground">VTUSync integration</span>
                  <span className="text-[9px] text-muted-foreground">Stub resource layer · AI-generated answers</span>
                </span>
              </div>
            )}
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
