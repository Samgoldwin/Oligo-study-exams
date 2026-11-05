import React from 'react';
import { FileText, ScrollText, ClipboardList, Map, ClipboardCheck, X, ArrowUpRight } from 'lucide-react';
import type { ResourceItem, ResourceType } from '../../types';

const TYPE_META: Record<ResourceType, { label: string; Icon: React.ComponentType<{ size?: number | string; className?: string }> }> = {
  notes: { label: 'Notes', Icon: FileText },
  pyq: { label: 'PYQ', Icon: ScrollText },
  question_bank: { label: 'Question Bank', Icon: ClipboardList },
  syllabus: { label: 'Syllabus', Icon: Map },
  scheme_of_evaluation: { label: 'Scheme of Evaluation', Icon: ClipboardCheck },
  pdf: { label: 'PDF', Icon: FileText },
};

/**
 * VTUSync resource card, assistant-ui style: bordered, quiet, monochrome
 * with a single accent on hover. Stub records carry no file URL — opening one
 * shows the metadata panel instead of a fake link.
 */
export const ResourceCard: React.FC<{ resource: ResourceItem }> = ({ resource }) => {
  const [open, setOpen] = React.useState(false);
  const { label, Icon } = TYPE_META[resource.type] ?? TYPE_META.pdf;

  return (
    <>
      <div className="group flex items-center gap-3 rounded-xl border border-border bg-muted/20 py-2 pl-2 pr-2.5 transition-colors hover:border-ring hover:bg-muted/50">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground transition-colors group-hover:text-foreground">
          <Icon size={15} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-medium leading-snug text-foreground" title={resource.title}>
            {resource.title}
          </span>
          <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground">
            <span className="rounded border border-border px-1 py-0.5 font-medium uppercase tracking-wide">{label}</span>
            <span>{resource.subjectCode}</span>
            {resource.module ? <span>· Module {resource.module}</span> : null}
            <span>· {resource.scheme}</span>
            <span className="rounded border border-amber-500/30 bg-amber-500/10 px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-400">stub</span>
          </span>
        </span>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="View resource details"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border text-muted-foreground opacity-70 transition-all hover:border-ring hover:text-foreground group-hover:opacity-100"
        >
          <ArrowUpRight size={14} />
        </button>
      </div>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Resource details"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-xl border border-white/5 bg-popover p-5 shadow-2xl shadow-black/50"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-popover-foreground">Resource Details</h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <X size={16} />
              </button>
            </div>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[13px]">
              <dt className="font-medium text-muted-foreground">Title</dt><dd className="text-popover-foreground">{resource.title}</dd>
              <dt className="font-medium text-muted-foreground">Type</dt><dd className="text-popover-foreground">{TYPE_META[resource.type]?.label}</dd>
              <dt className="font-medium text-muted-foreground">Subject</dt><dd className="text-popover-foreground">{resource.subject} ({resource.subjectCode})</dd>
              <dt className="font-medium text-muted-foreground">Branches</dt><dd className="text-popover-foreground">{resource.branch}</dd>
              <dt className="font-medium text-muted-foreground">Semester</dt><dd className="text-popover-foreground">{resource.semester}</dd>
              <dt className="font-medium text-muted-foreground">Scheme</dt><dd className="text-popover-foreground">{resource.scheme}</dd>
              {resource.module ? (<><dt className="font-medium text-muted-foreground">Module</dt><dd className="text-popover-foreground">{resource.module}</dd></>) : null}
              <dt className="font-medium text-muted-foreground">Source</dt><dd className="text-popover-foreground">VTUSync (stub resource layer)</dd>
            </dl>
            <p className="mt-4 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-[12px] leading-snug text-amber-200/90">
              This record is served by the SyncAI stub resource layer — no file is attached yet.
              When the real VTUSync resource API is connected, this button will open the actual file.
            </p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="mt-4 w-full rounded-lg border border-border bg-secondary px-3 py-2 text-[13px] font-medium text-secondary-foreground transition-colors hover:bg-accent"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
};
