/**
 * Live VTUSync scraper — free / open-source tools only.
 *
 * Two layers, both without paid keys:
 *  1) PRIMARY: fetch a page with `cheerio` (MIT) — zero-cost, offline-capable,
 *     no third-party service. We scrape vtusync.in directly.
 *  2) FALLBACK: Jina Reader (free, no key, ~20 req/min) via
 *     `https://r.jina.ai/<url>` — used only if direct fetch fails (JS-rendered
 *     page, block, timeout, etc.). No paid Firecrawl here.
 *
 * Everything is cached in-memory (per warm serverless instance) with a TTL and
 * CAPPED aggressively: the scraped markdown is hard-truncated before it ever
 * reaches the LLM, so this layer cannot blow the model's token budget.
 * Any failure returns `{ pages: [], error }` instead of throwing.
 */

import * as cheerio from 'cheerio';

const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes
const MAX_PAGE_CHARS = 8_000; // hard cap per scraped page fed to the model
const MAX_PAGES_PER_QUERY = 3;

interface CacheEntry {
  expiresAt: number;
  markdown: string;
  links: string[];
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

export interface ScrapeResult {
  pages: string[];
  error: string | null;
  usedJina: boolean;
}

export interface ScrapeOptions {
  query: string;
  subject?: string | null;
  subjectCode?: string | null;
  limit?: number;
}

/** Built-in quick links — the real vtusync.in structure we scrape against. */
const VTUSYNC_ROOT = 'https://vtusync.in';
const KNOWN_SECTIONS: Record<string, string[]> = {
  CSE: [
    `${VTUSYNC_ROOT}/3rd-semester-2022-scheme-cse/`,
    `${VTUSYNC_ROOT}/4th-semester-2022-scheme-cse/`,
    `${VTUSYNC_ROOT}/5th-semester-2022-scheme-cse/`,
    `${VTUSYNC_ROOT}/6th-semester-2022-scheme-cse/`,
    `${VTUSYNC_ROOT}/7th-semester-2022-scheme-cse/`,
  ],
  ECE: [
    `${VTUSYNC_ROOT}/3rd-semester-2022-scheme-ece/`,
    `${VTUSYNC_ROOT}/4th-semester-2022-scheme-ece/`,
    `${VTUSYNC_ROOT}/5th-semester-2022-scheme-ec/`,
    `${VTUSYNC_ROOT}/6th-semester-2022-scheme-ece/`,
    `${VTUSYNC_ROOT}/7th-semester-2022-scheme-ece/`,
  ],
  EEE: [
    `${VTUSYNC_ROOT}/3rd-semester-2022-scheme-eee/`,
    `${VTUSYNC_ROOT}/4th-semester-2022-scheme-eee/`,
    `${VTUSYNC_ROOT}/5thsemester-2022-scheme-eee/`,
    `${VTUSYNC_ROOT}/6th-semester-2022-scheme-eee/`,
    `${VTUSYNC_ROOT}/7th-semester-2022-scheme-eee/`,
  ],
  CIVIL: [
    `${VTUSYNC_ROOT}/3rd-semester-2022-scheme-civil/`,
    `${VTUSYNC_ROOT}/4th-semester-2022-scheme-civil/`,
    `${VTUSYNC_ROOT}/5th-semester-2022-scheme-civil/`,
    `${VTUSYNC_ROOT}/6th-semester-2022-scheme-civil/`,
    `${VTUSYNC_ROOT}/7th-semester-2022-scheme-civil/`,
  ],
  MECH: [`${VTUSYNC_ROOT}/mech1/`],
  FIRST_YEAR: [`${VTUSYNC_ROOT}/p-and-c-cycle-2022-scheme/`, `${VTUSYNC_ROOT}/vtu-p-cycle-c-cycle-notes-2025-scheme/`],
};

function urlsFor(opts: ScrapeOptions): string[] {
  const code = (opts.subjectCode || '').toUpperCase();
  const query = (opts.query || '').toUpperCase();
  // Branch match first (most specific), then subject-code search path.
  for (const [branch, urls] of Object.entries(KNOWN_SECTIONS)) {
    if (query.includes(branch) || code.startsWith(branch)) return urls;
  }
  if (code) {
    const slugish = `${VTUSYNC_ROOT}/?s=${encodeURIComponent(code)}`;
    return [slugish];
  }
  // Fall back to the site-wide search (WP search param).
  return [`${VTUSYNC_ROOT}/?s=${encodeURIComponent((opts.query || '').trim())}`];
}

function fetchJinaMarkdown(url: string): Promise<string> {
  return fetch(`https://r.jina.ai/${url}`, {
    headers: { Accept: 'text/markdown' },
    signal: AbortSignal.timeout(20_000),
  }).then(async (res) => {
    if (!res.ok) throw new Error(`jina_${res.status}`);
    return (await res.text()).slice(0, MAX_PAGE_CHARS);
  });
}

function fetchCheerioMarkdown(url: string): Promise<string> {
  return fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 SyncAI/1.0 (+https://vtusync.in)',
      Accept: 'text/html',
    },
    signal: AbortSignal.timeout(20_000),
  }).then(async (res) => {
    if (!res.ok) throw new Error(`fetch_${res.status}`);
    const html = await res.text();
    const $ = cheerio.load(html);
    // Remove the usual noise.
    $('script, style, nav, footer, header, noscript, iframe').remove();
    const text = $('body')
      .text()
      .replace(/\s+/g, ' ')
      .trim();
    if (text.length < 80) throw new Error('empty_content');
    return text.slice(0, MAX_PAGE_CHARS);
  });
}

export async function scrapeVTUSync(opts: ScrapeOptions): Promise<ScrapeResult> {
  const now = Date.now();
  sweep(now);
  const urls = urlsFor(opts).slice(0, Math.min(opts.limit ?? MAX_PAGES_PER_QUERY, MAX_PAGES_PER_QUERY));
  if (urls.length === 0) return { pages: [], error: 'no_urls', usedJina: false };

  const pages: string[] = [];
  let usedJina = false;
  let lastError: string | null = null;

  const cacheKey = `${urls.join('|')}`;
  const hit = cache.get(cacheKey);
  if (hit && hit.expiresAt > now) {
    return { pages: hit.markdown ? [hit.markdown] : [], error: null, usedJina: false };
  }

  for (const url of urls) {
    try {
      const md = await fetchCheerioMarkdown(url);
      if (md) pages.push(`Source: ${url}\n${md}`);
    } catch (e) {
      lastError = e instanceof Error ? e.message : 'network_error';
      // Cheerio failed (JS-heavy, block, etc.) — fall back to free Jina Reader.
      try {
        const md = await fetchJinaMarkdown(url);
        if (md.length > 80) {
          pages.push(`Source: ${url}\n${md}`);
          usedJina = true;
        }
      } catch (je) {
        lastError = je instanceof Error ? je.message : 'network_error';
        /* keep going — partial results still help */
      }
    }
  }

  // Cache the combined result (empty pages → still negative-cached briefly).
  cache.set(cacheKey, { expiresAt: now + CACHE_TTL_MS, markdown: pages.join('\n\n---\n\n'), links: urls });

  return { pages, error: pages.length ? null : lastError || 'no_results', usedJina };
}

/** Cheap guard: should we attempt live scraping for this query? */
export function shouldScrape(query: string): boolean {
  const q = (query || '').toLowerCase();
  const wantsNotes = /(note|notes|material|study|explain|help|tut)/.test(q);
  const looksTechnical = /[a-z]{3,}\s+[a-z]{3,}/.test(q);
  return wantsNotes || looksTechnical;
}
