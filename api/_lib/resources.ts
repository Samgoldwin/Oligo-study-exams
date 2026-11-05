/**
 * VTUSync Resource Layer (MOCK)
 * ==============================
 *
 * The real VTUSync resource database / backend API is not reachable from this
 * codebase, so this module provides an in-memory dataset with the same shape
 * VTUSync resources are expected to have. All functions in this file are the
 * single seam SyncAI uses to reach VTUSync — replace `STUB_RESOURCES` and the
 * `fetchFromVTUSync` placeholder with real API calls when the VTUSync backend
 * is available, and every consumer keeps working unchanged.
 *
 * Rules honoured here:
 *  - Search is retrieval-first; SyncAI never invents resources.
 *  - Records carry `stub: true` and `fileUrl: null` — no fabricated links.
 *  - Only metadata that the stub actually models is populated.
 */

import type { ResourceItem, ResourceType } from '../../types';

interface StubSeed {
  title: string;
  type: ResourceType;
  subject: string;
  subjectCode: string;
  branches: string[];
  semester: number;
  scheme: string;
  module?: string;
  tags: string[];
  year?: string;
}

const CSE = ['CSE', 'ISE', 'AIML'];
const ECE_EEE = ['ECE', 'EEE'];
const ALL_ENG = ['CSE', 'ISE', 'AIML', 'ECE', 'EEE', 'ME', 'CE'];

