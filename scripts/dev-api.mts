/**
 * Local dev API server — mirrors Vercel's /api serverless routing for
 * `npm run dev` (the Vite dev server proxies /api here, see vite.config.ts).
 * Production deployments use the real serverless functions under /api.
 */
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.DEV_API_PORT || 8787);

/* Minimal .env / .env.local loader (no dependency). */
for (const name of ['.env', '.env.local']) {
  const file = path.join(ROOT, name);
  if (!existsSync(file)) continue;
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    const [, key, raw] = match;
    if (process.env[key] !== undefined) continue;
    process.env[key] = raw.replace(/^['"]|['"]$/g, '');
  }
}

const ROUTES: Record<string, string> = {
  '/api/analyze': 'api/analyze.ts',
  '/api/syncai/chat': 'api/syncai/chat.ts',
  '/api/syncai/exam-answer': 'api/syncai/exam-answer.ts',
  '/api/syncai/resources/search': 'api/syncai/resources/search.ts',
  '/api/syncai/youtube/search': 'api/syncai/youtube/search.ts',
  '/api/syncai/documents/ask': 'api/syncai/documents/ask.ts',
  '/api/syncai/detect-syllabus': 'api/syncai/detect-syllabus.ts',
  '/api/syncai/models': 'api/syncai/models.ts',
};

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);
    const pathname = url.pathname.replace(/\/+$/, '') || '/';
    const routeFile = ROUTES[pathname];

    if (!routeFile) {
      res.writeHead(404, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'not_found', message: `No route for ${pathname}` }));
      return;
    }

    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk as Buffer);
    const raw = Buffer.concat(chunks).toString('utf8').trim();

    let body: unknown = {};
    if (raw.length > 0) {
      try {
        body = JSON.parse(raw);
      } catch {
        res.writeHead(400, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: 'invalid_json', message: 'Request body must be valid JSON.' }));
        return;
      }
    }

    const mod = (await import(pathToFileURL(path.join(ROOT, routeFile)).href)) as {
      default: (req: unknown, res: unknown) => Promise<unknown>;
    };

    const vercelReq = Object.assign(req, {
      body,
      query: Object.fromEntries(url.searchParams),
    });

    const vercelRes = Object.assign(res, {
      statusCode: 200,
      status(code: number) {
        res.statusCode = code;
        return this;
      },
      json(payload: unknown) {
        if (!res.headersSent) res.setHeader('content-type', 'application/json; charset=utf-8');
        res.end(JSON.stringify(payload));
        return this;
      },
      send(payload: unknown) {
        res.end(typeof payload === 'string' ? payload : JSON.stringify(payload));
        return this;
      },
    });

    await mod.default(vercelReq, vercelRes);
  } catch (err) {
    console.error('[dev-api] error:', err);
    if (!res.headersSent) res.setHeader('content-type', 'application/json; charset=utf-8');
    res.statusCode = 500;
    res.end(JSON.stringify({ error: 'dev_api_error', message: 'Internal dev API error. See terminal output.' }));
  }
});

server.listen(PORT, () => {
  console.log(`[dev-api] /api routes ready on http://localhost:${PORT}`);
});
