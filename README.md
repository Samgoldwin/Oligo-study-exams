# SyncAI — VTUSync AI Academic Assistant

SyncAI is an AI-powered academic assistant for VTU engineering students, built as a
feature of VTUSync, plus a PYQ (previous-year-question) planner. Students can ask
natural-language academic questions and get VTU-aware answers grounded in VTUSync
resources first, with external sources (YouTube) only when VTUSync coverage is
insufficient — per the **SyncAI Resource Search Priority Policy** (VTUSync →
external → general AI knowledge).

## Features

### SyncAI Chat (P0 / MVP)
- **AI Study Chat** — natural-language Q&A with conversation context and persistent (localStorage) chat history, rendered by the **official assistant-ui `Thread`** stack and **Prompt Kit** visual components (dark Zinc theme, Inter + IBM Plex Mono).
- **VTUSync Resource Search** — retrieval-first search over a stubbed VTUSync resource store (notes, PYQs, syllabus, question banks, scheme of evaluation), ranked by relevance, filtered by branch/semester/scheme/subject code.
    - Resources render in the assistant-ui message *before* the explanation (per the resource-search priority policy); PYQs follow it, then external videos.
- **YouTube Learning Search** — YouTube Data API v3 via the backend, education-category, safe-search on, enhanced academic queries with automatic fallback, 10-minute in-memory cache, graceful quota/error handling.
- **VTU Exam Answer Generator** — marks-aware answers (2 / 5 / 10 / 15) with structure, clearly labeled AI-generated.
- **PDF Chat** — upload a PDF; SyncAI extracts text in the browser (pdf.js) via the composer's paperclip button and answers with `[Page N]` references. Scanned/image PDFs are automatically OCR'd in-browser with Tesseract.js (up to 12 pages, lazy-loaded).
- **Academic context** — branch, semester, scheme (2022-NEP / 2021 / 2018), subject and subject code, sent with every request so retrieval is context-aware.
- **Chat history** — assistant-ui's thread-list sidebar (search, rename, delete, date groups) wired to persistent localStorage conversations.
- **Grounding transparency** — every answer shows its grounding (`vtunsync` / `document` / `general`), sources used, and an AI-generated label.

### PYQ Planner (existing feature, kept)
Upload previous-year papers + paste or **upload the syllabus PDF** → AI-generated
question bank grouped by module with a study plan (Groq `openai/gpt-oss-120b`).
Uploading a syllabus also runs a **detection pass** that identifies the subject,
subject code, semester, branch, and scheme — shown as chips with a one-click
"Apply to SyncAI context" so SyncAI answers draw on the same course.

## Quick start

```bash
npm install
cp .env.example .env.local   # then edit: set GROQ_API_KEY (required for AI answers)
npm run dev                  # web on :5173, dev API on :8787 (proxied at /api)
```

Build & production:

```bash
npm run build                # type-check + vite build → dist/
vercel deploy                # static SPA + /api serverless functions
```

## Frontend stack

| Layer | Implementation |
| --- | --- |
| Chat runtime | `@assistant-ui/react` — `useExternalStoreRuntime` bridging our JSON API (no streaming) |
| Thread UI | Official assistant-ui registry components (`thread.aui.tsx`, `thread-list.aui.tsx`, `markdown-text.tsx`, `reasoning`, `tool-fallback`, attachments, …) installed via the assistant-ui shadcn registry (`radix` style) |
| Visual components | Prompt Kit (via its shadcn registry): `prompt-input`, `message`, `loader`, `markdown`, `code-block`, `scroll-button`, `prompt-suggestion`, `chat-container` |
| Styling | Tailwind CSS v4 (+ `@tailwindcss/typography`, `tw-animate-css`) with the assistant-ui starter's exact oklch Zinc dark theme and component CSS variables; Inter + IBM Plex Mono |
| React | 19 (assistant-ui/Prompt Kit runtime) |
| Legacy pages | PYQ Planner (`components/ExamPlanner.tsx`) keeps its dark variants from the legacy `styles.css` (placed in `@layer components` so Tailwind utilities win ties) |

To re-pull official sources: `npx shadcn@latest add "https://r.assistant-ui.com/styles/radix/<name>.json"` and `npx shadcn@latest add "https://prompt-kit.com/c/<name>.json"`.

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `GROQ_API_KEY` | Yes (for AI) | Groq chat completions (server-side only) |
| `SYNCAI_MODEL` | No | Override chat model (default `openai/gpt-oss-120b`) |
| `YOUTUBE_API_KEY` | No | YouTube Data API v3 key (server-side only). Without it, video search degrades gracefully |
| `DEV_API_PORT` | No | Dev API port (default `8787`) |

