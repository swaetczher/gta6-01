// screens.js — Layar menu ARUNIKA BAY.
//
// Lima layar, satu aktif dalam satu waktu:
//   start    — menu judul ("ARUNIKA BAY") + tombol #start-button.
//   playing  — game berjalan, HUD tampil.
//   paused   — jeda (Esc/P), menu jeda tampil.
//   busted   — Bara tertangkap / nyawa habis.
//   complete — semua misi selesai, spanduk fajar terbit.
//
// Modul ini mengatur `display` elemen #menu-screen dan turunannya lewat
// atribut `data-screen`, plus mengikat tombol mulai. Semua akses DOM
// dijaga (elemen tak ada = dilewati), supaya tetap jalan di tes Node.

export const SCREENS = ['start', 'playing', 'paused', 'busted', 'complete'];

export const SCREEN_START = 'start';
export const SCREEN_PLAYING = 'playing';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_BUSTED = 'busted';
export const SCREEN_COMPLETE = 'complete';

/** Apakah `name` salah satu layar yang sah. */
export function isScreen(name) {
  return SCREENS.includes(name);
}

/** Judul yang tampil di menu untuk tiap layar akhir. */
export const SCREEN_TITLES = {
  [SCREEN_START]: 'ARUNIKA BAY',
  [SCREEN_PLAYING]: '',
  [SCREEN_PAUSED]: 'JEDA',
  [SCREEN_BUSTED]: 'TERTANGKAP!',
  [SCREEN_COMPLETE]: 'FAJAR TERBIT — ARUNIKA BAY',
};

/** Pesan layar akhir. */
export const SCREEN_MESSAGES = {
  [SCREEN_BUSTED]:
    'Bara Kelana tertangkap polisi Ombak Hitam. Arunika Bay masih menunggu fajarnya.',
  [SCREEN_COMPLETE]: 'Semua misi selesai — Arunika Bay bebas!',
};

/**
 * Manajer layar.
 *
 * @param {object} [opts]
 * @param {object} [opts.doc] dokumen DOM (default: `document` global bila ada)
 * @param {()=>void} [opts.onStart] dipanggil saat tombol mulai ditekan
 * @param {()=>void} [opts.onResume] dipanggil saat lanjut dari jeda
 * @param {()=>void} [opts.onRestart] dipanggil saat main lagi dari layar akhir
 */
export function createScreens(opts = {}) {
  const doc = opts.doc || (typeof document !== 'undefined' ? document : null);
  const onStart = typeof opts.onStart === 'function' ? opts.onStart : null;
  const onResume = typeof opts.onResume === 'function' ? opts.onResume : null;
  const onRestart = typeof opts.onRestart === 'function' ? opts.onRestart : null;

  let screen = SCREEN_START;
  let bound = false;

  function get(id) {
    try {
      if (!doc || typeof doc.getElementById !== 'function') return null;
      return doc.getElementById(id);
    } catch (_err) {
      return null;
    }
  }

  function applyVisibility() {
    const menu = get('menu-screen');
    if (menu) {
      try {
        menu.style.display = screen === SCREEN_PLAYING ? 'none' : '';
        menu.setAttribute('data-screen', screen);
      } catch (_err) {
        // Elemen palsu di tes — abaikan.
      }
    }
    const title = get('menu-title');
    if (title) {
      try {
        title.textContent = SCREEN_TITLES[screen] || '';
      } catch (_err) {
        // Abaikan.
      }
    }
    const message = get('menu-message');
    if (message) {
      try {
        message.textContent = SCREEN_MESSAGES[screen] || '';
      } catch (_err) {
        // Abaikan.
      }
    }
  }

  const api = {
    /** Layar aktif saat ini. */
    get screen() {
      return screen;
    },
    /** Apakah game sedang dimainkan (bukan menu/jeda/akhir). */
    get isPlaying() {
      return screen === SCREEN_PLAYING;
    },

    /** Pindah ke layar lain (nama tak sah diabaikan). */
    setScreen(name) {
      if (!isScreen(name)) return screen;
      if (name === screen) return screen;
      screen = name;
      applyVisibility();
      return screen;
    },

    /** Mulai bermain dari menu awal. */
    start() {
      if (onStart) onStart();
      return this.setScreen(SCREEN_PLAYING);
    },

    /** Lanjut bermain dari jeda. */
    resume() {
      if (onResume) onResume();
      return this.setScreen(SCREEN_PLAYING);
    },

    /** Main lagi dari layar busted/complete. */
    restart() {
      if (onRestart) onRestart();
      return this.setScreen(SCREEN_PLAYING);
    },

    /** Jeda bila sedang bermain; lanjut bila sedang jeda. */
    togglePause() {
      if (screen === SCREEN_PLAYING) return this.setScreen(SCREEN_PAUSED);
      if (screen === SCREEN_PAUSED) return this.resume();
      return screen;
    },

    /**
     * Ikat tombol #start-button (klik -> mulai). Aman dipanggil berulang:
     * pengikatan kedua diabaikan.
     */
    bind() {
      if (bound) return false;
      const button = get('start-button');
      if (!button || typeof button.addEventListener !== 'function') return false;
      button.addEventListener('click', () => {
        this.start();
      });
      bound = true;
      return true;
    },
  };
  applyVisibility();
  return api;
}
