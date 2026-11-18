// ARUNIKA BAY — tabrakan lingkaran vs kotak/lingkaran (tulis ulang round 2).
// Collider dunia ada dua bentuk saja: {x, z, r} lingkaran dan {x, z, w, d}
// kotak poros sumbu. Modul ini murni logika — tanpa THREE, gampang dites.

// Apakah satu titik (dengan radius) menabrak satu collider?
export function hitsCollider(x, z, r, c) {
  if (c.r !== undefined) {
    const dx = x - c.x;
    const dz = z - c.z;
    const rr = r + c.r;
    return dx * dx + dz * dz < rr * rr;
  }
  const hx = c.w / 2 + r;
  const hz = c.d / 2 + r;
  return Math.abs(x - c.x) < hx && Math.abs(z - c.z) < hz;
}

// Apakah titik (x, z, r) menabrak collider mana pun dalam daftar?
export function isBlocked(x, z, r, colliders) {
  for (let i = 0; i < colliders.length; i++) {
    if (hitsCollider(x, z, r, colliders[i])) return true;
  }
  return false;
}

// Dorong titik keluar dari collider yang ditabrak (satu sumbu dominan
// untuk kotak, radial untuk lingkaran). Mengembalikan posisi baru.
export function pushOut(x, z, r, colliders) {
  let px = x;
  let pz = z;
  for (let i = 0; i < colliders.length; i++) {
    const c = colliders[i];
    if (!hitsCollider(px, pz, r, c)) continue;
    if (c.r !== undefined) {
      const dx = px - c.x;
      const dz = pz - c.z;
      const dist = Math.hypot(dx, dz) || 0.001;
      const want = r + c.r;
      px = c.x + (dx / dist) * want;
      pz = c.z + (dz / dist) * want;
    } else {
      const dx = px - c.x;
      const dz = pz - c.z;
      const ox = c.w / 2 + r - Math.abs(dx);
      const oz = c.d / 2 + r - Math.abs(dz);
      if (ox < oz) px = c.x + Math.sign(dx || 1) * (c.w / 2 + r);
      else pz = c.z + Math.sign(dz || 1) * (c.d / 2 + r);
    }
  }
  return { x: px, z: pz };
}

// Bungkus daftar collider jadi objek penabrak yang dipakai gameplay:
// - blocked(x, z, r): boolean
// - resolve(x, z, r): posisi aman terdekat
// - inside(x, z): apakah titik masih di dalam batas kota daratan
export function makeCollision(colliders, half = 130) {
  const list = colliders || [];
  return {
    colliders: list,
    half,
    blocked(x, z, r = 0.5) {
      return isBlocked(x, z, r, list);
    },
    resolve(x, z, r = 0.5) {
      const p = pushOut(x, z, r, list);
      return { x: p.x, z: p.z };
    },
    inside(x, z) {
      return x >= -half && x <= half && z >= -half && z <= half;
    },
    clamp(x, z, margin = 1) {
      const cx = Math.max(-half + margin, Math.min(half - margin, x));
      const cz = Math.max(-half + margin, Math.min(half - margin, z));
      return { x: cx, z: cz };
    },
  };
}

// Jarak terdekat dari titik ke sebuah collider (dipakai AI polisi/musuh).
export function distanceToCollider(x, z, c) {
  if (c.r !== undefined) {
    return Math.max(0, Math.hypot(x - c.x, z - c.z) - c.r);
  }
  const dx = Math.max(Math.abs(x - c.x) - c.w / 2, 0);
  const dz = Math.max(Math.abs(z - c.z) - c.d / 2, 0);
  return Math.hypot(dx, dz);
}
