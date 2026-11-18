// city.js — Geometri prosedural kota ARUNIKA BAY.
// Grid jalan 5x5 (jarak 44 m), 16 blok, gedung bervariasi sampai menara
// 55 m, trotoar, zebra, lampu jalan, pohon, halte, plaza + air mancur,
// taman, kanal Pasar Terapung + perahu, kontainer Dermaga, mercusuar.
// Semua geometri prosedural dari Box/Cylinder/Plane — tanpa aset eksternal.
// Satu bidang datar (y = 0): gedung HANYA dekorasi visual + collider;
// tidak ada tangga, jembatan, atau tanjakan yang mengubah navigasi.

import {
  ROAD_AXES,
  ROAD_SPACING,
  ROAD_WIDTH,
  SIDEWALK_WIDTH,
  WORLD_HALF,
  WORLD_SIZE,
  BLOCK_CENTERS,
  BLOCK_SIZE,
  TOWER_HEIGHT,
  PALETTE,
  LANDMARKS,
  MISSION_POINTS,
} from './config.js';
import { collidersFromBuildings } from './collision.js';

// RNG deterministik (mulberry32) supaya kota sama di tiap run / screenshot.
export function makeRng(seed = 20261118) {
  let a = seed >>> 0;
  return function rng() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Jenis blok untuk titik (bx, bz): 'plaza' | 'canal' | 'park' |
// 'lighthouse' | 'warehouse' | 'containers' | 'buildings'.
// Dipakai minimap + Gameplay untuk menandai area khusus tanpa menebak.
export function blockKind(bx, bz) {
  return SPECIAL_BLOCKS[`${bx},${bz}`] || 'buildings';
}

// Titik misi harus kosong: tidak ada gedung dalam radius ini.
const MISSION_CLEAR_RADIUS = 12;

function nearMissionPoint(x, z) {
  for (const key of Object.keys(MISSION_POINTS)) {
    const p = MISSION_POINTS[key];
    const dx = x - p.x;
    const dz = z - p.z;
    if (dx * dx + dz * dz < MISSION_CLEAR_RADIUS * MISSION_CLEAR_RADIUS) return true;
  }
  return false;
}

// Blok khusus (bukan blok gedung biasa): plaza, kanal, taman, mercusuar.
const SPECIAL_BLOCKS = {
  '-22,22': 'plaza',
  '22,22': 'canal',
  '66,66': 'park',
  '-66,-66': 'lighthouse',
  '-66,66': 'warehouse',
  '-66,22': 'containers',
};

function material(THREE, color, opts = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0.05, ...opts });
}

function box(THREE, w, h, d, mat) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

// Jendela menyala (fajar: lampu gedung masih menyala). Ditempel di fasad
// sebagai plane tipis — murah, tanpa texture eksternal.
function addWindows(THREE, group, w, h, d, rng) {
  const cols = Math.max(2, Math.floor(w / 3));
  const rows = Math.max(2, Math.floor(h / 3.2));
  const lit = material(THREE, PALETTE.windowLit, { emissive: PALETTE.windowLit, emissiveIntensity: 0.9 });
  const dark = material(THREE, PALETTE.windowDark, { roughness: 0.4, metalness: 0.3 });
  for (let face = 0; face < 4; face++) {
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        if (rng() < 0.45) continue; // tidak semua jendela ada
        const win = new THREE.Mesh(
          new THREE.PlaneGeometry(1.4, 1.6),
          rng() < 0.55 ? lit : dark,
        );
        const fx = -w / 2 + ((c + 0.5) / cols) * w;
        const fy = 1.8 + ((r + 0.5) / rows) * (h - 2.5);
        const off = d / 2 + 0.03;
        if (face === 0) { win.position.set(fx, fy, off); }
        if (face === 1) { win.position.set(fx, fy, -off); win.rotation.y = Math.PI; }
        if (face === 2) { win.position.set(off, fy, fx); win.rotation.y = Math.PI / 2; }
        if (face === 3) { win.position.set(-off, fy, fx); win.rotation.y = -Math.PI / 2; }
        group.add(win);
      }
    }
  }
}

