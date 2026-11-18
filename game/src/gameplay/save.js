// save.js — Simpan progres Bara Kelana.
// Kunci penyimpanan tetap 'arunika-bay-save-v1'. Data ditulis ke
// localStorage bila tersedia; bila tidak (misalnya saat tes Node atau
// mode privat yang memblokir), dipakai memori biasa sebagai cadangan
// supaya permainan tidak pernah crash karena save.

export const SAVE_KEY = 'arunika-bay-save-v1';
export const SAVE_VERSION = 1;

// Bentuk data simpanan. Semua angka punya nilai awal yang aman.
export function blankSave() {
  return {
    version: SAVE_VERSION,
    money: 50,
    health: 100,
    mission: 0,
    step: 0,
    missionsDone: [false, false, false, false, false],
    wantedHeat: 0,
    x: 0,
    z: 0,
    yaw: 0,
    savedAt: 0,
  };
}

function memoryStore() {
  let held = null;
  return {
    getItem: () => held,
    setItem: (_key, value) => { held = String(value); },
    removeItem: () => { held = null; },
  };
}

function pickStorage(explicit) {
  if (explicit && typeof explicit.getItem === 'function') return explicit;
  try {
    if (typeof localStorage !== 'undefined' && localStorage) {
      localStorage.setItem('__arunika_probe__', '1');
      localStorage.removeItem('__arunika_probe__');
      return localStorage;
    }
  } catch (_err) {
    // localStorage diblokir — jatuh ke memori di bawah.
  }
  return memoryStore();
}

export function createSave(opts = {}) {
  const storage = pickStorage(opts.storage || null);
  const key = opts.key || SAVE_KEY;

  const api = {
    key,
    get available() {
      return storage !== null;
    },

    // Simpan data (objek biasa). Kembalikan true bila tertulis.
    save(data) {
      try {
        const payload = { ...blankSave(), ...(data || {}), savedAt: Date.now() };
        storage.setItem(key, JSON.stringify(payload));
        return true;
      } catch (_err) {
        return false;
      }
    },

    // Muat data simpanan. Kembalikan null bila belum ada atau rusak.
    load() {
      try {
        const raw = storage.getItem(key);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') return null;
        if (parsed.version !== SAVE_VERSION) return null;
        return { ...blankSave(), ...parsed };
      } catch (_err) {
        return null;
      }
    },

    hasSave() {
      return api.load() !== null;
    },

    clear() {
      try {
        storage.removeItem(key);
        return true;
      } catch (_err) {
        return false;
      }
    },
  };

  return api;
}

// Jalan pintas sekali pakai: simpan snapshot gameplay apa adanya.
export function saveSnapshot(data, opts = {}) {
  return createSave(opts).save(data);
}

export function loadSnapshot(opts = {}) {
  return createSave(opts).load();
}
