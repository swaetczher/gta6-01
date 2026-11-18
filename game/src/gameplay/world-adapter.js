// world-adapter.js — Jembatan gameplay <-> dunia ARUNIKA BAY.
//
// Gameplay TIDAK BOLEH import modul `../world/` (kontrak) kecuali
// `../world/config.js`. Modul ini menerima objek `world` yang sudah jadi
// dari `buildWorld(THREE, scene)` lewat `ctx`, lalu mengekspos isinya dalam
// bentuk yang nyaman dipakai gameplay: kendaraan, collider, titik spawn,
// dan nama distrik dari koordinat.
//
// Semua akses dijaga: dunia yang kehilangan satu bidang (mis. di tes, saat
// `world` hanya berisi sebagian) tetap menghasilkan adapter yang jalan
// dengan nilai default kosong — bukan error.

/** Nama distrik kota (dipakai HUD + syarat misi). */
export const DISTRICTS = {
  PLAZA: 'Alun-Alun Arunika',
  MARKET: 'Distrik Niaga',
  DOCK: 'Dermaga Arunika',
  VILLAGE: 'Kampung Lentera',
  FLOATING: 'Pasar Terapung',
};

/** Posisi Kancil M2 curian (dari kontrak staging). */
export const KANCIL_SPOT = { x: -88, z: 44 };

/** Posisi gudang kontainer Dermaga (staging heist). */
export const WAREHOUSE_SPOT = { x: -66, z: 94 };

/** Posisi markas Ombak Hitam (M5). */
export const HIDEOUT_SPOT = { x: 70, z: -70 };

/**
 * Nama distrik dari koordinat (x, z). Aturan kuadran kota:
 * tengah = Alun-Alun; barat daya + selatan = Dermaga; barat laut =
 * Kampung Lentera; timur jauh = Kampung Lentera; selatan jauh = Pasar
 * Terapung; sisanya = Distrik Niaga.
 */
export function districtAt(x, z) {
  const px = Number(x) || 0;
  const pz = Number(z) || 0;
  if (Math.abs(px) <= 25 && Math.abs(pz) <= 25) return DISTRICTS.PLAZA;
  if (px < -40 && pz > 40) return DISTRICTS.DOCK;
  if (px < -40 && pz < -40) return DISTRICTS.VILLAGE;
  if (px > 40 && pz > 40) return DISTRICTS.FLOATING;
  if (px > 40) return DISTRICTS.VILLAGE;
  if (pz > 60) return DISTRICTS.FLOATING;
  return DISTRICTS.MARKET;
}

/** Jarak datar (XZ) antara dua titik. */
function flatDistance(ax, az, bx, bz) {
  const dx = ax - bx;
  const dz = az - bz;
  return Math.sqrt(dx * dx + dz * dz);
}

/**
 * Adaptasi objek dunia untuk gameplay.
 *
 * @param {object} world hasil `buildWorld(THREE, scene)` — boleh sebagian
 *   (bidang yang hilang diganti default kosong)
 */
export function createWorldAdapter(world) {
  const w = world || {};
  const vehicles = Array.isArray(w.vehicles) ? w.vehicles : [];
  const pedestrians = Array.isArray(w.pedestrians) ? w.pedestrians : [];
  const traffic = Array.isArray(w.traffic) ? w.traffic : [];
  const colliders = Array.isArray(w.colliders) ? w.colliders : [];
  const spawnPoints = w.spawnPoints || {};
  const config = w.config || {};

  const api = {
    /** Objek dunia mentah (untuk main.js bila perlu). */
    world: w,
    /** Kendaraan parkir + lalu lintas: `{mesh, x, z, heading, speed, type, locked, label, driven}`. */
    vehicles,
    /** Pejalan kaki: `{mesh, x, z, heading, speed}`. */
    pedestrians,
    /** Mobil lalu lintas: `{mesh, x, z, heading, speed}`. */
    traffic,
    /** Collider: `{x, z, r}` atau `{x, z, w, d}`. */
    colliders,
    /** Titik spawn: `{player: {x, z, yaw}, kancil: {x, z}}`. */
    spawnPoints,
    /** Konstanta dunia (dari config.js, bila ada). */
    config,

    /** Titik spawn pemain (default 0,0 bila dunia tak menyediakannya). */
    playerSpawn() {
      const p = spawnPoints.player || {};
      return { x: Number(p.x) || 0, z: Number(p.z) || 0, yaw: Number(p.yaw) || 0 };
    },

    /** Kancil M2 curian — dicari dari daftar kendaraan, jatuh ke KANCIL_SPOT. */
    kancil() {
      const found = vehicles.find((v) => v && v.type === 'kancil');
      if (found) return found;
      return { x: KANCIL_SPOT.x, z: KANCIL_SPOT.z, type: 'kancil', locked: true };
    },

    /** Kendaraan terdekat dari (x, z) dalam radius `range`. */
    findVehicleNear(x, z, range) {
      let best = null;
      let bestDist = Infinity;
      for (const vehicle of vehicles) {
        if (!vehicle) continue;
        const d = flatDistance(x, z, vehicle.x || 0, vehicle.z || 0);
        if (d < range && d < bestDist) {
          bestDist = d;
          best = vehicle;
        }
      }
      return best ? { vehicle: best, distance: bestDist } : null;
    },

    /** Mobil terkunci terdekat (target curian) dalam radius `range`. */
    nearestLockedVehicle(x, z, range) {
      let best = null;
      let bestDist = Infinity;
      for (const vehicle of vehicles) {
        if (!vehicle || !vehicle.locked) continue;
        const d = flatDistance(x, z, vehicle.x || 0, vehicle.z || 0);
        if (d < range && d < bestDist) {
          bestDist = d;
          best = vehicle;
        }
      }
      return best ? { vehicle: best, distance: bestDist } : null;
    },

    /** Jumlah mobil parkir yang terkunci. */
    lockedCount() {
      let n = 0;
      for (const vehicle of vehicles) if (vehicle && vehicle.locked) n++;
      return n;
    },

    /** Apakah titik (x, z) menabrak collider (dengan radius `r`). */
    hitsCollider(x, z, r = 0) {
      for (const c of colliders) {
        if (!c) continue;
        if (typeof c.r === 'number') {
          if (flatDistance(x, z, c.x, c.z) < c.r + r) return true;
        } else if (typeof c.w === 'number' && typeof c.d === 'number') {
          if (Math.abs(x - c.x) < c.w / 2 + r && Math.abs(z - c.z) < c.d / 2 + r) {
            return true;
          }
        }
      }
      return false;
    },

    /** Nama distrik di koordinat (x, z). */
    districtAt,
  };
  return api;
}
