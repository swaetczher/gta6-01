// wanted.js — Level buronan (wanted) ARUNIKA BAY.
//
// Panas (heat) 0–100 naik setiap Bara berbuat onar (mencuri mobil, memukul
// preman, menembak) lalu mendingin sendiri kalau Bara bersembunyi. Bintang
// dihitung dari panas: 0 = BERSIH, 1–5 = buronan. Polisi membaca bintang
// ini untuk memutuskan mengejar atau berhenti.
//
// Modul ini murni logika angka — tanpa THREE, tanpa DOM — supaya mudah dites
// di Node. Satu-satunya ketergantungan luar adalah objek jam yang disuntik
// lewat `createWanted` bila pemanggil mau mengunci waktu di tes.

export const HEAT_MAX = 100;
export const HEAT_MIN = 0;
export const STARS_MAX = 5;

// Ambang panas untuk tiap bintang. Bintang 1 mulai dari panas 1 — jadi
// panas 0 selalu berarti BERSIH, bukan satu bintang.
export const STAR_THRESHOLDS = [0, 1, 21, 41, 61, 81];

// Laju panas mendingin per detik saat Bara tidak berbuat onar.
export const HEAT_DECAY_PER_SECOND = 1.5;

// Panas yang ditambahkan tiap perbuatan onar.
export const HEAT_FOR_STEAL = 25;
export const HEAT_FOR_ASSAULT = 10;
export const HEAT_FOR_SHOOT = 15;
export const HEAT_FOR_KILL = 20;

/** Panas (0–100) -> jumlah bintang (0–5). */
export function starsForHeat(heat) {
  const h = clampHeat(heat);
  if (h <= 0) return 0;
  if (h < 21) return 1;
  if (h < 41) return 2;
  if (h < 61) return 3;
  if (h < 81) return 4;
  return 5;
}

/** Bintang -> panas terendah yang menghasilkan bintang itu. */
export function heatForStars(stars) {
  const s = Math.max(0, Math.min(STARS_MAX, Math.floor(stars) || 0));
  return STAR_THRESHOLDS[s];
}

/** Bintang -> label HUD: "BERSIH" atau deretan ★/☆. */
export function wantedLabel(stars) {
  const s = Math.max(0, Math.min(STARS_MAX, Math.floor(stars) || 0));
  if (s === 0) return 'BERSIH';
  return '★'.repeat(s) + '☆'.repeat(STARS_MAX - s);
}

/** Jepit panas ke rentang 0–100 (NaN dianggap 0). */
export function clampHeat(heat) {
  const h = Number(heat);
  if (!Number.isFinite(h)) return 0;
  if (h < HEAT_MIN) return HEAT_MIN;
  if (h > HEAT_MAX) return HEAT_MAX;
  return h;
}

/**
 * Status buronan yang hidup: menyimpan panas, menghitung bintang, dan
 * mendinginkan panas seiring waktu. `onChange` dipanggil setiap kali
 * jumlah bintang berubah (HUD + polisi mendengarkannya).
 *
 * @param {number} [initialHeat=0] panas awal
 * @param {(stars:number, heat:number)=>void} [onChange] dipanggil saat bintang berubah
 */
export function createWanted(initialHeat = 0, onChange) {
  let heat = clampHeat(initialHeat);
  let stars = starsForHeat(heat);
  const notify = typeof onChange === 'function' ? onChange : null;

  function emitIfChanged() {
    const next = starsForHeat(heat);
    if (next !== stars) {
      stars = next;
      if (notify) notify(stars, heat);
    }
  }

  return {
    /** Panas saat ini (0–100). */
    get heat() {
      return heat;
    },
    /** Bintang saat ini (0–5). */
    get stars() {
      return stars;
    },
    /** Label HUD: "BERSIH" atau ★★★★☆. */
    get label() {
      return wantedLabel(stars);
    },
    /** Apakah Bara sedang diburu (bintang >= 1). */
    get isWanted() {
      return stars >= 1;
    },
    /** Apakah buronan berat (bintang >= 3, polisi mengejar agresif). */
    get isHot() {
      return stars >= 3;
    },
    /** Tambah panas (mis. mencuri mobil). */
    addHeat(amount) {
      heat = clampHeat(heat + (Number(amount) || 0));
      emitIfChanged();
      return heat;
    },
    /** Setel panas langsung (dipakai staging + save). */
    setHeat(value) {
      heat = clampHeat(value);
      emitIfChanged();
      return heat;
    },
    /** Dinginkan panas selama `dt` detik. */
    decay(dt) {
      if (heat <= 0) return heat;
      heat = clampHeat(heat - HEAT_DECAY_PER_SECOND * Math.max(0, dt || 0));
      emitIfChanged();
      return heat;
    },
    /** Bersihkan semua panas (mis. setelah lolos dari kejaran). */
    clear() {
      heat = 0;
      emitIfChanged();
      return heat;
    },
    /** Cuplikan untuk save game. */
    snapshot() {
      return { heat };
    },
    /** Pulihkan dari save game. */
    restore(data) {
      if (data && typeof data.heat === 'number') this.setHeat(data.heat);
      return heat;
    },
  };
}