// Bangun seluruh kota ke dalam `scene`. Mengembalikan:
// { buildings, colliders, lamps, trees, boats, trafficLightPoles, fountain }
export function buildCity(THREE, scene, seed = 20261118) {
  const rng = makeRng(seed);
  const group = new THREE.Group();
  group.name = 'ArunikaCity';
  scene.add(group);
  const buildings = [];
  const lamps = [];
  const trees = [];
  const boats = [];

  // --- Tanah dasar + laut pelabuhan (barat) + kanal ---
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD_SIZE + 120, WORLD_SIZE + 120),
    material(THREE, PALETTE.ground),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  group.add(ground);

  // Laut di barat Dermaga (x < -110): bidang teal yang berkilau redup.
  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(120, WORLD_SIZE + 120),
    material(THREE, PALETTE.sea, { roughness: 0.25, metalness: 0.4 }),
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(-WORLD_HALF - 60, 0.05, 0);
  sea.receiveShadow = true;
  group.add(sea);

  // --- Jalan: strip aspal + garis tengah putus-putus ---
  const roadMat = material(THREE, PALETTE.road, { roughness: 0.95 });
  const lineMat = material(THREE, PALETTE.roadLine, { roughness: 0.6 });
  for (const ax of ROAD_AXES) {
    const v = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_WIDTH, WORLD_SIZE), roadMat);
    v.rotation.x = -Math.PI / 2;
    v.position.set(ax, 0.06, 0);
    v.receiveShadow = true;
    group.add(v);
    const h = new THREE.Mesh(new THREE.PlaneGeometry(WORLD_SIZE, ROAD_WIDTH), roadMat);
    h.rotation.x = -Math.PI / 2;
    h.position.set(0, 0.06, ax);
    h.receiveShadow = true;
    group.add(h);
    // Garis tengah putus-putus tiap 4 m.
    for (let t = -WORLD_HALF + 4; t < WORLD_HALF - 2; t += 8) {
      const dashV = new THREE.Mesh(new THREE.PlaneGeometry(0.35, 3.4), lineMat);
      dashV.rotation.x = -Math.PI / 2;
      dashV.position.set(ax, 0.09, t);
      group.add(dashV);
      const dashH = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 0.35), lineMat);
      dashH.rotation.x = -Math.PI / 2;
      dashH.position.set(t, 0.09, ax);
      group.add(dashH);
    }
  }

  // --- Trotoar di sisi jalan + zebra di persimpangan ---
  const walkMat = material(THREE, PALETTE.sidewalk, { roughness: 0.9 });
  const zebraMat = material(THREE, 0xe8e4da, { roughness: 0.7 });
  for (const ax of ROAD_AXES) {
    for (const side of [-1, 1]) {
      const off = ROAD_WIDTH / 2 + SIDEWALK_WIDTH / 2;
      const v = new THREE.Mesh(new THREE.PlaneGeometry(SIDEWALK_WIDTH, WORLD_SIZE), walkMat);
      v.rotation.x = -Math.PI / 2;
      v.position.set(ax + side * off, 0.08, 0);
      v.receiveShadow = true;
      group.add(v);
      const h = new THREE.Mesh(new THREE.PlaneGeometry(WORLD_SIZE, SIDEWALK_WIDTH), walkMat);
      h.rotation.x = -Math.PI / 2;
      h.position.set(0, 0.08, ax + side * off);
      h.receiveShadow = true;
      group.add(h);
    }
  }
  for (const ax of ROAD_AXES) {
    for (const az of ROAD_AXES) {
      // Zebra: 5 garis putih di keempat sisi persimpangan.
      for (let s = -2; s <= 2; s++) {
        const z1 = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 4.6), zebraMat);
        z1.rotation.x = -Math.PI / 2;
        z1.position.set(ax + s * 1.9, 0.1, az + ROAD_WIDTH / 2 + 1.2);
        group.add(z1);
        const z2 = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 4.6), zebraMat);
        z2.rotation.x = -Math.PI / 2;
        z2.position.set(ax + s * 1.9, 0.1, az - ROAD_WIDTH / 2 - 1.2);
        group.add(z2);
      }
    }
  }

  // --- Blok kota: gedung / blok khusus ---
  const palette = PALETTE.buildingBase;
  for (const bx of BLOCK_CENTERS) {
    for (const bz of BLOCK_CENTERS) {
      const key = `${bx},${bz}`;
      const special = SPECIAL_BLOCKS[key];
      if (special === 'plaza') { buildPlaza(THREE, group, bx, bz, rng); continue; }
      if (special === 'canal') { buildCanalBlock(THREE, group, bx, bz, rng, boats); continue; }
      if (special === 'park') { buildPark(THREE, group, bx, bz, rng, trees); continue; }
      if (special === 'lighthouse') { buildLighthouseBlock(THREE, group, bx, bz, rng); continue; }
      if (special === 'warehouse') { buildWarehouseBlock(THREE, group, bx, bz, rng, buildings); continue; }
      if (special === 'containers') { buildContainerYard(THREE, group, bx, bz, rng, buildings); continue; }
      // Blok gedung biasa: 1-3 gedung, tinggi bervariasi.
      const isNiaga = bx >= 0 && bz < 0;
      const count = isNiaga ? 2 + Math.floor(rng() * 2) : 1 + Math.floor(rng() * 2);
      for (let i = 0; i < count; i++) {
        const w = 9 + rng() * 9;
        const d = 9 + rng() * 9;
        const h = isNiaga ? 14 + rng() * 22 : 6 + rng() * 10;
        const x = bx + (rng() - 0.5) * (BLOCK_SIZE - w - 4);
        const z = bz + (rng() - 0.5) * (BLOCK_SIZE - d - 4);
        if (nearMissionPoint(x, z)) continue;
        const color = palette[Math.floor(rng() * palette.length)];
        const b = box(THREE, w, h, d, material(THREE, color));
        b.position.set(x, h / 2, z);
        group.add(b);
        addWindows(THREE, b, w, h, d, rng);
        // Atap: kotak AC / tangki kecil supaya siluet tidak polos.
        const roof = box(THREE, Math.min(4, w / 3), 1.2, Math.min(4, d / 3), material(THREE, 0x555a60));
        roof.position.set(x + w * 0.15, h + 0.6, z - d * 0.1);
        group.add(roof);
        buildings.push({ id: `gedung-${bx}-${bz}-${i}`, x, z, w, d, h });
      }
    }
  }

  // Menara Arunika 55 m — gedung tertinggi kota, di Distrik Niaga.
  const tower = box(THREE, 16, TOWER_HEIGHT, 16, material(THREE, 0x9a6a4a));
  tower.position.set(66, TOWER_HEIGHT / 2, -66);
  group.add(tower);
  addWindows(THREE, tower, 16, TOWER_HEIGHT, 16, rng);
  const beacon = new THREE.Mesh(
    new THREE.SphereGeometry(1.6, 12, 10),
    material(THREE, PALETTE.lantern, { emissive: PALETTE.lantern, emissiveIntensity: 2.2 }),
  );
  beacon.position.set(66, TOWER_HEIGHT + 1.6, -66);
  group.add(beacon);
  buildings.push({ id: 'menara-arunika', x: 66, z: -66, w: 16, d: 16, h: TOWER_HEIGHT });

  // --- Lampu jalan di sepanjang jalan (emitter terdokumentasi, lihat lighting.js) ---
  const poleMat = material(THREE, 0x3a3f45, { metalness: 0.6, roughness: 0.4 });
  const lampMat = material(THREE, PALETTE.lantern, { emissive: PALETTE.lantern, emissiveIntensity: 1.6 });
  for (const ax of ROAD_AXES) {
    for (let t = -99; t <= 99; t += 22) {
      for (const [lx, lz, arm] of [[ax + 7.5, t, -1], [ax - 7.5, t + 11, 1]]) {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 6.5, 8), poleMat);
        pole.position.set(lx, 3.25, lz);
        pole.castShadow = true;
        group.add(pole);
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.45, 10, 8), lampMat);
        head.position.set(lx + arm * 0.9, 6.6, lz);
        group.add(head);
        lamps.push({ x: lx + arm * 0.9, z: lz, y: 6.6, id: `lampu-${ax}-${t}-${arm}` });
      }
    }
  }

  // --- Pohon di trotoar + halte bus ---
  const trunkMat = material(THREE, 0x6a4a2f);
  const leafMat = material(THREE, 0x3f7a4a, { roughness: 1 });
  for (let i = 0; i < 26; i++) {
    const ax = ROAD_AXES[Math.floor(rng() * ROAD_AXES.length)];
    const t = -99 + rng() * 198;
    const side = rng() < 0.5 ? -1 : 1;
    const x = ax + side * (ROAD_WIDTH / 2 + SIDEWALK_WIDTH + 2 + rng() * 3);
    const z = t;
    if (nearMissionPoint(x, z)) continue;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, 2.4, 7), trunkMat);
    trunk.position.set(x, 1.2, z);
    trunk.castShadow = true;
    group.add(trunk);
    const crown = new THREE.Mesh(new THREE.SphereGeometry(1.6 + rng(), 10, 8), leafMat);
    crown.position.set(x, 3.4, z);
    crown.castShadow = true;
    group.add(crown);
    trees.push({ x, z });
  }
  // Halte bus: atap + bangku di 3 titik.
  for (const [hx, hz] of [[44, 22], [-44, -22], [0, 66]]) {
    const shelter = box(THREE, 6, 0.3, 2.4, material(THREE, 0x2f6f8f, { metalness: 0.3 }));
    shelter.position.set(hx, 2.6, hz);
    group.add(shelter);
    for (const px of [-2.6, 2.6]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 2.6, 6), poleMat);
      post.position.set(hx + px, 1.3, hz);
      group.add(post);
    }
    const bench = box(THREE, 4.5, 0.5, 1, material(THREE, 0x8a6a3f));
    bench.position.set(hx, 0.7, hz);
    group.add(bench);
  }

  const colliders = collidersFromBuildings(buildings);
  return { group, buildings, colliders, lamps, trees, boats, landmarks: LANDMARKS };
}

