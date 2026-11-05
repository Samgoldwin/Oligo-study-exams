/**
 * YouTube Data API v3 search — SERVER-SIDE ONLY.
 *
 * - API key stays on the backend (YOUTUBE_API_KEY).
 * - Responses are cached in-memory (per warm serverless instance) with a TTL.
 * - Quota exhaustion and API failures are handled gracefully: callers receive
 *   `{ videos: [], error }` instead of an exception.
 * - Videos are never "watched" or transcribed by this module; metadata only.
 */

import type { YouTubeVideo } from '../../types';

const SEARCH_URL = 'https://www.googleapis.com/youtube/v3/search';
const VIDEOS_URL = 'https://www.googleapis.com/youtube/v3/videos';
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

interface CacheEntry {
  expiresAt: number;
  value: YouTubeSearchResult;
}

const cache = new Map<string, CacheEntry>();
let lastSweep = Date.now();

function sweep(now: number): void {
  if (now - lastSweep < CACHE_TTL_MS) return;
  lastSweep = now;
  for (const [key, entry] of cache) {
    if (entry.expiresAt <= now) cache.delete(key);
  }
}

export type YouTubeErrorCode = 'not_configured' | 'quota_exceeded' | 'api_error' | 'network_error';

export interface YouTubeSearchResult {
  videos: YouTubeVideo[];
  error: YouTubeErrorCode | null;
  message: string | null;
  cached: boolean;
}

export interface YouTubeSearchOptions {
  query: string;
  subject?: string | null;
  /** e.g. "en", "hi", "kn" — applied as relevanceLanguage when set. */
  language?: string | null;
  maxResults?: number;
  /** Optional VTU hint ("VTU" or "VTU <code>") — used only for a first-pass search. */
  vtuHint?: string | null;
}

function cacheKey(opts: YouTubeSearchOptions): string {
  return JSON.stringify({
    q: opts.query.trim().toLowerCase(),
    s: (opts.subject || '').trim().toLowerCase(),
    l: (opts.language || '').trim().toLowerCase(),
    h: (opts.vtuHint || '').trim().toLowerCase(),
    n: opts.maxResults ?? 5,
  });
}