const STUB_SEEDS: StubSeed[] = [
  // --- Operating Systems (BCS503, 2021 scheme) ---
  { title: 'BCS503 Operating Systems — Module 1: Process Management & Scheduling Notes', type: 'notes', subject: 'Operating Systems', subjectCode: 'BCS503', branches: CSE, semester: 5, scheme: '2021', module: '1', tags: ['process', 'scheduling', 'cpu scheduling', 'fcfs', 'sjf', 'round robin', 'pcb', 'threads', 'concurrency'] },
  { title: 'BCS503 Operating Systems — Module 2: Process Synchronization Notes', type: 'notes', subject: 'Operating Systems', subjectCode: 'BCS503', branches: CSE, semester: 5, scheme: '2021', module: '2', tags: ['synchronization', 'mutex', 'semaphore', 'deadlock', 'critical section', 'monitors', 'producer consumer'] },
  { title: 'BCS503 Operating Systems — Module 3: Deadlocks Unit Notes (Banker\'s Algorithm, Prevention, Avoidance)', type: 'notes', subject: 'Operating Systems', subjectCode: 'BCS503', branches: CSE, semester: 5, scheme: '2021', module: '3', tags: ['deadlock', 'bankers algorithm', 'deadlock prevention', 'deadlock avoidance', 'deadlock detection', 'necessary conditions', 'mutual exclusion'] },
  { title: 'BCS503 Operating Systems — Module 4: Memory Management & Virtual Memory Notes', type: 'notes', subject: 'Operating Systems', subjectCode: 'BCS503', branches: CSE, semester: 5, scheme: '2021', module: '4', tags: ['memory management', 'paging', 'segmentation', 'virtual memory', 'page replacement', 'thrashing', 'lru', 'fifo'] },
  { title: 'BCS503 Operating Systems — Module 5: File Systems & I/O Management Notes', type: 'notes', subject: 'Operating Systems', subjectCode: 'BCS503', branches: CSE, semester: 5, scheme: '2021', module: '5', tags: ['file systems', 'io management', 'disk scheduling', 'directory structure', 'allocation methods', 'thrashing'] },
  { title: 'BCS503 Operating Systems — Dec 2023 Question Paper', type: 'pyq', subject: 'Operating Systems', subjectCode: 'BCS503', branches: CSE, semester: 5, scheme: '2021', tags: ['deadlock', 'paging', 'scheduling', 'synchronization', 'full paper'], year: '2023' },
  { title: 'BCS503 Operating Systems — Jun 2023 Question Paper', type: 'pyq', subject: 'Operating Systems', subjectCode: 'BCS503', branches: CSE, semester: 5, scheme: '2021', tags: ['bankers algorithm', 'deadlock', 'virtual memory', 'file systems', 'full paper'], year: '2023' },
  { title: 'BCS503 Operating Systems — Dec 2022 Question Paper', type: 'pyq', subject: 'Operating Systems', subjectCode: 'BCS503', branches: CSE, semester: 5, scheme: '2021', tags: ['process scheduling', 'semaphore', 'deadlock prevention', 'memory management', 'full paper'], year: '2022' },
  { title: 'BCS503 Operating Systems — Jun 2022 Question Paper', type: 'pyq', subject: 'Operating Systems', subjectCode: 'BCS503', branches: CSE, semester: 5, scheme: '2021', tags: ['threads', 'deadlock', 'page replacement', 'disk scheduling', 'full paper'], year: '2022' },
  { title: 'BCS503 Operating Systems — Question Bank (Module-wise)', type: 'question_bank', subject: 'Operating Systems', subjectCode: 'BCS503', branches: CSE, semester: 5, scheme: '2021', tags: ['deadlock', 'scheduling', 'memory', 'question bank', 'important questions'] },
  { title: 'BCS503 Operating Systems — Scheme of Evaluation 2021', type: 'scheme_of_evaluation', subject: 'Operating Systems', subjectCode: 'BCS503', branches: CSE, semester: 5, scheme: '2021', tags: ['marks distribution', 'evaluation', 'answer key'] },

  // --- Database Management Systems (BCS402, 2021 scheme) ---
  { title: 'BCS402 Database Management Systems — Module 1: ER Model & Relational Model Notes', type: 'notes', subject: 'Database Management Systems', subjectCode: 'BCS402', branches: CSE, semester: 4, scheme: '2021', module: '1', tags: ['er model', 'relational model', 'sql', 'keys', 'normalization', 'schema'] },
  { title: 'BCS402 Database Management Systems — Module 2: SQL & PL/SQL Notes', type: 'notes', subject: 'Database Management Systems', subjectCode: 'BCS402', branches: CSE, semester: 4, scheme: '2021', module: '2', tags: ['sql', 'pl/sql', 'joins', 'queries', 'triggers', 'stored procedures'] },
  { title: 'BCS402 Database Management Systems — Module 3: Normalization & Query Processing Notes', type: 'notes', subject: 'Database Management Systems', subjectCode: 'BCS402', branches: CSE, semester: 4, scheme: '2021', module: '3', tags: ['normalization', '1nf', '2nf', '3nf', 'bcnf', 'functional dependency', 'query processing', 'query optimization'] },
  { title: 'BCS402 Database Management Systems — Module 4: Transaction Management & Concurrency Notes', type: 'notes', subject: 'Database Management Systems', subjectCode: 'BCS402', branches: CSE, semester: 4, scheme: '2021', module: '4', tags: ['transaction', 'acid', 'concurrency control', 'locking', '2pl', 'serializability', 'deadlock', 'recovery'] },
  { title: 'BCS402 Database Management Systems — Module 5: Indexing & NoSQL Overview Notes', type: 'notes', subject: 'Database Management Systems', subjectCode: 'BCS402', branches: CSE, semester: 4, scheme: '2021', module: '5', tags: ['indexing', 'b+ tree', 'hashing', 'nosql', 'mongodb'] },
  { title: 'BCS402 Database Management Systems — Dec 2023 Question Paper', type: 'pyq', subject: 'Database Management Systems', subjectCode: 'BCS402', branches: CSE, semester: 4, scheme: '2021', tags: ['normalization', 'sql', 'acid', 'er model', 'full paper'], year: '2023' },
  { title: 'BCS402 Database Management Systems — Jun 2023 Question Paper', type: 'pyq', subject: 'Database Management Systems', subjectCode: 'BCS402', branches: CSE, semester: 4, scheme: '2021', tags: ['bcnf', 'query optimization', 'normalization', 'joins', 'full paper'], year: '2023' },
  { title: 'BCS402 Database Management Systems — Dec 2022 Question Paper', type: 'pyq', subject: 'Database Management Systems', subjectCode: 'BCS402', branches: CSE, semester: 4, scheme: '2021', tags: ['transaction', 'normal forms', 'sql', 'full paper'], year: '2022' },
  { title: 'BCS402 Database Management Systems — Question Bank (Normalization & SQL)', type: 'question_bank', subject: 'Database Management Systems', subjectCode: 'BCS402', branches: CSE, semester: 4, scheme: '2021', tags: ['normalization', 'sql queries', 'important questions', 'question bank'] },
  { title: 'BCS402 Database Management Systems — VTU Syllabus (2021 Scheme)', type: 'syllabus', subject: 'Database Management Systems', subjectCode: 'BCS402', branches: CSE, semester: 4, scheme: '2021', tags: ['syllabus', 'course outcomes'] },

  // --- Computer Networks (BCS502, 2021 scheme) ---
  { title: 'BCS502 Computer Networks — Module 1: Data Communications & Physical Layer Notes', type: 'notes', subject: 'Computer Networks', subjectCode: 'BCS502', branches: CSE, semester: 5, scheme: '2021', module: '1', tags: ['physical layer', 'transmission media', 'encoding', 'multiplexing', 'networks'] },
  { title: 'BCS502 Computer Networks — Module 2: Data Link Layer & Error Detection Notes', type: 'notes', subject: 'Computer Networks', subjectCode: 'BCS502', branches: CSE, semester: 5, scheme: '2021', module: '2', tags: ['framing', 'error detection', 'crc', 'hamming code', 'flow control', 'sliding window', 'ethernet'] },
  { title: 'BCS502 Computer Networks — Module 3: Network Layer & Routing Notes', type: 'notes', subject: 'Computer Networks', subjectCode: 'BCS502', branches: CSE, semester: 5, scheme: '2021', module: '3', tags: ['ip addressing', 'routing algorithms', 'dijkstra', 'subnetting', 'icmp', 'congestion control'] },
  { title: 'BCS502 Computer Networks — Module 4: Transport Layer — TCP vs UDP Notes', type: 'notes', subject: 'Computer Networks', subjectCode: 'BCS502', branches: CSE, semester: 5, scheme: '2021', module: '4', tags: ['tcp', 'udp', 'tcp vs udp', 'three way handshake', 'flow control', 'congestion control', 'ports'] },
  { title: 'BCS502 Computer Networks — Module 5: Application Layer & Security Notes', type: 'notes', subject: 'Computer Networks', subjectCode: 'BCS502', branches: CSE, semester: 5, scheme: '2021', module: '5', tags: ['http', 'dns', 'smtp', 'encryption', 'tls', 'application layer', 'security'] },
  { title: 'BCS502 Computer Networks — Dec 2023 Question Paper', type: 'pyq', subject: 'Computer Networks', subjectCode: 'BCS502', branches: CSE, semester: 5, scheme: '2021', tags: ['tcp', 'routing', 'crc', 'subnetting', 'full paper'], year: '2023' },
  { title: 'BCS502 Computer Networks — Jun 2022 Question Paper', type: 'pyq', subject: 'Computer Networks', subjectCode: 'BCS502', branches: CSE, semester: 5, scheme: '2021', tags: ['ip addressing', 'tcp vs udp', 'sliding window', 'full paper'], year: '2022' },

  // --- Design & Analysis of Algorithms (BCS404, 2021 scheme) ---
  { title: 'BCS404 Design & Analysis of Algorithms — Module 1: Asymptotic Notation & Recurrences Notes', type: 'notes', subject: 'Design & Analysis of Algorithms', subjectCode: 'BCS404', branches: CSE, semester: 4, scheme: '2021', module: '1', tags: ['big o', 'asymptotic notation', 'recurrence relations', 'master theorem', 'algorithm analysis'] },
  { title: 'BCS404 Design & Analysis of Algorithms — Module 2: Divide and Conquer Notes', type: 'notes', subject: 'Design & Analysis of Algorithms', subjectCode: 'BCS404', branches: CSE, semester: 4, scheme: '2021', module: '2', tags: ['divide and conquer', 'merge sort', 'quick sort', 'strassen', 'binary search'] },
  { title: 'BCS404 Design & Analysis of Algorithms — Module 3: Dynamic Programming & Greedy Notes', type: 'notes', subject: 'Design & Analysis of Algorithms', subjectCode: 'BCS404', branches: CSE, semester: 4, scheme: '2021', module: '3', tags: ['dynamic programming', 'knapsack', 'matrix chain multiplication', 'greedy', 'huffman coding', 'prims', 'kruskals'] },
  { title: 'BCS404 Design & Analysis of Algorithms — Module 4: Graph Algorithms Notes', type: 'notes', subject: 'Design & Analysis of Algorithms', subjectCode: 'BCS404', branches: CSE, semester: 4, scheme: '2021', module: '4', tags: ['graph algorithms', 'bfs', 'dfs', 'shortest path', 'dijkstra', 'topological sort', 'mst'] },
  { title: 'BCS404 Design & Analysis of Algorithms — Dec 2023 Question Paper', type: 'pyq', subject: 'Design & Analysis of Algorithms', subjectCode: 'BCS404', branches: CSE, semester: 4, scheme: '2021', tags: ['dynamic programming', 'recurrence', 'greedy', 'full paper'], year: '2023' },

  // --- Artificial Intelligence (BCS602, 2021 scheme) ---
  { title: 'BCS602 Artificial Intelligence — Module 1: Intelligent Agents & Problem Solving Notes', type: 'notes', subject: 'Artificial Intelligence', subjectCode: 'BCS602', branches: CSE, semester: 6, scheme: '2021', module: '1', tags: ['intelligent agents', 'search algorithms', 'bfs', 'dfs', 'a* search', 'heuristic', 'csp'] },
  { title: 'BCS602 Artificial Intelligence — Module 2: Knowledge Representation & Logic Notes', type: 'notes', subject: 'Artificial Intelligence', subjectCode: 'BCS602', branches: CSE, semester: 6, scheme: '2021', module: '2', tags: ['knowledge representation', 'propositional logic', 'predicate logic', 'inference', 'semantic networks'] },
  { title: 'BCS602 Artificial Intelligence — Module 4: Machine Learning Concepts Notes', type: 'notes', subject: 'Artificial Intelligence', subjectCode: 'BCS602', branches: CSE, semester: 6, scheme: '2021', module: '4', tags: ['machine learning', 'classification', 'regression', 'supervised learning', 'neural networks'] },
  { title: 'BCS602 Artificial Intelligence — Dec 2022 Question Paper', type: 'pyq', subject: 'Artificial Intelligence', subjectCode: 'BCS602', branches: CSE, semester: 6, scheme: '2021', tags: ['a* search', 'propositional logic', 'csp', 'full paper'], year: '2022' },

  // --- Compiler Design (BCS603, 2021 scheme) ---
  { title: 'BCS603 Compiler Design — Module 2: Lexical & Syntax Analysis Notes', type: 'notes', subject: 'Compiler Design', subjectCode: 'BCS603', branches: CSE, semester: 6, scheme: '2021', module: '2', tags: ['lexical analysis', 'syntax analysis', 'finite automata', 'regex', 'll parsing', 'lr parsing', 'grammar'] },
  { title: 'BCS603 Compiler Design — Module 4: Code Optimization & Generation Notes', type: 'notes', subject: 'Compiler Design', subjectCode: 'BCS603', branches: CSE, semester: 6, scheme: '2021', module: '4', tags: ['code optimization', 'code generation', 'dag', 'three address code'] },

  // --- Software Engineering (BCS601, 2021 scheme) ---
  { title: 'BCS601 Software Engineering — Module 2: Software Design & UML Notes', type: 'notes', subject: 'Software Engineering', subjectCode: 'BCS601', branches: CSE, semester: 6, scheme: '2021', module: '2', tags: ['uml', 'software design', 'cohesion', 'coupling', 'design patterns', 'class diagram', 'sequence diagram'] },
  { title: 'BCS601 Software Engineering — Module 3: Software Testing Notes', type: 'notes', subject: 'Software Engineering', subjectCode: 'BCS601', branches: CSE, semester: 6, scheme: '2021', module: '3', tags: ['software testing', 'black box testing', 'white box testing', 'unit testing', 'integration testing'] },

  // --- Microcontrollers (ECS453, ECE) ---
  { title: 'ECS453 Microcontrollers — Module 3: 8051 Timer & Interrupt Programming Notes', type: 'notes', subject: 'Microcontrollers', subjectCode: 'ECS453', branches: ECE_EEE, semester: 5, scheme: '2021', module: '3', tags: ['8051', 'timers', 'interrupts', 'assembly', 'embedded'] },

  // --- Thermal Engineering (1XX5xx, ME) ---
  { title: 'Thermodynamics — Module 2: Laws of Thermodynamics Notes (ME, 2021 Scheme)', type: 'notes', subject: 'Thermodynamics', subjectCode: 'MEC462', branches: ['ME'], semester: 6, scheme: '2021', module: '2', tags: ['thermodynamics', 'first law', 'second law', 'entropy', 'heat engines'] },

  // --- 2022 NEP Scheme samples ---
  { title: 'Operating Systems (2022 Scheme) — Module 3: Deadlocks Notes', type: 'notes', subject: 'Operating Systems', subjectCode: '22CSH07', branches: CSE, semester: 5, scheme: '2022', module: '3', tags: ['deadlock', 'bankers algorithm', 'deadlock prevention', 'necessary conditions'] },
  { title: 'Database Management Systems (2022 Scheme) — Module 3: Normalization Notes', type: 'notes', subject: 'Database Management Systems', subjectCode: '22CS06', branches: CSE, semester: 4, scheme: '2022', module: '3', tags: ['normalization', '1nf', '2nf', '3nf', 'bcnf', 'functional dependency'] },
  { title: 'Operating Systems (2022 Scheme) — VTU Syllabus', type: 'syllabus', subject: 'Operating Systems', subjectCode: '22CSH07', branches: CSE, semester: 5, scheme: '2022', tags: ['syllabus', 'course outcomes'] },

  // --- 2018 scheme sample ---
  { title: '18CS65 PC Operating System Concepts — Unit 3: Deadlock Notes', type: 'notes', subject: 'Operating System Concepts', subjectCode: '18CS65', branches: CSE, semester: 7, scheme: '2018', module: '3', tags: ['deadlock', 'bankers algorithm', 'deadlock prevention', 'necessary conditions'] },

  // --- Multi-branch general ---
  { title: 'Engineering Mathematics IV — Differential Equations Notes (CSE/ISE/AIML)', type: 'notes', subject: 'Engineering Mathematics IV', subjectCode: 'BCS403', branches: CSE, semester: 4, scheme: '2021', tags: ['differential equations', 'laplace transforms', 'mathematics'] },
  { title: 'Professional Ethics — VTU 2021 Scheme Syllabus', type: 'syllabus', subject: 'Professional Ethics', subjectCode: 'BCS413', branches: ALL_ENG, semester: 4, scheme: '2021', tags: ['ethics', 'syllabus', 'professional ethics'] },
];