// Plaza + air mancur di Alun-Alun (blok -22, 22): lantai terang, kolam
// bundar, pancuran tengah. Area ini TANPA gedung — titik kumpul M1.
function buildPlaza(THREE, group, bx, bz, rng) {
  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(15, 28),
    material(THREE, 0xb8a88a, { roughness: 0.7 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(bx, 0.12, bz);
  floor.receiveShadow = true;
  group.add(floor);
  const basin = new THREE.Mesh(
    new THREE.CylinderGeometry(5, 5.4, 1.1, 24),
    material(THREE, 0x7a7f85, { roughness: 0.5 }),
  );
  basin.position.set(bx, 0.55, bz);
  basin.castShadow = true;
  group.add(basin);
  const water = new THREE.Mesh(
    new THREE.CircleGeometry(4.6, 24),
    material(THREE, PALETTE.canal, { roughness: 0.15, metalness: 0.5 }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(bx, 1.05, bz);
  group.add(water);
  const spout = new THREE.Mesh(
    new THREE.CylinderGeometry(0.5, 0.8, 3.2, 10),
    material(THREE, 0x9aa0a6, { metalness: 0.4 }),
  );
  spout.position.set(bx, 2.4, bz);
  spout.castShadow = true;
  group.add(spout);
  const orb = new THREE.Mesh(
    new THREE.SphereGeometry(0.9, 12, 10),
    material(THREE, PALETTE.lantern, { emissive: PALETTE.lantern, emissiveIntensity: 1.4 }),
  );
  orb.position.set(bx, 4.4, bz);
  group.add(orb);
  // Lampion di sekeliling plaza (ciri Kampung Lentera merembes ke alun-alun).
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const lamp = new THREE.Mesh(
      new THREE.SphereGeometry(0.55, 10, 8),
      material(THREE, PALETTE.lantern, { emissive: PALETTE.lantern, emissiveIntensity: 1.8 }),
    );
    lamp.position.set(bx + Math.cos(a) * 11, 3.4, bz + Math.sin(a) * 11);
    group.add(lamp);
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 3.4, 6), material(THREE, 0x3a3f45));
    stick.position.set(bx + Math.cos(a) * 11, 1.7, bz + Math.sin(a) * 11);
    group.add(stick);
  }
}

// Kanal Pasar Terapung (blok 22, 22): air + dermaga kayu + perahu dagang.
function buildCanalBlock(THREE, group, bx, bz, rng, boats) {
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(BLOCK_SIZE, BLOCK_SIZE),
    material(THREE, PALETTE.canal, { roughness: 0.15, metalness: 0.5 }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(bx, 0.12, bz);
  water.receiveShadow = true;
  group.add(water);
  // Dermaga kayu di tepi kanal.
  const pier = box(THREE, BLOCK_SIZE, 0.6, 4, material(THREE, 0x8a6a3f));
  pier.position.set(bx, 0.4, bz - BLOCK_SIZE / 2 + 2);
  group.add(pier);
  // 4 perahu dagang: lambung + muatan buah/sayur warna-warni.
  for (let i = 0; i < 4; i++) {
    const px = bx - 10 + i * 7;
    const pz = bz + (i % 2 === 0 ? -4 : 6);
    const hull = box(THREE, 5.5, 1.2, 2.2, material(THREE, [0x7a4a2f, 0x2f6f4a, 0x8a2f2f, 0x2f4a6a][i]));
    hull.position.set(px, 0.7, pz);
    group.add(hull);
    const cargo = box(THREE, 3.5, 0.9, 1.6, material(THREE, [0xe67e22, 0x27ae60, 0xf1c40f, 0xe74c3c][i]));
    cargo.position.set(px, 1.6, pz);
    group.add(cargo);
    boats.push({ x: px, z: pz, id: `perahu-${i}` });
  }
  // Kios pasar di sisi timur kanal (bangunan rendah, atap warna).
  const stall = box(THREE, 8, 4, 10, material(THREE, 0xc2a878));
  stall.position.set(bx + 12, 2, bz + 8);
  group.add(stall);
  const roof = box(THREE, 9, 0.5, 11, material(THREE, 0xd94f3d));
  roof.position.set(bx + 12, 4.3, bz + 8);
  group.add(roof);
}

// Taman Fajar (blok 66, 66): rumput, pohon, jalan setapak, bangku.
function buildPark(THREE, group, bx, bz, rng, trees) {
  const grass = new THREE.Mesh(
    new THREE.PlaneGeometry(BLOCK_SIZE, BLOCK_SIZE),
    material(THREE, 0x4a7a3f, { roughness: 1 }),
  );
  grass.rotation.x = -Math.PI / 2;
  grass.position.set(bx, 0.12, bz);
  grass.receiveShadow = true;
  group.add(grass);
  const path = new THREE.Mesh(
    new THREE.PlaneGeometry(4, BLOCK_SIZE),
    material(THREE, 0xc2b49a, { roughness: 0.9 }),
  );
  path.rotation.x = -Math.PI / 2;
  path.position.set(bx, 0.14, bz);
  group.add(path);
  for (let i = 0; i < 7; i++) {
    const x = bx - 12 + rng() * 24;
    const z = bz - 12 + rng() * 24;
    if (Math.abs(x - bx) < 3) continue;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.35, 2.6, 7), material(THREE, 0x6a4a2f));
    trunk.position.set(x, 1.3, z);
    trunk.castShadow = true;
    group.add(trunk);
    const crown = new THREE.Mesh(new THREE.SphereGeometry(1.9 + rng(), 10, 8), material(THREE, 0x2f7a3f, { roughness: 1 }));
    crown.position.set(x, 3.8, z);
    crown.castShadow = true;
    group.add(crown);
    trees.push({ x, z });
  }
  const bench = box(THREE, 3, 0.5, 1, material(THREE, 0x8a6a3f));
  bench.position.set(bx + 6, 0.7, bz - 8);
  group.add(bench);
}

