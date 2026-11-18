// collision.js — Tabrakan 2D sederhana untuk kota ARUNIKA BAY.
// Collider: lingkaran {x, z, r} atau kotak sumbu {x, z, w, d}.
// Dipakai pemain (jalan kaki/mobil), polisi, dan preman supaya tidak
// menembus gedung, air mancur, kontainer, atau keluar batas kota.
// Murni matematika — tanpa THREE, bisa dites langsung dari Node.

import { WORLD_BOUNDS } from './config.js';

// Apakah titik (x, z) dengan jari-jari r menabrak satu collider?
export function hitsOne(x, z, r, c) {
  if (c.r !== undefined) {
    // Lingkaran vs lingkaran.
    const dx = x - c.x;
    const dz = z - c.z;
    const rr = r + c.r;
    return dx * dx + dz * dz < rr * rr;
  }
  // Lingkaran vs kotak sumbu (AABB): cari titik kotak terdekat.
  const hw = c.w / 2;
  const hd = c.d / 2;
  const cx = Math.max(c.x - hw, Math.min(x, c.x + hw));
  const cz = Math.max(c.z - hd, Math.min(z, c.z + hd));
  const dx = x - cx;
  const dz = z - cz;
  return dx * dx + dz * dz < r * r;
}

// Apakah titik (x, z) dengan jari-jari r menabrak collider mana pun?
export function hitsAny(colliders, x, z, r) {
  for (let i = 0; i < colliders.length; i++) {
    if (hitsOne(x, z, r, colliders[i])) return true;
  }
  return false;
}

// Geser titik keluar dari collider yang ditabrak (dorong radial untuk
// lingkaran, dorong sumbu terpendek untuk kotak). Mengembalikan posisi baru.
export function pushOut(colliders, x, z, r) {
  let px = x;
  let pz = z;
  for (let i = 0; i < colliders.length; i++) {
    const c = colliders[i];
    if (!hitsOne(px, pz, r, c)) continue;
    if (c.r !== undefined) {
      const dx = px - c.x;
      const dz = pz - c.z;
      const dist = Math.sqrt(dx * dx + dz * dz) || 0.001;
      const want = r + c.r;
      px = c.x + (dx / dist) * want;
      pz = c.z + (dz / dist) * want;
    } else {
      const hw = c.w / 2;
      const hd = c.d / 2;
      const dx = px - c.x;
      const dz = pz - c.z;
      const ox = hw + r - Math.abs(dx);
      const oz = hd + r - Math.abs(dz);
      if (ox < oz) {
        px = c.x + (dx >= 0 ? hw + r : -(hw + r));
      } else {
        pz = c.z + (dz >= 0 ? hd + r : -(hd + r));
      }
    }
  }
  return { x: px, z: pz };
}

// Jepit posisi ke dalam batas kota.
export function clampBounds(x, z) {
  return {
    x: Math.max(WORLD_BOUNDS.minX, Math.min(WORLD_BOUNDS.maxX, x)),
    z: Math.max(WORLD_BOUNDS.minZ, Math.min(WORLD_BOUNDS.maxZ, z)),
  };
}

// ---- Tambahan: pabrik collision dunia (revisi ke-2) ----

// Bungkus daftar collider jadi objek dunia yang dipakai gameplay:
// hits(x, z, r), resolve(x, z, r) = pushOut + clampBounds, dan
// tryMove(x, z, nx, nz, r) yang mencoba pindah lalu menolak bila menabrak.
export function createCollision(colliders) {
  const list = colliders.slice();
  return {
    colliders: list,
    hits(x, z, r) {
      return hitsAny(list, x, z, r);
    },
    resolve(x, z, r) {
      const pushed = pushOut(list, x, z, r);
      return clampBounds(pushed.x, pushed.z);
    },
    tryMove(x, z, nx, nz, r) {
      const clamped = clampBounds(nx, nz);
      if (hitsAny(list, clamped.x, clamped.z, r)) {
        // Coba geser hanya di satu sumbu supaya tidak macet total.
        // Hanya dihitung "bergerak" bila posisi benar-benar berubah.
        if (clamped.x !== x && !hitsAny(list, clamped.x, z, r)) return { x: clamped.x, z, moved: true };
        if (clamped.z !== z && !hitsAny(list, x, clamped.z, r)) return { x, z: clamped.z, moved: true };
        return { x, z, moved: false };
      }
      return { x: clamped.x, z: clamped.z, moved: true };
    },
    count() {
      return list.length;
    },
  };
}

// Jarak 2D (dipakai tes + logika kejar polisi/preman).
export function dist2D(ax, az, bx, bz) {
  const dx = ax - bx;
  const dz = az - bz;
  return Math.sqrt(dx * dx + dz * dz);
}