export const STUB_RESOURCES: ResourceItem[] = STUB_SEEDS.map((seed, index) => ({
  id: `stub-${String(index + 1).padStart(3, '0')}`,
  title: seed.title,
  type: seed.type,
  subject: seed.subject,
  subjectCode: seed.subjectCode,
  branch: seed.branches.join('/'),
  semester: seed.semester,
  scheme: seed.scheme,
  module: seed.module,
  tags: seed.tags,
  fileUrl: null, // stub records intentionally carry no file links
  stub: true,
  source: 'VTUSync',
}));

export const RESOURCE_TYPE_LABELS: Record<ResourceType, string> = {
  notes: 'Notes',
  pyq: 'PYQ',
  question_bank: 'Question Bank',
  syllabus: 'Syllabus',
  scheme_of_evaluation: 'Scheme of Evaluation',
  pdf: 'PDF',
};

/* ---------------- Retrieval ---------------- */

const STOPWORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'in', 'of', 'for', 'to', 'and', 'or', 'on', 'at',
  'me', 'i', 'my', 'please', 'find', 'give', 'get', 'show', 'list', 'explain', 'tell',
  'about', 'notes', 'note', 'question', 'questions', 'pyq', 'pyqs', 'paper', 'papers',
  'with', 'from', 'this', 'that', 'what', 'how', 'why', 'does', 'do', 'can', 'could',
  'need', 'want', 'provide', 'share', 'there', 'any', 'some', 'write', 'answers', 'answer',
]);

