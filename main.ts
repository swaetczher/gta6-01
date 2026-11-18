// main.ts — Entrypoint pengiriman ARUNIKA BAY ke kompetisi gta6-01.
// Dijalankan: MAKEFUN_OUTPUT_DIR=out node main.ts
// Tugasnya: pastikan game/index.html ada, salin game/ + screenshots/
// ke direktori output, lalu bangun dossier.json lewat buildDossier
// dari kit (./vendor/makefun-game.ts). Node 22, stdlib saja, tanpa network.

import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { buildDossier } from './vendor/makefun-game.ts';

export const ARUNIKA_BAY_ENTRY = 'gta6-01';
export const COVER_IMAGE = '1-cover-chase.jpg';

// Batas dossier dari kompetisi: 4 screenshot @ 262.144 byte, game
// maks 993 file / 48 MiB, teks dossier maks 4 MiB.
export const DOSSIER_CAPS = {
  text_max_bytes: 4 * 1024 * 1024,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 48 * 1024 * 1024,
};

export function entryDir(): string {
  return resolve(import.meta.dirname ?? '.');
}

export function outputDir(): string {
  const fromEnv = process.env.MAKEFUN_OUTPUT_DIR;
  if (fromEnv && fromEnv.trim().length > 0) return resolve(fromEnv);
  return resolve(entryDir(), 'out');
}

// Penjaga: game/index.html wajib ada sebelum apa pun disalin.
export function assertGameEntry(repoRoot: string): string {
  const indexPath = join(repoRoot, 'game', 'index.html');
  if (!existsSync(indexPath)) {
    throw new Error(`main.ts: game/index.html tidak ditemukan di ${repoRoot}`);
  }
  return indexPath;
}

// Salin satu direktori sumber ke tujuan (rekursif, timpa bila ada).
export function copyTree(source: string, target: string): void {
  mkdirSync(target, { recursive: true });
  cpSync(source, target, { recursive: true, force: true });
}

// Bangun entri lengkap di direktori output: salin game/ + screenshots/,
// lalu tulis dossier.json. Kembalikan path dossier yang ditulis.
export function buildEntry(repoRoot: string, outDir: string): string {
  const indexPath = assertGameEntry(repoRoot);
  void indexPath;
  mkdirSync(outDir, { recursive: true });
  const gameSource = join(repoRoot, 'game');
  const shotsSource = join(repoRoot, 'screenshots');
  copyTree(gameSource, join(outDir, 'game'));
  console.log('game/ disalin');
  if (existsSync(shotsSource)) {
    copyTree(shotsSource, join(outDir, 'screenshots'));
    console.log('screenshots/ disalin');
  } else {
    console.log('screenshots/ tidak ada — dossier tanpa gambar');
  }
  const dossier = buildDossier(outDir, DOSSIER_CAPS);
  const dossierPath = join(outDir, 'dossier.json');
  writeFileSync(dossierPath, dossier);
  console.log(`dossier.json ditulis (${dossier.length} byte)`);
  return dossierPath;
}

// Baca nama file cover dari dossier, untuk memastikan urutan gambar benar.
export function coverFromDossier(dossierPath: string): string {
  const parsed = JSON.parse(readFileSync(dossierPath, 'utf-8')) as {
    images?: Array<{ name?: string }>;
  };
  const first = parsed.images && parsed.images[0];
  return (first && first.name) || '';
}

function main(): void {
  const repoRoot = entryDir();
  const outDir = outputDir();
  const dossierPath = buildEntry(repoRoot, outDir);
  const cover = coverFromDossier(dossierPath);
  if (cover !== COVER_IMAGE) {
    console.log(`peringatan: cover dossier '${cover}', harapan '${COVER_IMAGE}'`);
  } else {
    console.log(`cover dossier benar: ${cover}`);
  }
  console.log(`entri ${ARUNIKA_BAY_ENTRY} siap diserahkan dari ${outDir}`);
}

const invokedAsScript = Boolean(
  process.argv[1] && resolve(process.argv[1]) === resolve(join(entryDir(), 'main.ts')),
);
if (invokedAsScript) {
  main();
}
