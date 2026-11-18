// main.ts — Entrypoint ARUNIKA BAY (gta6-01) untuk Make Fun.
//
// Node 22, standard library saja, tanpa network. Program ini menyerahkan
// game ke grader: menyalin folder game/ dan screenshots/ dari samping file
// ini ke direktori output, lalu menulis dossier.json (ringkasan yang dibaca
// juri) dengan library make.fun yang di-vendor.
//
// Di luar container grader, MAKEFUN_OUTPUT_DIR menggantikan /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
//
// Batas yang dipakai (dari gate kompetisi): paling banyak 4 screenshot,
// masing-masing paling besar 262.144 byte; game paling banyak 993 file /
// 48 MiB; teks dossier paling banyak 163.840 byte.

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

/** Slug kompetisi + nama entri game ini. */
export const ARUNIKA_BAY_ENTRY = 'gta6-01';

/** Screenshot pertama menurut nama = cover dossier. */
export const ARUNIKA_BAY_COVER = '1-cover-chase.jpg';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// --- Penjaga: game/index.html wajib ada, kalau tidak penyerahan ditolak. ---
const entryHtml = join(here, 'game', 'index.html');
if (!existsSync(entryHtml)) {
  console.error(`ARUNIKA BAY: game/index.html tidak ditemukan di ${here} — batal.`);
  process.exit(1);
}

// --- Salin game/ + screenshots/ ke output. ---
mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
console.log('ARUNIKA BAY: game/ disalin ke', join(out, 'game'));
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
}

// --- Daftar screenshot yang ikut diserahkan (maksimal 4, urut nama). ---
const shotDir = join(here, 'screenshots');
let shots: string[] = [];
if (existsSync(shotDir)) {
  shots = readdirSync(shotDir)
    .filter((name) => /\.(png|jpe?g)$/i.test(name))
    .sort()
    .slice(0, 4);
}
for (const shot of shots) {
  const size = statSync(join(shotDir, shot)).size;
  if (size > 262144) {
    console.error(`ARUNIKA BAY: screenshot ${shot} ${size} byte > 262144 — batal.`);
    process.exit(1);
  }
}
console.log(`ARUNIKA BAY: ${shots.length} screenshot (${shots.join(', ')})`);
console.log(`ARUNIKA BAY: cover = ${ARUNIKA_BAY_COVER}`);

// --- Tulis dossier.json: ringkasan yang dibaca juri. ---
// Caps scorer: teks paling banyak 163.840 byte; screenshot paling banyak 4
// @ 262.144 byte; game paling banyak 993 file / 48 MiB; path di bawah game/
// paling panjang 1.000 byte. buildDossier menolak entri yang melanggar.
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
console.log('ARUNIKA BAY: dossier.json ditulis');
console.log(`ARUNIKA BAY: entri ${ARUNIKA_BAY_ENTRY} siap diserahkan`);
