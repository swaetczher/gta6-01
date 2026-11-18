// screens.js — Lima layar permainan: start, playing, paused, busted,
// complete. Modul ini satu-satunya penjaga nama layar yang sah: nilai
// di luar daftar ditolak diam-diam supaya state.screen tidak pernah
// berisi string liar yang tidak dikenali main.js maupun HUD.

export const SCREENS = ['start', 'playing', 'paused', 'busted', 'complete'];

export function isScreen(value) {
  return SCREENS.includes(value);
}

export function createScreens(opts = {}) {
  const onChange = typeof opts.onChange === 'function' ? opts.onChange : null;
  let screen = 'start';
  let pausedFrom = 'playing';

  function setScreen(next, silent = false) {
    if (!isScreen(next)) return screen;
    if (next === 'paused' && screen !== 'paused') pausedFrom = screen;
    const before = screen;
    screen = next;
    if (before !== next && onChange && !silent) onChange(next, before);
    syncMenu();
    return screen;
  }

  // Tampilkan/sembunyikan layar menu sesuai layar aktif.
  function syncMenu() {
    if (typeof document === 'undefined') return;
    const menu = document.getElementById('menu-screen');
    if (!menu || !menu.style) return;
    menu.style.display = screen === 'playing' ? 'none' : '';
    const title = document.getElementById('menu-title');
    if (title) {
      if (screen === 'busted') title.textContent = 'TERTANGKAP';
      else if (screen === 'complete') title.textContent = 'FAJAR TERBIT';
      else if (screen === 'paused') title.textContent = 'JEDA';
      else title.textContent = 'ARUNIKA BAY';
    }
  }

  // Ikat tombol mulai di menu ke sebuah callback.
  function bindStart(callback) {
    if (typeof document === 'undefined') return false;
    const button = document.getElementById('start-button');
    if (!button || typeof button.addEventListener !== 'function') return false;
    button.addEventListener('click', () => {
      if (typeof callback === 'function') callback();
    });
    return true;
  }

  const api = {
    get screen() { return screen; },
    get pausedFrom() { return pausedFrom; },

    setScreen,
    bindStart,

    start() {
      return setScreen('playing');
    },

    pause() {
      if (screen === 'playing') return setScreen('paused');
      return screen;
    },

    resume() {
      if (screen === 'paused') return setScreen(pausedFrom === 'playing' ? 'playing' : pausedFrom);
      return screen;
    },

    togglePause() {
      if (screen === 'playing') return api.pause();
      if (screen === 'paused') return api.resume();
      return screen;
    },

    busted() {
      return setScreen('busted');
    },

    complete() {
      return setScreen('complete');
    },

    toMenu() {
      return setScreen('start');
    },

    isPlaying() { return screen === 'playing'; },
    isMenu() { return screen === 'start'; },

    // Pesan menu (subjudul di bawah judul layar menu).
    setMenuMessage(text) {
      if (typeof document === 'undefined') return false;
      const node = document.getElementById('menu-message');
      if (!node) return false;
      node.textContent = String(text || '');
      return true;
    },

    // Judul menu (misalnya nama layar akhir).
    setMenuTitle(text) {
      if (typeof document === 'undefined') return false;
      const node = document.getElementById('menu-title');
      if (!node) return false;
      node.textContent = String(text || '');
      return true;
    },
  };

  return api;
}
