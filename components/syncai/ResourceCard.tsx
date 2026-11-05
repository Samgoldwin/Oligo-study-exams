import React from 'react';
import { FileText, ScrollText, ClipboardList, Map, ClipboardCheck, ArrowUpRight } from 'lucide-react';
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
 * VTUSync resource card — assistant-ui style: bordered, quiet, monochrome.
 * Click opens the real VTUSync page in a new tab.
 */
export const ResourceCard: React.FC<{ resource: ResourceItem }> = ({ resource }) => {
  const { label, Icon } = TYPE_META[resource.type] ?? TYPE_META.pdf;
  const link = resource.fileUrl || `https://vtusync.in/?s=${encodeURIComponent((resource.subjectCode || resource.subject || resource.title).toString())}`;

  return (
    <div className="group flex items-center gap-3 rounded-xl border border-border bg-muted/20 py-2 pl-2 pr-2.5 transition-colors hover:border-ring hover:bg-muted/50">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground transition-colors group-hover:text-foreground">
        <Icon size={15} />
      </span>
      <span className="min-w-0 flex-1">
        <a
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          className="block truncate text-[13px] font-medium leading-snug text-foreground hover:underline underline-offset-2"
          title={resource.title}
        >
          {resource.title}
        </a>
        <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground">
          <span className="rounded border border-border px-1 py-0.5 font-medium uppercase tracking-wide">{label}</span>
          {resource.subjectCode ? <span>{resource.subjectCode}</span> : null}
          {resource.module ? <span>· Module {resource.module}</span> : null}
          {resource.scheme ? <span>· {resource.scheme}</span> : null}
        </span>
      </span>
      <a
        href={link}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Open on VTUSync"
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border text-muted-foreground opacity-70 transition-all hover:border-ring hover:text-foreground group-hover:opacity-100"
      >
        <ArrowUpRight size={14} />
      </a>
    </div>
  );
};
