// wanted.js — Panas buronan Arunika Bay: heat 0-100 menjadi 0-5 bintang.
// Bintang naik saat Bara bikin onar, turun pelan saat ia menghilang dari
// pandangan polisi. Modul ini murni logika angka: tanpa DOM, tanpa scene,
// supaya bisa diuji langsung dari Node.

// Ambang panas untuk tiap tingkat bintang. Batas bawah tiap tingkat:
// bintang 1 mulai 1, bintang 2 mulai 20, bintang 3 mulai 40, dan begitu
// seterusnya sampai bintang 5 di 80. Heat 0 berarti kota bersih.
export const HEAT_STEPS = [1, 20, 40, 60, 80];
export const MAX_HEAT = 100;
export const MAX_STARS = 5;

// Ubah satu angka heat menjadi jumlah bintang (0-5).
export function starsForHeat(heat) {
  const h = Math.max(0, Math.min(MAX_HEAT, Number(heat) || 0));
  let stars = 0;
  for (const step of HEAT_STEPS) {
    if (h >= step) stars += 1;
  }
  return Math.min(MAX_STARS, stars);
}

// Gambar bintang untuk HUD: bintang penuh dan bintang kosong.
export function starsText(stars) {
  const full = Math.max(0, Math.min(MAX_STARS, Math.round(stars)));
  return '★'.repeat(full) + '☆'.repeat(MAX_STARS - full);
}

// Buat pelacak buronan. onChange dipanggil tiap kali jumlah bintang
// berubah, supaya main.js bisa menaikkan agresivitas polisi.
export function createWanted(opts = {}) {
  const onChange = typeof opts.onChange === 'function' ? opts.onChange : null;
  const decayPerSecond = opts.decayPerSecond ?? 1.1;
  const calmDelay = opts.calmDelay ?? 6;
  let heat = Math.max(0, Math.min(MAX_HEAT, opts.startHeat ?? 0));
  let stars = starsForHeat(heat);
  let quietFor = 0;

  function emitIfChanged(before) {
    const now = starsForHeat(heat);
    if (now !== before) {
      stars = now;
      if (onChange) onChange({ heat, stars: now });
    }
  }

  const api = {
    get heat() { return heat; },
    get stars() { return stars; },
    get quietFor() { return quietFor; },

    setHeat(value) {
      const before = stars;
      heat = Math.max(0, Math.min(MAX_HEAT, Number(value) || 0));
      quietFor = 0;
      emitIfChanged(before);
      return heat;
    },

    addHeat(amount) {
      const before = stars;
      heat = Math.max(0, Math.min(MAX_HEAT, heat + (Number(amount) || 0)));
      quietFor = 0;
      emitIfChanged(before);
      return heat;
    },

    // Turunkan panas pelan-pelan. Hanya bekerja setelah Bara diam tanpa
    // onar selama calmDelay detik — polisi tidak lupa secepat itu.
    coolDown(amount) {
      const before = stars;
      heat = Math.max(0, heat - (Number(amount) || 0));
      emitIfChanged(before);
      return heat;
    },

    // Maju satu frame: hitung waktu tenang, lalu dinginkan panasnya.
    update(dt, trouble = false) {
      if (trouble) {
        quietFor = 0;
        return heat;
      }
      quietFor += Math.max(0, dt);
      if (quietFor >= calmDelay && heat > 0) {
        api.coolDown(decayPerSecond * dt);
      }
      return heat;
    },

    // Penanda waktu: apakah kota sedang tenang (tanpa bintang)?
    get calm() { return stars === 0; },

    snapshot() {
      return { heat, stars, quietFor };
    },

    restore(data) {
      if (!data || typeof data !== 'object') return heat;
      const before = stars;
      heat = Math.max(0, Math.min(MAX_HEAT, Number(data.heat) || 0));
      quietFor = Number(data.quietFor) || 0;
      emitIfChanged(before);
      return heat;
    },

    reset() {
      return api.setHeat(0);
    },
  };

  return api;
}
