// world-adapter.js — Jembatan gameplay ke dunia.
// Gameplay TIDAK mengimpor modul dunia: semua yang dibutuhkan datang
// lewat satu objek `world` dari ctx. Adapter ini membungkus objek itu
// dengan pertanyaan-pertanyaan yang dibutuhkan gameplay: distrik apa
// di titik ini, di mana Kancil curian, mobil terkunci terdekat apa,
// dan apakah titik ini menabrak gedung/pagar.

export const DISTRICTS = {
  plaza: 'Alun-Alun Arunika',
  niaga: 'Distrik Niaga',
  dermaga: 'Dermaga Arunika',
  lentera: 'Kampung Lentera',
  terapung: 'Pasar Terapung',
};

// Petakan koordinat ke nama distrik. Dermaga di ujung selatan (z besar),
// Niaga di timur, Lentera di barat, Terapung di utara, plaza di tengah.
export function districtAt(x, z) {
  if (z >= 60) return DISTRICTS.dermaga;
  if (x >= 40 && z >= -20) return DISTRICTS.niaga;
  if (x <= -40) return DISTRICTS.lentera;
  if (z <= -40) return DISTRICTS.terapung;
  return DISTRICTS.plaza;
}

export function createAdapter(world) {
  const w = world || {};
  const vehicles = Array.isArray(w.vehicles) ? w.vehicles : [];
  const colliders = Array.isArray(w.colliders) ? w.colliders : [];

  function dist(ax, az, bx, bz) {
    return Math.hypot(ax - bx, az - bz);
  }

  const api = {
    world: w,
    get vehicles() { return vehicles; },
    get colliders() { return colliders; },

    districtAt,

    // Mobil Kancil curian M2 — target misi kedua.
    kancil() {
      return vehicles.find((v) => v && v.type === 'kancil') || null;
    },

    // Mobil terkunci terdekat dalam jangkauan (untuk mencuri).
    nearestLockedVehicle(x, z, maxDist = 3.2) {
      let best = null;
      let bestDist = maxDist;
      for (const v of vehicles) {
        if (!v || !v.locked || v.driven) continue;
        const d = dist(x, z, v.x, v.z);
        if (d < bestDist) {
          bestDist = d;
          best = v;
        }
      }
      return best;
    },

    // Kendaraan apa pun yang terdekat (untuk interaksi umum).
    nearestVehicle(x, z, maxDist = 4) {
      let best = null;
      let bestDist = maxDist;
      for (const v of vehicles) {
        if (!v) continue;
        const d = dist(x, z, v.x, v.z);
        if (d < bestDist) {
          bestDist = d;
          best = v;
        }
      }
      return best;
    },

    // Apakah titik (x, z) menabrak collider? Lingkaran {x,z,r} atau
    // kotak {x,z,w,d} (w/d = lebar penuh, berpusat di x,z).
    hitsCollider(x, z, radius = 0.6) {
      for (const c of colliders) {
        if (!c) continue;
        if (typeof c.r === 'number') {
          if (dist(x, z, c.x, c.z) < c.r + radius) return true;
        } else if (typeof c.w === 'number' && typeof c.d === 'number') {
          const dx = Math.abs(x - c.x);
          const dz = Math.abs(z - c.z);
          if (dx < c.w / 2 + radius && dz < c.d / 2 + radius) return true;
        }
      }
      return false;
    },

    // Titik spawn pemain dari dunia, atau tengah plaza bila tak ada.
    spawnPlayer() {
      const sp = w.spawnPoints && w.spawnPoints.player;
      if (sp && typeof sp.x === 'number') {
        return { x: sp.x, z: sp.z ?? 0, yaw: sp.yaw ?? 0 };
      }
      return { x: 0, z: 0, yaw: 0 };
    },

    // Titik spawn Kancil dari dunia, atau posisi mobilnya.
    spawnKancil() {
      const sp = w.spawnPoints && w.spawnPoints.kancil;
      if (sp && typeof sp.x === 'number') return { x: sp.x, z: sp.z ?? 0 };
      const k = api.kancil();
      return k ? { x: k.x, z: k.z } : { x: -88, z: 44 };
    },

    // Daftar kendaraan parkir yang terkunci (target pencurian).
    lockedVehicles() {
      return vehicles.filter((v) => v && v.locked && !v.driven);
    },

    // Apakah ada kendaraan dalam radius kecil dari titik ini?
    vehicleNear(x, z, radius = 2) {
      return api.nearestVehicle(x, z, radius) !== null;
    },
  };

  return api;
}

// Adapter sekali pakai untuk dunia kosong (tes atau menu awal).
export function emptyAdapter() {
  return createAdapter({ vehicles: [], colliders: [], spawnPoints: {} });
}
