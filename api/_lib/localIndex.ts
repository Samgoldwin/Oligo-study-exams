/**
 * Offline VTUSync index — MiniSearch (MIT, tiny, no build step).
 *
 * The resources in `resources.ts` are indexed here so search works
 * instantly, with zero network, and zero model involvement. It mirrors the
 * TinySearch idea: a pre-built inverted index bundled with the app that
 * survives even when the AI provider or network is unreachable.
 *
 * Data source: `RESOURCES` (the same curated dataset used by the chat
 * retrieval layer). To refresh, re-run `npm run index:vtusync` when the
 * curated seeds change.
 */

import MiniSearch from 'minisearch';
import { RESOURCES } from './resources';
import type { ResourceItem } from '../../types';

interface Docs {
  id: string;
  title: string;
  subject: string;
  subjectCode: string;
  type: string;
  tags: string[];
  branch: string;
  combined: string;
}

const docs: Docs[] = RESOURCES.map((r) => ({
  id: r.id,
  title: r.title,
  subject: r.subject,
  subjectCode: r.subjectCode,
  type: r.type,
  tags: r.tags || [],
  branch: r.branch || '',
  combined: `${r.title} ${r.subject} ${r.subjectCode} ${r.type} ${(r.tags || []).join(' ')}`,
}));

let index: MiniSearch<Docs> | null = null;

export function buildIndex(): MiniSearch<Docs> {
  if (index) return index;
  index = new MiniSearch<Docs>({
    fields: ['title', 'subject', 'subjectCode', 'tags', 'combined'],
    storeFields: ['title', 'subject', 'subjectCode', 'type', 'branch'],
    searchOptions: { prefix: true, fuzzy: 0.2 },
  });
  index.addAll(docs);
  return index;
}

export interface IndexedHit {
  id: string;
  title: string;
  subject: string;
  subjectCode: string;
  type: string;
  branch: string;
  score: number;
}

export function searchOffline(query: string, limit = 8): IndexedHit[] {
  if (!query.trim()) return [];
  const idx = buildIndex();
  const results = idx.search(query, { prefix: true, fuzzy: 0.2 } as never);
  return results.slice(0, Math.min(Math.max(limit, 1), 25)).map((r) => ({
    id: r.id,
    title: r.title,
    subject: r.subject,
    subjectCode: r.subjectCode,
    type: r.type,
    branch: r.branch,
    score: r.score,
  }));
}

/** Warm the index — call once at module init if desired. */
export function warmOfflineIndex(): void {
  buildIndex();
}

// Re-export the source items so callers can hydrate hits without importing
// the store directly.
export function hydrateHits(hits: IndexedHit[]): ResourceItem[] {
  const byId = new Map(RESOURCES.map((r) => [r.id, r]));
  return hits.map((h) => byId.get(h.id)).filter((x): x is ResourceItem => Boolean(x));
}
