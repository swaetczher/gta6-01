// save.js — Simpan progres ARUNIKA BAY.
//
// Slot simpan tunggal di `localStorage` dengan kunci `SAVE_KEY`. Bila
// `localStorage` tidak tersedia (mode privat, Node, atau diblokir), modul
// jatuh ke memori biasa — game tetap bisa simpan/muat dalam satu sesi,
// hanya tidak bertahan antar sesi. Kegagalan tulis tidak pernah melempar:
// `save()` mengembalikan false dan game lanjut jalan.

export const SAVE_KEY = 'arunika-bay-save-v1';

// Versi format save; naikkan bila struktur data berubah.
export const SAVE_VERSION = 1;

/** Apakah sebuah nilai bisa dipakai sebagai store (punya get/set/remove). */
function isUsableStore(store) {
  return (
    store &&
    typeof store.getItem === 'function' &&
    typeof store.setItem === 'function' &&
    typeof store.removeItem === 'function'
  );
}

/** Store memori pengganti localStorage (satu slot, hidup selama sesi). */
function createMemoryStore() {
  let slot = null;
  return {
    getItem() {
      return slot;
    },
    setItem(_key, value) {
      slot = String(value);
    },
    removeItem() {
      slot = null;
    },
  };
}

/**
 * Ambil store yang akan dipakai: `localStorage` bila ada dan bisa ditulis,
 * memori bila tidak. Tes Node memakai memori secara otomatis.
 */
export function resolveStore() {
  try {
    if (typeof localStorage !== 'undefined' && isUsableStore(localStorage)) {
      const probe = '__arunika_probe__';
      localStorage.setItem(probe, '1');
      localStorage.removeItem(probe);
      return localStorage;
    }
  } catch (_err) {
    // localStorage ada tapi diblokir — jatuh ke memori di bawah.
  }
  return createMemoryStore();
}

/**
 * Manajer save game.
 *
 * @param {object} [store] store kustom (dipakai tes); bila tidak diisi,
 *   `resolveStore()` memilih localStorage atau memori
 */
export function createSave(store) {
  const backend = isUsableStore(store) ? store : resolveStore();

  const api = {
    /** Kunci slot simpan. */
    key: SAVE_KEY,

    /** Apakah ada save yang tersimpan. */
    hasSave() {
      try {
        return backend.getItem(SAVE_KEY) !== null;
      } catch (_err) {
        return false;
      }
    },

    /**
     * Simpan data game. `data` harus bisa di-JSON-kan.
     * @returns {boolean} true bila tersimpan
     */
    save(data) {
      try {
        const payload = JSON.stringify({
          version: SAVE_VERSION,
          savedAt: Date.now(),
          data: data || {},
        });
        backend.setItem(SAVE_KEY, payload);
        return true;
      } catch (_err) {
        return false;
      }
    },

    /**
     * Muat data game.
     * @returns {object|null} `data` yang disimpan, atau null bila tidak ada/rusak
     */
    load() {
      try {
        const raw = backend.getItem(SAVE_KEY);
        if (raw === null || raw === undefined) return null;
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') return null;
        if (parsed.version !== SAVE_VERSION) return null;
        return parsed.data && typeof parsed.data === 'object' ? parsed.data : null;
      } catch (_err) {
        return null;
      }
    },

    /** Hapus slot simpan. */
    clear() {
      try {
        backend.removeItem(SAVE_KEY);
        return true;
      } catch (_err) {
        return false;
      }
    },

    /**
     * Rangkum satu save penuh dari potongan-potongan game: pemain, misi,
     * wanted, combat, dan uang. Dipakai autosave di gameplay/index.js.
     */
    collect(parts) {
      const p = parts || {};
      return {
        money: typeof p.money === 'number' ? p.money : 0,
        player: p.player || null,
        missions: p.missions || null,
        wanted: p.wanted || null,
        combat: p.combat || null,
      };
    },
  };
  return api;
}
