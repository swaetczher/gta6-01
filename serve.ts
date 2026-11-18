// serve.ts — Server lokal kecil untuk memainkan ARUNIKA BAY di peramban.
// Dijalankan: node serve.ts
// Melayani repo ini di 127.0.0.1:8901; game dibuka lewat /game/index.html
// atau langsung / (dialihkan ke game). Tanpa dependensi, stdlib saja.

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';

export const SERVE_PORT = 8901;
export const SERVE_HOST = '127.0.0.1';

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
  '.md': 'text/plain; charset=utf-8',
};

export function repoRoot(): string {
  return resolve(import.meta.dirname ?? '.');
}

// Ubah path URL menjadi path file di dalam repo; tolak jalan keluar repo.
export function resolveFile(urlPath: string, root: string): string | null {
  const clean = decodeURIComponent(urlPath.split('?')[0].split('#')[0]);
  const rel = clean === '/' ? 'game/index.html' : clean.replace(/^\//, '');
  const full = resolve(join(root, rel));
  if (!full.startsWith(root)) return null;
  if (!existsSync(full)) return null;
  if (statSync(full).isDirectory()) {
    const index = join(full, 'index.html');
    return existsSync(index) ? index : null;
  }
  return full;
}

export function handleRequest(req: IncomingMessage, res: ServerResponse, root: string): void {
  const urlPath = req.url || '/';
  const file = resolveFile(urlPath, root);
  if (!file) {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('404 tidak ditemukan\n');
    return;
  }
  const ext = extname(file).toLowerCase();
  const type = MIME[ext] || 'application/octet-stream';
  try {
    const body = readFileSync(file);
    res.writeHead(200, { 'content-type': type, 'content-length': body.length });
    res.end(body);
  } catch (_err) {
    res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('500 gagal membaca file\n');
  }
}

export function startServer(port: number = SERVE_PORT, host: string = SERVE_HOST): void {
  const root = repoRoot();
  const server = createServer((req, res) => handleRequest(req, res, root));
  server.listen(port, host, () => {
    console.log(`ARUNIKA BAY tersaji di ${host}:${port} (root ${root})`);
    console.log(`Buka ${host}:${port}/ untuk bermain`);
  });
}

const invokedAsScript = Boolean(
  process.argv[1] && resolve(process.argv[1]) === resolve(join(repoRoot(), 'serve.ts')),
);
if (invokedAsScript) {
  startServer();
}
