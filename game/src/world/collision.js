// collision.js — Collider kotak (AABB) gedung + penyelesaian tabrakan lingkaran.
// Semua gameplay jalan di SATU bidang datar (y = 0): collider hanya
// memakai sumbu x/z. Skill author-game-levels: collision TIDAK diturunkan
// dari dekorasi — collider didaftarkan eksplisit saat gedung dibangun.

// Satu collider gedung/pagar: kotak sumbu-sejajar di bidang x/z.
export function makeCollider(id, minX, maxX, minZ, maxZ) {
  return { id, minX, maxX, minZ, maxZ };
}

// Apakah titik (x, z) berada di dalam kotak (dengan margin opsional).
export function pointInBox(x, z, box, margin = 0) {
  return (
    x >= box.minX - margin &&
    x <= box.maxX + margin &&
    z >= box.minZ - margin &&
    z <= box.maxZ + margin
  );
}

// Apakah titik bisa dilalui pejalan kaki / pemain: di dalam dunia dan
// tidak menabrak collider gedung mana pun.
export function isWalkable(x, z, colliders, half = 110) {
  if (Math.abs(x) > half - 1 || Math.abs(z) > half - 1) return false;
  for (const c of colliders) {
    if (pointInBox(x, z, c, 0.4)) return false;
  }
  return true;
}

// Apakah lingkaran (x, z, radius) menyentuh collider mana pun.
// Versi baca-saja dari resolveCircle — dipakai AI pejalan kaki untuk
// menghindar SEBELUM menabrak, bukan sesudah.
export function circleHits(x, z, radius, colliders) {
  for (const c of colliders) {
    const cx = Math.max(c.minX, Math.min(x, c.maxX));
    const cz = Math.max(c.minZ, Math.min(z, c.maxZ));
    const dx = x - cx;
    const dz = z - cz;
    if (dx * dx + dz * dz < radius * radius) return c;
  }
  return null;
}

// Selesaikan tabrakan lingkaran (pemain/mobil, radius r) terhadap semua
// collider + batas dunia. Menggeser `pos` keluar dari kotak lewat sisi
// terdekat, lalu menjepit ke batas dunia. Mengembalikan pos yang sama
// (dimutasi) supaya Gameplay bisa memanggilnya tiap frame tanpa alokasi.
export function resolveCircle(pos, radius, colliders, half = 110) {
  const m = half - radius - 0.5;
  if (pos.x < -m) pos.x = -m;
  if (pos.x > m) pos.x = m;
  if (pos.z < -m) pos.z = -m;
  if (pos.z > m) pos.z = m;
  for (const c of colliders) {
    // Lingkaran vs kotak: titik kotak terdekat dengan pusat lingkaran.
    const cx = Math.max(c.minX, Math.min(pos.x, c.maxX));
    const cz = Math.max(c.minZ, Math.min(pos.z, c.maxZ));
    const dx = pos.x - cx;
    const dz = pos.z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 >= radius * radius) continue;
    if (d2 > 1e-8) {
      // Dorong keluar sepanjang arah dari titik terdekat.
      const d = Math.sqrt(d2);
      const push = (radius - d) / d;
      pos.x += dx * push;
      pos.z += dz * push;
    } else {
      // Pusat lingkaran tepat di dalam kotak: dorong lewat sisi terdekat.
      const left = pos.x - c.minX + radius;
      const right = c.maxX - pos.x + radius;
      const top = pos.z - c.minZ + radius;
      const bottom = c.maxZ - pos.z + radius;
      const min = Math.min(left, right, top, bottom);
      if (min === left) pos.x = c.minX - radius;
      else if (min === right) pos.x = c.maxX + radius;
      else if (min === top) pos.z = c.minZ - radius;
      else pos.z = c.maxZ + radius;
    }
  }
  return pos;
}

// Apakah segmen jalan lurus dari a ke b terhalang collider (untuk AI).
// Dipakai traffic/polisi saat memilih belokan — dicek murah per segmen.
export function segmentBlocked(ax, az, bx, bz, colliders) {
  const steps = 8;
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const x = ax + (bx - ax) * t;
    const z = az + (bz - az) * t;
    for (const c of colliders) {
      if (pointInBox(x, z, c, 0.2)) return true;
    }
  }
  return false;
}

// Daftar collider gedung dari daftar bangunan {x, z, w, d, id}.
// Dipanggil city.js sekali saat membangun kota.
export function collidersFromBuildings(buildings) {
  return buildings.map((b) =>
    makeCollider(b.id, b.x - b.w / 2, b.x + b.w / 2, b.z - b.d / 2, b.z + b.d / 2),
  );
}