const SCHEME_ALIASES: Record<string, string> = {
  '2022': '2022',
  'nep 2022': '2022',
  '2021': '2021',
  '2018': '2018',
};

export function normalizeScheme(scheme?: string | null): string | null {
  if (!scheme) return null;
  const key = scheme.trim().toLowerCase().replace(/\s+/g, ' ');
  return SCHEME_ALIASES[key] ?? null;
}

function stem(token: string): string {
  if (token.endsWith('ies') && token.length > 4) return `${token.slice(0, -3)}y`;
  if (token.endsWith('es') && token.length > 4) return token.slice(0, -2);
  if (token.endsWith('s') && !token.endsWith('ss') && token.length > 3) return token.slice(0, -1);
  return token;
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9+]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t))
    .map(stem);
}

export interface ResourceSearchOptions {
  query: string;
  branch?: string | null;
  semester?: number | null;
  scheme?: string | null;
  subjectCode?: string | null;
  module?: string | null;
  limit?: number;
  /** Minimum relevance score to be considered a match. */
  minScore?: number;
}

interface ScoredResource {
  resource: ResourceItem;
  score: number;
}

/** Exported for diagnostics/tests. */
export function scoreResource(resource: ResourceItem, opts: ResourceSearchOptions): number {
  const qTokens = tokenize(opts.query);
  const queryRaw = opts.query.toLowerCase();

  const hayTitle = tokenize(resource.title);
  const haySubject = tokenize(resource.subject);
  const hayTags = resource.tags.map((t) => t.toLowerCase());
  const code = resource.subjectCode.toLowerCase();

  let score = 0;

  // Context boost: when the student shared their subject code, prefer
  // same-subject resources, but keep the threshold low so the model can
  // still fall back to external sources when nothing matches.
  const hasContextSubject =
    !!opts.subjectCode &&
    opts.subjectCode.trim().toLowerCase() === code;
  if (hasContextSubject) score += 6;

  const titleSet = new Set(hayTitle);
  const subjectSet = new Set(haySubject);
  const tagSet = new Set(hayTags.flatMap(tokenize));

  // Topical signal — only matches between the query and the resource itself.
  let topical = 0;
  for (const token of qTokens) {
    if (titleSet.has(token)) topical += 2;
    if (subjectSet.has(token)) topical += 2;
    if (tagSet.has(token)) topical += 1.5;
    // Substring tag match catches "deadlock" inside "deadlock prevention" etc.
    if (hayTags.some((t) => t.includes(token) && token.length >= 4)) topical += 1;
  }

  // Module match: query mentions "module 3" / "unit 3".
  const moduleMatch = queryRaw.match(/(?:module|unit|m|u)\s*-?\s*([1-9])/);
  const moduleTopical = moduleMatch && resource.module && resource.module === moduleMatch[1]
    ? 2.5
    : opts.module && resource.module === String(opts.module).trim()
      ? 1.5
      : 0;

  // Exact phrase boost (e.g. "deadlock prevention" appearing in a tag).
  let phraseTopical = 0;
  for (const tag of hayTags) {
    if (tag.length >= 6 && queryRaw.includes(tag)) phraseTopical += 2;
  }

  score = topical + moduleTopical + phraseTopical + (hasContextSubject ? 6 : 0);

  // Context mismatch penalties — soft, so we can relax later.
  const wantScheme = normalizeScheme(opts.scheme);
  if (wantScheme && resource.scheme !== wantScheme) score -= 2;
  const branch = (opts.branch || '').trim().toUpperCase();
  if (branch && !resource.branch.toUpperCase().includes(branch)) score -= 2;
  if (typeof opts.semester === 'number' && Number.isFinite(opts.semester) && resource.semester !== opts.semester) {
    score -= 1;
  }

  // Retrieval gate: require genuine topical signal between query and the
  // resource. "hi" (no topic tokens) or a bare subject-code lookup with no
  // matching content falls through to general knowledge instead of dumping
  // the whole stub index.
  const totalTopical = topical + moduleTopical + phraseTopical;
  if (totalTopical < 0.5) return 0;

  return score;
}

/**
 * Search the (stub) VTUSync resource store.
 * Retrieval-first: returns resources ranked by relevance with a minimum-score
 * cutoff; callers decide what to do when nothing relevant comes back.
 */
export function searchResources(opts: ResourceSearchOptions): ResourceItem[] {
  const limit = Math.min(Math.max(opts.limit ?? 8, 1), 25);
  const minScore = opts.minScore ?? 2;

  const scored: ScoredResource[] = [];
  for (const resource of STUB_RESOURCES) {
    const score = scoreResource(resource, opts);
    if (score >= minScore) scored.push({ resource, score });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((s) => s.resource);
}

/** True when the top results look relevant enough to stand on their own. */
export function hasRelevantResults(resources: ResourceItem[]): boolean {
  return resources.length > 0;
}
