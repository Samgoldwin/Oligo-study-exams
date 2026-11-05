# SyncAI — Expo App (React Native)

Native mobile client for SyncAI (VTUSync academic assistant). Implements:

- **AI Chat** — dark themed chat with user/assistant bubbles, VTUSync resource cards, YouTube results, grounding footer, and "Thinking…" indicator. Reuses the exact same backend as the web app.
- **PYQ Analysis** — enter syllabus, paste question-paper text, generate an exam-sprint question bank; results show summary, study hours, "Do this first" priority order, focus areas, and module-wise questions (expandable).

## How to run

```bash
npm install
npm run ios      # or: npm run android / npm run web
```

> The app talks to the backend over HTTP. Set the API base URL before running:

```bash
# local dev API (same machine / emulator)
EXPO_PUBLIC_API_URL=http://localhost:8787

# Android emulator → host machine loopback
EXPO_PUBLIC_API_URL=http://10.0.2.2:8787

# deployed backend (Vercel etc.)
EXPO_PUBLIC_API_URL=https://your-app.vercel.app
```

Copy `.env.example` → `.env` (Expo auto-loads `EXPO_PUBLIC_*` via the environment at build time).

## Notes / limitations (Expo MVP)

- **Papers are added by pasting text** — on-device PDF → text extraction/OCR is not included yet. (The web app does PDF+OCR via pdf.js/Tesseract in-browser.)
- Chat history is session-local (in-memory); full history sync is not implemented in this MVP.
- Backend must be publicly reachable from the device (use the deployed URL on physical devices; `localhost` only works on the same machine).
- YouTube search requires `YOUTUBE_API_KEY` to be configured on the backend, not in this app.

## Structure

```
App.tsx                 tab shell (AI Chat / PYQ Analysis)
src/api/client.ts        chat + analyze API calls
src/screens/ChatScreen.tsx
src/screens/PyqScreen.tsx
src/components/ui.tsx     Card / Chip / PrimaryButton
src/theme.ts              zinc-dark palette shared with web app
```
