// pedestrians.js — Pejalan kaki ARUNIKA BAY.
// Puluhan orang berjalan di trotoar (sisi jalan, BUKAN tengah jalan),
// mengikuti trotoar lurus lalu belok di persimpangan, dan MENGHINDAR
// dari pemain: bila pemain mendekat < 2,5 m, mereka menyingkir ke sisi.
// Model prosedural sederhana (badan + kepala + topi/lampion kecil) —
// tanpa aset eksternal. Satu bidang datar, tanpa tangga.

import { ROAD_AXES, ROAD_WIDTH, SIDEWALK_WIDTH, PEDESTRIAN_COUNT, WORLD_HALF } from './config.js';
import { isWalkable } from './collision.js';

// Palet pakaian warga (warna cerah fajar — terbaca di screenshot).
const SHIRT_COLORS = [0xd94f3d, 0x2f6fb2, 0x2fa36b, 0xf2c230, 0x8a5fb2, 0xe67e22, 0x3f8fa3, 0xc2a878];
const SKIN_COLORS = [0xc98a5a, 0x8a5a3a, 0xe0b08a, 0x6a4630];

function material(THREE, color, opts = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.9, ...opts });
}

// Satu pejalan kaki: badan kotak, kepala bulat, kaki dua kotak kecil
// (kaki dianimasikan ayun jalan). Tinggi total ~1,7 m.
export function buildPedestrianMesh(THREE, rng) {
  const group = new THREE.Group();
  const shirt = material(THREE, SHIRT_COLORS[Math.floor(rng() * SHIRT_COLORS.length)]);
  const skin = material(THREE, SKIN_COLORS[Math.floor(rng() * SKIN_COLORS.length)]);
  const pants = material(THREE, 0x2a2e33);
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.75, 0.3), shirt);
  body.position.y = 1.05;
  body.castShadow = true;
  group.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), skin);
  head.position.y = 1.62;
  head.castShadow = true;
  group.add(head);
  // Sebagian warga memakai topi caping / lampion kecil di tangan.
  if (rng() < 0.4) {
    const hat = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.22, 12), material(THREE, 0xd9b36a));
    hat.position.y = 1.82;
    group.add(hat);
  }
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.7, 0.18), pants);
  legL.position.set(-0.13, 0.35, 0);
  group.add(legL);
  const legR = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.7, 0.18), pants);
  legR.position.set(0.13, 0.35, 0);
  group.add(legR);
  group.userData.legs = { legL, legR };
  return group;
}

// Trotoar berjalan: di samping jalan (offset jalan + trotoar + 0,5 m).
// Pilih satu jalan + posisi sepanjangnya + arah.
function pickSidewalkSpot(rng) {
  const axis = ROAD_AXES[Math.floor(rng() * ROAD_AXES.length)];
  const along = -100 + rng() * 200;
  const side = rng() < 0.5 ? -1 : 1;
  const off = ROAD_WIDTH / 2 + SIDEWALK_WIDTH / 2 + 0.4;
  if (rng() < 0.5) {
    return { x: axis + side * off, z: along, dirX: 0, dirZ: side > 0 ? 1 : -1, vertical: true };
  }
  return { x: along, z: axis + side * off, dirX: side > 0 ? 1 : -1, dirZ: 0, vertical: false };
}

export function spawnPedestrians(THREE, scene, count = PEDESTRIAN_COUNT, seed = 4242) {
  let s = seed >>> 0;
  const rng = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
  const peds = [];
  for (let i = 0; i < count; i++) {
    const mesh = buildPedestrianMesh(THREE, rng);
    const spot = pickSidewalkSpot(rng);
    mesh.position.set(spot.x, 0, spot.z);
    mesh.rotation.y = Math.atan2(spot.dirX, spot.dirZ);
    scene.add(mesh);
    peds.push({
      mesh,
      x: spot.x,
      z: spot.z,
      dirX: spot.dirX,
      dirZ: spot.dirZ,
      speed: 0.9 + rng() * 0.9,
      walkPhase: rng() * Math.PI * 2,
      avoiding: false,
    });
  }
  return peds;
}

// Pejalan kaki terdekat dengan titik (x, z) — dipakai Gameplay untuk
// interaksi / dialog warga terdekat.
export function nearestPedestrian(peds, x, z) {
  let best = null;
  let bestD = Infinity;
  for (const p of peds) {
    const d = Math.hypot(p.x - x, p.z - z);
    if (d < bestD) {
      bestD = d;
      best = p;
    }
  }
  return best ? { ped: best, distance: bestD } : null;
}

// Majukan pejalan kaki satu frame.
// `player` = { x, z } atau null. Bila pemain < 2,5 m, pejalan kaki
// menyingkir tegak lurus dari pemain selama 1,2 detik, lalu lanjut.
// Di ujung trotoar / persimpangan: belok 90 derajat ke trotoar sebelah
// (tetap di trotoar, tidak pernah masuk tengah jalan).
export function updatePedestrians(peds, dt, player, colliders) {
  for (const p of peds) {
    let mx = p.dirX * p.speed * dt;
    let mz = p.dirZ * p.speed * dt;
    if (player) {
      const dx = p.x - player.x;
      const dz = p.z - player.z;
      const d = Math.hypot(dx, dz);
      if (d < 2.5 && d > 0.01) {
        // Menyingkir: menjauh dari pemain, lebih cepat dari jalan biasa.
        const push = 2.2 * dt;
        mx = (dx / d) * push + mx * 0.3;
        mz = (dz / d) * push + mz * 0.3;
        p.avoiding = true;
      } else {
        p.avoiding = false;
      }
    }
    let nx = p.x + mx;
    let nz = p.z + mz;
    // Tetap di dalam dunia + tidak menabrak gedung: belok bila mentok.
    if (!isWalkable(nx, nz, colliders, WORLD_HALF) || Math.abs(nx) > 104 || Math.abs(nz) > 104) {
      // Belok 90 derajat (putar arah jalan).
      const ndx = -p.dirZ;
      const ndz = p.dirX;
      p.dirX = ndx;
      p.dirZ = ndz;
      nx = p.x + ndx * p.speed * dt;
      nz = p.z + ndz * p.speed * dt;
      if (!isWalkable(nx, nz, colliders, WORLD_HALF)) {
        // Masih mentok: putar balik.
        p.dirX = -p.dirX;
        p.dirZ = -p.dirZ;
        nx = p.x;
        nz = p.z;
      }
    }
    p.x = nx;
    p.z = nz;
    p.walkPhase += dt * p.speed * 5;
    p.mesh.position.set(p.x, 0, p.z);
    p.mesh.rotation.y = Math.atan2(p.dirX + (p.avoiding ? (p.x - (player?.x ?? p.x)) * 0.4 : 0), p.dirZ);
    // Ayun kaki saat berjalan.
    const legs = p.mesh.userData.legs;
    if (legs) {
      const swing = Math.sin(p.walkPhase) * 0.45;
      legs.legL.rotation.x = swing;
      legs.legR.rotation.x = -swing;
    }
  }
  return peds;
}
