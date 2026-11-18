// serve.ts — Server lokal ARUNIKA BAY (gta6-01).
//
// Node 22, standard library saja, tanpa network keluar. Menyajikan repo ini
// (game/index.html + aset statis) di 127.0.0.1 port 8901 — hanya untuk
// pengembangan dan pengambilan screenshot, bukan bagian dari entri yang
// diserahkan (grader membaca file statis langsung).
//
//   node serve.ts
//   buka http://127.0.0.1:8901/game/index.html
//   mode shot: http://127.0.0.1:8901/game/index.html?shot=cover&seed=1

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Port default server lokal. */
export const SERVE_PORT = 8901;

/** Host yang di-listen (loopback saja — tidak diekspos ke jaringan). */
export const SERVE_HOST = '127.0.0.1';

const here = fileURLToPath(new URL('.', import.meta.url));

// Tipe konten untuk ekstensi yang disajikan game ini.
const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.md': 'text/markdown; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
};

/** Normalisasi path URL menjadi path file di dalam repo (tolak ..). */
function resolvePath(urlPath: string): string | null {
  const clean = decodeURIComponent(urlPath.split('?')[0]);
  const rel = normalize(clean).replace(/^(\.\.[/\\])+/, '').replace(/^[/\\]/, '');
  const full = join(here, rel);
  if (!full.startsWith(here)) return null;
  return full;
}

const server = createServer(async (req, res) => {
  try {
    const urlPath = req.url === '/' ? '/game/index.html' : req.url || '/';
    const file = resolvePath(urlPath);
    if (!file || !existsSync(file)) {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('404 — tidak ditemukan\n');
      return;
    }
    const body = await readFile(file);
    const type = MIME[extname(file).toLowerCase()] || 'application/octet-stream';
    res.writeHead(200, { 'content-type': type, 'content-length': body.length });
    res.end(body);
  } catch (err) {
    res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
    res.end(`500 — ${err instanceof Error ? err.message : 'gagal membaca file'}\n`);
  }
});

const port = Number(process.env.PORT) || SERVE_PORT;
server.listen(port, SERVE_HOST, () => {
  console.log(`ARUNIKA BAY: serve di http://${SERVE_HOST}:${port}/game/index.html`);
});