// Bukit Mercusuar (blok -66, -66): mercusuar tua di atas bukit rendah.
// Bukitnya HANYA visual rendah di tepi blok; area jalan kaki tetap datar.
function buildLighthouseBlock(THREE, group, bx, bz, rng) {
  const mound = new THREE.Mesh(
    new THREE.CylinderGeometry(13, 16, 2.2, 20),
    material(THREE, 0x6a7a5a, { roughness: 1 }),
  );
  mound.position.set(bx, 1.1, bz);
  mound.receiveShadow = true;
  group.add(mound);
  const tower = new THREE.Mesh(
    new THREE.CylinderGeometry(2.2, 3.2, 24, 14),
    material(THREE, 0xe8e0d0, { roughness: 0.8 }),
  );
  tower.position.set(bx, 14.2, bz);
  tower.castShadow = true;
  group.add(tower);
  // Garis merah khas mercusuar.
  for (const y of [8, 16, 22]) {
    const band = new THREE.Mesh(
      new THREE.CylinderGeometry(2.55, 2.75, 1.6, 14),
      material(THREE, 0xb03a2e, { roughness: 0.8 }),
    );
    band.position.set(bx, y, bz);
    group.add(band);
  }
  const lampRoom = new THREE.Mesh(
    new THREE.CylinderGeometry(2.6, 2.6, 2.4, 12),
    material(THREE, 0x2a3442, { metalness: 0.5, roughness: 0.3 }),
  );
  lampRoom.position.set(bx, 27.2, bz);
  group.add(lampRoom);
  const beacon = new THREE.Mesh(
    new THREE.SphereGeometry(1.3, 12, 10),
    material(THREE, 0xfff2b0, { emissive: 0xffe27a, emissiveIntensity: 3 }),
  );
  beacon.position.set(bx, 27.2, bz);
  group.add(beacon);
  // Sinar lampu (kerucut tembus pandang) mengarah ke laut barat.
  const beam = new THREE.Mesh(
    new THREE.ConeGeometry(3.5, 30, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.16, side: THREE.DoubleSide }),
  );
  beam.rotation.z = Math.PI / 2;
  beam.position.set(bx - 17, 27.2, bz);
  group.add(beam);
}

