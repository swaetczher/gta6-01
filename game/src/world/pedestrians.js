// pedestrians.js — Pejalan kaki ARUNIKA BAY: 28 warga yang berjalan di
// trotoar mengelilingi blok kota. Pejalan pertama adalah sosok khusus
// shot jalan kaki: topi kerucut + baju hijau (disebut "hero").

import { PEDESTRIAN_COUNT, PED_SPEED_MIN, PED_SPEED_MAX, CITY_SEED, mulberry32 } from './config.js';

// Warna baju warga.
const SHIRT_COLORS = [0x3f8a4a, 0xd8b83a, 0x8a4a7a, 0x4a7a8a, 0xc86a3a, 0x7a8a3a, 0x9a4a4a, 0x5a5a7a];

// Rakit satu pejalan: badan + kepala + (opsional) topi kerucut.
export function makePedestrianMesh(THREE, shirtColor, withConeHat) {
  const group = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.55, 1.0, 0.32),
    new THREE.MeshStandardMaterial({ color: shirtColor }),
  );
  body.position.y = 0.95;
  group.add(body);
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.26, 12, 10),
    new THREE.MeshStandardMaterial({ color: 0xd8a878 }),
  );
  head.position.y = 1.68;
  group.add(head);
  const legs = new THREE.Mesh(
    new THREE.BoxGeometry(0.42, 0.5, 0.28),
    new THREE.MeshStandardMaterial({ color: 0x2e2e34 }),
  );
  legs.position.y = 0.25;
  group.add(legs);
  if (withConeHat) {
    const hat = new THREE.Mesh(
      new THREE.ConeGeometry(0.42, 0.55, 12),
      new THREE.MeshStandardMaterial({ color: 0xc8a83a }),
    );
    hat.position.y = 2.05;
    group.add(hat);
  }
  return group;
}

// Rute jalan kaki: persegi kecil mengelilingi satu blok (trotoar).
function blockLoop(cx, cz, half) {
  return [
    { x: cx - half, z: cz - half },
    { x: cx + half, z: cz - half },
    { x: cx + half, z: cz + half },
    { x: cx - half, z: cz + half },
  ];
}

export function buildPedestrians(THREE, scene) {
  const rand = mulberry32(CITY_SEED + 31);
  const list = [];
  const blocks = [
    { x: -30, z: -90 },
    { x: 30, z: -90 },
    { x: 90, z: -90 },
    { x: -90, z: -30 },
    { x: 30, z: -30 },
    { x: 90, z: -30 },
    { x: -30, z: 30 },
    { x: 30, z: 30 },
    { x: 90, z: 30 },
    { x: -30, z: 90 },
    { x: 30, z: 90 },
    { x: 90, z: 90 },
  ];
  for (let i = 0; i < PEDESTRIAN_COUNT; i++) {
    const isHero = i === 0;
    const shirt = isHero ? 0x3f8a4a : SHIRT_COLORS[i % SHIRT_COLORS.length];
    const mesh = makePedestrianMesh(THREE, shirt, isHero);
    const block = blocks[i % blocks.length];
    const loop = blockLoop(block.x, block.z, 14 + rand() * 6);
    const startIdx = Math.floor(rand() * loop.length);
    const start = loop[startIdx];
    mesh.position.set(start.x, 0, start.z);
    scene.add(mesh);
    list.push({
      mesh,
      x: start.x,
      z: start.z,
      heading: rand() * Math.PI * 2,
      speed: PED_SPEED_MIN + rand() * (PED_SPEED_MAX - PED_SPEED_MIN),
      loop,
      // Target pertama = waypoint BERIKUTNYA, bukan posisi awal sendiri.
      wp: (startIdx + 1) % loop.length,
      hero: isHero,
    });
  }

  function update(dt) {
    for (const p of list) {
      const target = p.loop[p.wp];
      const dx = target.x - p.x;
      const dz = target.z - p.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < 0.4) {
        p.wp = (p.wp + 1) % p.loop.length;
        continue;
      }
      const step = p.speed * dt;
      p.x += (dx / dist) * step;
      p.z += (dz / dist) * step;
      p.heading = Math.atan2(-dz, dx);
      p.mesh.position.set(p.x, 0, p.z);
      p.mesh.rotation.y = p.heading - Math.PI / 2;
    }
  }

  return { list, update, hero: list[0] };
}

// ---- Tambahan: parkir pejalan hero untuk staging (revisi ke-2) ----

// Letakkan pejalan hero (topi kerucut, baju hijau) di titik shot jalan
// kaki dan hadapkan ke kamera. Rutenya dijeda dengan menaruh waypoint
// berikutnya tepat di posisinya (dipakai bersama freezeStreetLife).
export function placeHeroPedestrian(pedestrians, x, z, heading) {
  const hero = pedestrians.hero;
  hero.x = x;
  hero.z = z;
  hero.heading = heading;
  hero.loop = [{ x, z }];
  hero.wp = 0;
  hero.mesh.position.set(x, 0, z);
  hero.mesh.rotation.y = heading - Math.PI / 2;
  return hero;
}

// Hitung pejalan yang berada dalam radius r dari titik (x, z).
export function pedestriansNear(list, x, z, r) {
  return list.filter((p) => {
    const dx = p.x - x;
    const dz = p.z - z;
    return dx * dx + dz * dz < r * r;
  });
}