Without `GROQ_API_KEY` the app still works, but AI answers return a clear
"AI service unavailable" message; resource search and UI work normally.
Without `YOUTUBE_API_KEY`, video sections show a "not configured" note instead
of failing.

## Architecture

```
Browser (React + assistant-ui)
  └─► /api/syncai/*  ──► dev-api (localhost) ──or──► Vercel serverless (prod)
                           ├─► api/_lib/resources.ts   VTUSync retrieval (stub)
                           ├─► api/_lib/youtube.ts     YouTube Data API v3 + cache
                           ├─► api/_lib/groq.ts        Groq client (keys server-side)
                           ├─► api/_lib/prompt.ts      grounding rules + marks rubric
                           ├─► api/_lib/ratelimit.ts   best-effort in-memory limiter
                           └─► api/_lib/http.ts        validation helpers
```

Retrieval-first flow (`api/syncai/chat.ts`): rate-limit → validate → **VTUSync search**
→ (only if insufficient/requested) **YouTube search** → grounded prompt → Groq →
response with sources, resource cards, and videos. VTU-specific facts are expected
to come from the retrieved context; the model is instructed never to invent
resources, links, pages, or VTU regulations.

Response ordering per the priority policy:
**VTUSync Notes & Resources → AI Explanation → VTUSync PYQs → External YouTube videos**,
with external content clearly labeled.

## Swapping the stub VTUSync layer for the real API

Everything goes through `api/_lib/resources.ts`. Replace `STUB_RESOURCES` and
`searchResources()` internals with calls to the real VTUSync resource service
(return the same `ResourceItem` shape, or adapt it in one place). Nothing else —
handlers, prompt construction, or UI — needs to change. Until then, stub records
carry `stub: true` and `fileUrl: null`; the UI opens a metadata panel instead of
linking to nonexistent files.

## Security & privacy

- AI and YouTube keys live only on the backend; the SPA never sees them.
- In-memory fixed-window rate limiting per IP per endpoint (best-effort on
  serverless — use KV/Redis for strict global limits).
- Uploaded PDFs are processed **in the browser**; extracted text is sent with
  each question but raw files are never uploaded or stored server-side.
- PDFs: 8 MB / 120 pages / 20k chars caps. Scanned PDFs (no text layer) are rejected with a clear message.
- Conversations persist only in the browser's localStorage (`syncai.conversations.v1`). Clearing site data removes them. No server-side storage in this MVP.
- Markdown from the AI is sanitized with DOMPurify before rendering.

## Known limitations (MVP)

- **No authentication** — VTUSync auth is not wired into this standalone build; when merged into VTUSync, reuse its auth for all SyncAI endpoints.
- **OCR** — scanned PDFs are OCR'd client-side with Tesseract.js (capped at 20 pages and ~200 DPI). Very low-quality scans may still fail; OCR quality depends on the source scan.
- Conversations/sync are per-browser; no server-side persistence or export.
- Rate limits and YouTube cache are per serverless instance (not global).
- Stub resource metadata is illustrative — does not represent real VTU files.
- PYQ Analyzer / Notes Summarizer (P1) are not implemented yet.

## Project layout

```
api/                  Vercel serverless functions
  analyze.ts          PYQ planner endpoint (text-extracted input)
  syncai/chat.ts      SyncAI chat (retrieval-first orchestration)
  syncai/exam-answer.ts
  syncai/resources/search.ts
  syncai/youtube/search.ts
  syncai/documents/ask.ts
  syncai/detect-syllabus.ts  subject/sem/scheme detection from syllabus text
  _lib/               shared server modules (retrieval, youtube, groq, prompts, limits)
components/
  syncai/             SyncAI chat UI — assistant-ui runtime + official Thread,
                      Prompt Kit visual components, VTUSync resource/YouTube cards,
                      context bar, sidebar
  assistant-ui/         Official assistant-ui registry components (thread, sidebar,
                      markdown-text, reasoning, tool-fallback, attachments, ...)
  ui/                   shadcn/ui components installed by the shadcn and
                      Prompt Kit CLIs (button, sidebar, dialog, tooltip, ...)
  ExamPlanner.tsx     legacy PYQ planner UI
  ResultView.tsx      question-bank/plan rendering + PDF export
services/             browser-side clients (API, PDF extraction, conversation store)
scripts/dev-api.mts   local /api runner for `npm run dev` (mirrors Vercel routing)
```

## Notes for maintainers

- `vite.config.ts` proxies `/api` → `localhost:8787` in dev only.
- Do not commit `.env.local`. Use `.env.example` as the template.
- `tsc` runs as part of `npm run build`; keep the codebase type-clean.
