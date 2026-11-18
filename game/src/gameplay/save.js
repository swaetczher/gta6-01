// save.js — Save/load ARUNIKA BAY via localStorage.
// Menyimpan posisi, health, uang, senjata + ammo, progres misi, wanted.
// Autosave dipanggil fasad tiap misi selesai. Aman bila storage diblokir
// (mode privat): simpan di memori sebagai cadangan.
export const SAVE_KEY = 'arunika-bay-save-v1';

let memoryFallback = null;

function storage() {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage;
  } catch {
    return null;
  }
}

export function serializeGame(state) {
  return {
    version: 1,
    savedAt: new Date().toISOString(),
    player: {
      x: state.player.x,
      z: state.player.z,
      heading: state.player.heading,
      health: state.player.health,
      money: state.player.money,
      weapon: state.combat.weapon,
      ammo: state.combat.ammo,
      ammoReserve: state.combat.ammoReserve,
    },
    missions: { completed: [...state.missions.completed] },
    wanted: { heat: state.wanted.heat },
  };
}

export function saveGame(state) {
  const data = serializeGame(state);
  const json = JSON.stringify(data);
  const store = storage();
  if (store) {
    try {
      store.setItem(SAVE_KEY, json);
    } catch {
      memoryFallback = json;
    }
  } else {
    memoryFallback = json;
  }
  return data;
}

export function loadGame() {
  const store = storage();
  let json = null;
  if (store) {
    try {
      json = store.getItem(SAVE_KEY);
    } catch {
      json = null;
    }
  }
  if (!json) json = memoryFallback;
  if (!json) return null;
  try {
    const data = JSON.parse(json);
    if (!data || data.version !== 1 || !data.player) return null;
    return data;
  } catch {
    return null;
  }
}

export function clearSave() {
  memoryFallback = null;
  const store = storage();
  if (store) {
    try {
      store.removeItem(SAVE_KEY);
    } catch {
      // abaikan: storage tidak tersedia
    }
  }
}

export function applySave(state, data) {
  if (!data) return false;
  state.player.x = data.player.x;
  state.player.z = data.player.z;
  state.player.heading = data.player.heading || 0;
  state.player.health = data.player.health;
  state.player.money = data.player.money;
  state.player.inCar = null;
  state.combat.weapon = data.player.weapon || 'fists';
  state.combat.ammo = data.player.ammo ?? 12;
  state.combat.ammoReserve = data.player.ammoReserve ?? 48;
  state.missions.completed = [...(data.missions.completed || [])];
  state.wanted.heat = data.wanted ? data.wanted.heat || 0 : 0;
  state.wanted.stars = 0;
  return true;
}

export function hasSave() {
  return loadGame() !== null;
}
// --- akhir save.js (baris revisi ditambahkan lewat edit terpisah) ---
// Revisi terekam: wanted sengaja di-reset ke 0 saat load (bintang
// dihitung ulang dari heat yang tersimpan) — pemain tidak langsung
// dikepung polisi begitu save dibuka kembali.
export function saveSummary(data) {
  if (!data) return 'Belum ada save.';
  return `Save ${data.savedAt}: misi selesai ${data.missions.completed.length}/5, uang $${data.player.money}.`;
}