function formatDuration(iso: string | undefined): { text: string | null; seconds: number | null } {
  if (!iso) return { text: null, seconds: null };
  const match = iso.match(/^P(?:\d+D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/i);
  if (!match) return { text: null, seconds: null };
  const hours = Number(match[1] || 0);
  const minutes = Number(match[2] || 0);
  const seconds = Number(match[3] || 0);
  const total = hours * 3600 + minutes * 60 + seconds;
  const text = hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
    : `${minutes}:${String(seconds).padStart(2, '0')}`;
  return { text, seconds: total };
}

async function rawSearch(
  apiKey: string,
  q: string,
  opts: YouTubeSearchOptions
): Promise<YouTubeSearchResult> {
  const maxResults = Math.min(Math.max(opts.maxResults ?? 5, 1), 10);

  const searchParams = new URLSearchParams({
    key: apiKey,
    part: 'snippet',
    type: 'video',
    videoEmbeddable: 'true',
    videoCategoryId: '27', // Education
    safeSearch: 'strict',
    maxResults: String(maxResults),
    q,
  });
  if (opts.language && /^[a-z]{2,5}(-[a-zA-Z]{2,5})?$/.test(opts.language)) {
    searchParams.set('relevanceLanguage', opts.language);
  }

  let searchRes: Response;
  try {
    searchRes = await fetch(`${SEARCH_URL}?${searchParams.toString()}`);
  } catch {
    return { videos: [], error: 'network_error', message: 'Unable to reach YouTube right now.', cached: false };
  }

  if (!searchRes.ok) {
    let reason = '';
    try {
      const body = (await searchRes.json()) as { error?: { errors?: Array<{ reason?: string }> } };
      reason = body?.error?.errors?.[0]?.reason || '';
    } catch {
      /* ignore parse failure */
    }
    if (searchRes.status === 403 && /quota|dailyLimit/i.test(reason)) {
      return {
        videos: [],
        error: 'quota_exceeded',
        message: 'YouTube search quota is exhausted for today. Please try again tomorrow.',
        cached: false,
      };
    }
    return {
      videos: [],
      error: 'api_error',
      message: `YouTube search failed (HTTP ${searchRes.status}).`,
      cached: false,
    };
  }

  const searchJson = (await searchRes.json()) as {
    items?: Array<{
      id?: { videoId?: string };
      snippet?: {
        title?: string;
        channelTitle?: string;
        publishedAt?: string;
        thumbnails?: { medium?: { url?: string }; default?: { url?: string } };
      };
    }>;
  };

  const items = (searchJson.items || []).filter((it) => it.id?.videoId);
  if (items.length === 0) {
    return { videos: [], error: null, message: null, cached: false };
  }

  const ids = items.map((it) => it.id!.videoId!).join(',');
  let durationById = new Map<string, { text: string | null; seconds: number | null }>();

  try {
    const detailsParams = new URLSearchParams({
      key: apiKey,
      part: 'contentDetails',
      id: ids,
    });
    const detailsRes = await fetch(`${VIDEOS_URL}?${detailsParams.toString()}`);
    if (detailsRes.ok) {
      const detailsJson = (await detailsRes.json()) as {
        items?: Array<{ id?: string; contentDetails?: { duration?: string } }>;
      };
      durationById = new Map(
        (detailsJson.items || []).map((it) => [it.id || '', formatDuration(it.contentDetails?.duration)])
      );
    }
    // Duration is optional — fall through silently if this call fails.
  } catch {
    /* ignore */
  }

  const videos: YouTubeVideo[] = items.map((it) => {
    const videoId = it.id!.videoId!;
    const duration = durationById.get(videoId) ?? { text: null, seconds: null };
    return {
      videoId,
      title: it.snippet?.title || 'Untitled video',
      channel: it.snippet?.channelTitle || 'Unknown channel',
      thumbnail: it.snippet?.thumbnails?.medium?.url || it.snippet?.thumbnails?.default?.url || '',
      duration: duration.text,
      durationSeconds: duration.seconds,
      url: `https://www.youtube.com/watch?v=${videoId}`,
      publishedAt: it.snippet?.publishedAt || '',
    };
  });

  return { videos, error: null, message: null, cached: false };
}

export async function searchYouTubeVideos(opts: YouTubeSearchOptions): Promise<YouTubeSearchResult> {
  const now = Date.now();
  sweep(now);

  const key = cacheKey(opts);
  const cached = cache.get(key);
  if (cached && cached.expiresAt > now) {
    return { ...cached.value, cached: true };
  }

  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    return {
      videos: [],
      error: 'not_configured',
      message: 'YouTube search is not configured on this deployment. You can still use the explanation and VTUSync resources.',
      cached: false,
    };
  }

  const subject = (opts.subject || '').trim();
  const vtuHint = (opts.vtuHint || '').trim();

  // First pass: academically enhanced query (VTU + subject + topic).
  const enhanced = [opts.query.trim(), subject, vtuHint].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
  let result = await rawSearch(apiKey, enhanced, opts);

  // Second pass: if the enhanced query under-delivered, retry with just subject + topic
  // (VTU keywords can narrow relevance for generic topics).
  if (result.videos.length < 2) {
    const simpler = [opts.query.trim(), subject].filter(Boolean).join(' ').trim() || opts.query.trim();
    if (simpler !== enhanced) {
      const retry = await rawSearch(apiKey, simpler, opts);
      // Keep whichever attempt surfaced more videos; surface retry errors only if it also means failure.
      if (retry.videos.length >= result.videos.length) {
        result = retry;
      }
    }
  }

  if (!result.error) {
    cache.set(key, { expiresAt: now + CACHE_TTL_MS, value: result });
  }

  return result;
}
