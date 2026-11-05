import React from 'react';
import { Youtube, Play, ExternalLink } from 'lucide-react';
import type { YouTubeVideo } from '../../types';

/**
 * External YouTube result, assistant-ui style. Always labeled as external —
 * we never imply the model watched the video. No invented URLs: the link is
 * the one returned by the YouTube Data API.
 */
export const YouTubeCard: React.FC<{ video: YouTubeVideo }> = ({ video }) => {
  return (
    <a
      href={video.url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Watch on YouTube: ${video.title}`}
      className="group flex w-44 shrink-0 flex-col overflow-hidden rounded-xl border border-border bg-muted/20 transition-all hover:border-ring hover:bg-muted/50 sm:w-44"
    >
      <span className="relative block aspect-video w-full overflow-hidden bg-secondary">
        {video.thumbnail ? (
          <img
            src={video.thumbnail}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center">
            <Youtube size={22} className="text-muted-foreground" />
          </span>
        )}
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="flex size-8 items-center justify-center rounded-full bg-black/70 text-white backdrop-blur-sm transition-transform duration-200 group-hover:scale-110">
            <Play size={13} fill="currentColor" className="ml-0.5" />
          </span>
        </span>
        {video.duration && (
          <span className="absolute bottom-1 right-1 rounded bg-black/80 px-1 py-0.5 font-mono text-[9px] font-medium text-white">
            {video.duration}
          </span>
        )}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5 p-2">
        <span className="line-clamp-2 text-[11px] font-medium leading-snug text-foreground">{video.title}</span>
        <span className="truncate text-[10px] text-muted-foreground">{video.channel}</span>
        <span className="mt-auto flex items-center gap-1 pt-1 text-[9px] font-semibold uppercase tracking-wider text-red-400/90">
          <ExternalLink size={9} />
          External
        </span>
      </span>
    </a>
  );
};