// Gudang kontainer Dermaga (blok -66, 66): gudang besar M3 + tumpukan kontainer.
function buildWarehouseBlock(THREE, group, bx, bz, rng, buildings) {
  const hall = box(THREE, 22, 10, 16, material(THREE, 0x7a8a94, { metalness: 0.25 }));
  hall.position.set(bx - 3, 5, bz);
  group.add(hall);
  const roof = box(THREE, 23, 1, 17, material(THREE, 0x5a6a74));
  roof.position.set(bx - 3, 10.5, bz);
  group.add(roof);
  const door = box(THREE, 8, 7, 0.4, material(THREE, 0x3a4a54, { metalness: 0.4 }));
  door.position.set(bx - 3, 3.5, bz + 8.2);
  group.add(door);
  buildings.push({ id: 'gudang-7', x: bx - 3, z: bz, w: 22, d: 16, h: 10 });
  // Kontainer bertumpuk di sisi timur gudang.
  for (let i = 0; i < 5; i++) {
    const c = box(
      THREE, 6, 2.6, 2.6,
      material(THREE, PALETTE.container[i % PALETTE.container.length], { metalness: 0.3 }),
    );
    c.position.set(bx + 11, 1.3 + (i >= 3 ? 2.6 : 0), bz - 8 + (i % 3) * 7);
    group.add(c);
  }
}

