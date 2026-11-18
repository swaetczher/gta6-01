// main.ts — ARUNIKA BAY (Make Fun gta6-01): program penyerahan entri.
// Node 22, standard library saja, tanpa install dan tanpa network.
// Menyalin game/ + screenshots/ dari sebelah file ini ke direktori
// output (env MAKEFUN_OUTPUT_DIR, default /output di container grader),
// lalu menulis /output/dossier.json lewat buildDossier dari
// ./vendor/makefun-game.ts (file kit — JANGAN diubah).
//
// Pemakaian lokal:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// Di container grader, MAKEFUN_OUTPUT_DIR tidak di-set sehingga output
// jatuh ke /output. Program ini deterministik: dua run menulis byte
// yang sama persis selama isi game/ + screenshots/ tidak berubah.
import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
const gameDir = join(here, 'game');
const shotsDir = join(here, 'screenshots');

// Guard awal: game/index.html wajib ada — tanpa itu entri bukan game
// playable dan grader pasti menolak. Gagal cepat dengan pesan jelas.
if (!existsSync(join(gameDir, 'index.html'))) {
  console.error('ARUNIKA BAY: game/index.html tidak ditemukan di', gameDir);
  process.exit(1);
}

mkdirSync(out, { recursive: true });
cpSync(gameDir, join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(shotsDir)) {
  cpSync(shotsDir, join(out, 'screenshots'), { recursive: true });
}

// Ringkasan isi untuk log: jumlah file game + screenshot (cover =
// file pertama menurut nama — harus adegan kejar-kejaran polisi).
const shotNames = existsSync(shotsDir)
  ? readdirSync(shotsDir).filter((n) => statSync(join(shotsDir, n)).isFile()).sort()
  : [];
console.log(`ARUNIKA BAY: game/ disalin ke ${out}/game`);
console.log(`ARUNIKA BAY: ${shotNames.length} screenshot (${shotNames.join(', ') || 'belum ada'})`);
if (shotNames.length > 0) console.log(`ARUNIKA BAY: cover = ${shotNames[0]}`);
if (shotNames.length < 3) {
  console.warn('ARUNIKA BAY: PERINGATAN — screenshot kurang dari 3; gate meminta 3-4 file.');
}

// Caps dari gate.json kompetisi (lihat riset.md): hanya text_max_bytes
// yang membentuk byte dossier; caps lain menolak entri yang memang
// akan ditolak scorer (screenshot >4 / >256 KiB, game/ >993 file /
// 48 MiB, path game/ >1000 byte).
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
console.log('ARUNIKA BAY: dossier.json ditulis — entri siap diperiksa (makefun check).');
// --- akhir main.ts (baris revisi ditambahkan lewat edit terpisah) ---
// Revisi terekam: guard game/index.html + log jumlah screenshot/cover
// ditambahkan supaya kegagalan pengemasan ketahuan di log sebelum
// dossier ditulis — bukan sesudah submit ditolak gate.
export const ARUNIKA_BAY_ENTRY = 'gta6-01';
export const ARUNIKA_BAY_COVER_HINT = '1-cover-chase.jpg';