// Lapangan kontainer Dermaga (blok -66, 22): tumpukan kontainer warna-warni.
function buildContainerYard(THREE, group, bx, bz, rng, buildings) {
  for (let i = 0; i < 8; i++) {
    const level = i >= 5 ? 1 : 0;
    const x = bx - 10 + (i % 4) * 7;
    const z = bz - 8 + Math.floor((i % 5) / 2) * 0 + (i < 4 ? -4 : 6);
    const c = box(
      THREE, 6, 2.6, 2.6,
      material(THREE, PALETTE.container[i % PALETTE.container.length], { metalness: 0.3 }),
    );
    c.position.set(x, 1.3 + level * 2.6, z);
    group.add(c);
    if (level === 0) buildings.push({ id: `kontainer-${i}`, x, z, w: 6, d: 2.6, h: 2.6 });
  }
  // Crane pelabuhan kecil (tiang + lengan) di tepi barat.
  const mast = box(THREE, 1.2, 18, 1.2, material(THREE, 0xd4ac0d, { metalness: 0.4 }));
  mast.position.set(bx - 14, 9, bz);
  group.add(mast);
  const arm = box(THREE, 14, 1, 1, material(THREE, 0xd4ac0d, { metalness: 0.4 }));
  arm.position.set(bx - 8, 17, bz);
  group.add(arm);
}
