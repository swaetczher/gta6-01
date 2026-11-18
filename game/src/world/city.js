// ARUNIKA BAY — kota fajar: tanah, jalan, zebra, gedung, pohon, lampu,
// plaza/air mancur, kanal Pasar Terapung, dermaga + laut teal (round 2).
// Dibangun deterministik (mulberry32 seed 7) supaya tiap load identik.
import { PALETTE, WORLD, AVENUES, STREETS, LANDMARKS, mulberry32 } from './config.js';
import { addLampLight } from './lighting.js';

function flat(THREE, w, d, color, x, y, z, ry = 0) {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(w, d),
    new THREE.MeshStandardMaterial({ color, roughness: 0.95 }),
  );
  m.rotation.x = -Math.PI / 2;
  m.rotation.z = ry;
  m.position.set(x, y, z);
  m.receiveShadow = true;
  return m;
}

function box(THREE, w, h, d, color, x, y, z, ry = 0) {
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({ color, roughness: 0.85 }),
  );
  m.position.set(x, y + h / 2, z);
  m.rotation.y = ry;
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

// Tanah dasar + trotoar blok + jalan aspal + garis tengah + zebra.
function buildGroundAndRoads(THREE, scene, colliders) {
  const g = new THREE.Group();
  g.add(flat(THREE, WORLD.size * 2.4, WORLD.size * 2.4, PALETTE.ground, 0, -0.05, 20));
  // Trotoar: satu bidang terang per blok di antara jalan.
  for (let ix = 0; ix < AVENUES.length - 1; ix++) {
    for (let iz = 0; iz < STREETS.length - 1; iz++) {
      const x0 = AVENUES[ix] + WORLD.roadHalf;
      const x1 = AVENUES[ix + 1] - WORLD.roadHalf;
      const z0 = STREETS[iz] + WORLD.roadHalf;
      const z1 = STREETS[iz + 1] - WORLD.roadHalf;
      const cx = (x0 + x1) / 2;
      const cz = (z0 + z1) / 2;
      g.add(flat(THREE, x1 - x0, z1 - z0, PALETTE.sidewalk, cx, 0.02, cz));
    }
  }
  // Aspal: jalur utara-selatan (avenue) + timur-barat (street).
  for (const x of AVENUES) {
    g.add(flat(THREE, WORLD.roadWidth, WORLD.size, PALETTE.road, x, 0.03, 0));
  }
  for (const z of STREETS) {
    g.add(flat(THREE, WORLD.size, WORLD.roadWidth, PALETTE.road, 0, 0.04, z));
  }
  // Garis tengah putus-putus di tiap jalan.
  for (const x of AVENUES) {
    for (let z = -120; z <= 120; z += 8) {
      g.add(flat(THREE, 0.4, 3.4, PALETTE.roadLine, x, 0.06, z));
    }
  }
  for (const z of STREETS) {
    for (let x = -120; x <= 120; x += 8) {
      g.add(flat(THREE, 3.4, 0.4, PALETTE.roadLine, x, 0.06, z));
    }
  }
  // Zebra cross di tiap persimpangan (4 sisi).
  for (const x of AVENUES) {
    for (const z of STREETS) {
      for (let i = -2; i <= 2; i++) {
        g.add(flat(THREE, 1.1, 3.6, PALETTE.zebra, x + i * 1.7, 0.07, z - 6.4));
        g.add(flat(THREE, 1.1, 3.6, PALETTE.zebra, x + i * 1.7, 0.07, z + 6.4));
        g.add(flat(THREE, 3.6, 1.1, PALETTE.zebra, x - 6.4, 0.07, z + i * 1.7));
        g.add(flat(THREE, 3.6, 1.1, PALETTE.zebra, x + 6.4, 0.07, z + i * 1.7));
      }
    }
  }
  scene.add(g);
  return g;
}

// Gedung: satu-dua kotak per blok, tinggi 8–26 m, jendela menyala fajar.
// Gedung TIDAK dibangun di plaza (0,0), kanal (z 56–76), dan dermaga.
function buildBuildings(THREE, scene, rng, colliders) {
  const g = new THREE.Group();
  const palette = [PALETTE.buildingA, PALETTE.buildingB, PALETTE.buildingC, PALETTE.buildingD];
  const winMat = new THREE.MeshStandardMaterial({
    color: PALETTE.windowLit, emissive: PALETTE.windowLit, emissiveIntensity: 0.7,
  });
  const winDark = new THREE.MeshStandardMaterial({ color: PALETTE.windowDark });
  for (let ix = 0; ix < AVENUES.length - 1; ix++) {
    for (let iz = 0; iz < STREETS.length - 1; iz++) {
      const cx = (AVENUES[ix] + AVENUES[ix + 1]) / 2;
      const cz = (STREETS[iz] + STREETS[iz + 1]) / 2;
      // Lewati plaza tengah, jalur kanal, dan area gudang/dermaga selatan.
      if (Math.abs(cx) < 25 && Math.abs(cz) < 25) continue;
      if (cz > 52 && cz < 78) continue;
      if (cz > 88) continue;
      // Lewati alun-alun lentera Kampung Lentera (-52,-52): ruang terbuka.
      if (Math.hypot(cx + 52, cz + 52) < 26) continue;
      const count = 1 + Math.floor(rng() * 2);
      for (let b = 0; b < count; b++) {
        // Gedung dijepit di dalam blok dengan jarak aman 4 m dari tepi
        // trotoar (9 m dari sumbu jalan) — fasad gedung tidak boleh
        // menempel ke jalan dan menutup frame kamera kejar.
        const bx0 = AVENUES[ix] + WORLD.roadHalf;
        const bx1 = AVENUES[ix + 1] - WORLD.roadHalf;
        const bz0 = STREETS[iz] + WORLD.roadHalf;
        const bz1 = STREETS[iz + 1] - WORLD.roadHalf;
        let w = 12 + rng() * 10;
        let d = 12 + rng() * 10;
        w = Math.min(w, (bx1 - bx0) - 8);
        d = Math.min(d, (bz1 - bz0) - 8);
        const h = 8 + rng() * 18;
        const ox = (rng() - 0.5) * 8;
        const oz = (rng() - 0.5) * 8;
        const bx = Math.max(bx0 + w / 2 + 4, Math.min(bx1 - w / 2 - 4, cx + ox));
        const bz = Math.max(bz0 + d / 2 + 4, Math.min(bz1 - d / 2 - 4, cz + oz));
        const color = palette[Math.floor(rng() * palette.length)];
        g.add(box(THREE, w, h, d, color, bx, 0, bz));
        g.add(box(THREE, w + 0.6, 0.8, d + 0.6, PALETTE.roof, bx, h, bz));
        // Jendela menyala di dua sisi hadap jalan.
        const rows = Math.max(2, Math.floor(h / 4));
        for (let r = 0; r < rows; r++) {
          for (let cI = -1; cI <= 1; cI++) {
            const lit = rng() > 0.45;
            const win = new THREE.Mesh(
              new THREE.PlaneGeometry(1.6, 2.0),
              lit ? winMat : winDark,
            );
            win.position.set(bx + cI * (w / 3.4), 3 + r * 3.4, bz + d / 2 + 0.06);
            g.add(win);
          }
        }
        colliders.push({ x: bx, z: bz, w, d });
      }
    }
  }
  scene.add(g);
  return g;
}

// Pohon rindang di tepi trotoar + lampu jalan menyala di tiap persimpangan.
function buildTreesAndLamps(THREE, scene, rng, colliders) {
  const g = new THREE.Group();
  const trunkMat = new THREE.MeshStandardMaterial({ color: PALETTE.treeTrunk, roughness: 1 });
  const leafMats = [
    new THREE.MeshStandardMaterial({ color: PALETTE.treeLeaf, roughness: 1 }),
    new THREE.MeshStandardMaterial({ color: PALETTE.treeLeaf2, roughness: 1 }),
  ];
  for (let ix = 0; ix < AVENUES.length - 1; ix++) {
    for (let iz = 0; iz < STREETS.length - 1; iz++) {
      const cx = (AVENUES[ix] + AVENUES[ix + 1]) / 2;
      const cz = (STREETS[iz] + STREETS[iz + 1]) / 2;
      if (Math.abs(cx) < 25 && Math.abs(cz) < 25) continue;
      if (cz > 52 && cz < 78) continue;
      // Alun-alun lentera Kampung Lentera (-52,-52): tanpa pohon.
      if (Math.hypot(cx + 52, cz + 52) < 26) continue;
      const trees = 1 + Math.floor(rng() * 2);
      for (let t = 0; t < trees; t++) {
        const tx = cx + (rng() - 0.5) * 22;
        const tz = cz + (rng() - 0.5) * 22;
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.4, 2.4, 7), trunkMat);
        trunk.position.set(tx, 1.2, tz);
        trunk.castShadow = true;
        g.add(trunk);
        const leaf = new THREE.Mesh(
          new THREE.SphereGeometry(1.6 + rng() * 0.9, 10, 8),
          leafMats[Math.floor(rng() * leafMats.length)],
        );
        leaf.position.set(tx, 3.4 + rng() * 0.8, tz);
        leaf.castShadow = true;
        g.add(leaf);
        colliders.push({ x: tx, z: tz, r: 0.6 });
      }
    }
  }
  // Lampu jalan di keempat sudut tiap persimpangan (satu lampu per simpang).
  for (const x of AVENUES) {
    for (const z of STREETS) {
      const lx = x + 6.2;
      const lz = z + 6.2;
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.12, 0.16, 5.4, 7),
        new THREE.MeshStandardMaterial({ color: PALETTE.lampPole }),
      );
      pole.position.set(lx, 2.7, lz);
      pole.castShadow = true;
      g.add(pole);
      const bulb = new THREE.Mesh(
        new THREE.SphereGeometry(0.42, 10, 8),
        new THREE.MeshStandardMaterial({
          color: PALETTE.lampGlow, emissive: PALETTE.lampGlow, emissiveIntensity: 1.6,
        }),
      );
      bulb.position.set(lx, 5.5, lz);
      g.add(bulb);
      addLampLight(THREE, scene, lx, lz, 5.2);
      colliders.push({ x: lx, z: lz, r: 0.35 });
    }
  }
  scene.add(g);
  return g;
}

// Alun-Alun Arunika: plaza bundar + air mancur di tengah kota (0,0).
// Air mancur digeser ke sudut barat-laut plaza (-12,-12) — BARA BERDIRI
// DI TENGAH ZEBRA (0,0) saat shot foot, dan kamera shot foot di (0,2)
// tidak boleh melayang tepat di atas baskom.
function buildPlaza(THREE, scene, colliders) {
  const g = new THREE.Group();
  g.add(flat(THREE, 46, 46, PALETTE.plaza, 0, 0.05, 0));
  const fx = -12;
  const fz = -12;
  const basin = new THREE.Mesh(
    new THREE.CylinderGeometry(6, 6.6, 1.1, 24),
    new THREE.MeshStandardMaterial({ color: 0x9a8d7c, roughness: 0.9 }),
  );
  basin.position.set(fx, 0.55, fz);
  basin.castShadow = true;
  g.add(basin);
  const water = new THREE.Mesh(
    new THREE.CylinderGeometry(5.4, 5.4, 0.3, 24),
    new THREE.MeshStandardMaterial({
      color: PALETTE.fountainWater, roughness: 0.15, metalness: 0.2,
    }),
  );
  water.position.set(fx, 1.05, fz);
  g.add(water);
  const pillar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.5, 0.8, 2.6, 10),
    new THREE.MeshStandardMaterial({ color: 0xd8cdb8, roughness: 0.8 }),
  );
  pillar.position.set(fx, 1.8, fz);
  pillar.castShadow = true;
  g.add(pillar);
  const jet = new THREE.Mesh(
    new THREE.SphereGeometry(0.9, 10, 8),
    new THREE.MeshStandardMaterial({
      color: PALETTE.fountainWater, emissive: 0x5aa8c8, emissiveIntensity: 0.5,
    }),
  );
  jet.position.set(fx, 3.4, fz);
  g.add(jet);
  colliders.push({ x: fx, z: fz, r: 6.8 });
  scene.add(g);
  return g;
}

// Kanal Pasar Terapung (z 56–76): air + perahu dagang + tenda pasar.
function buildCanal(THREE, scene, rng, colliders) {
  const g = new THREE.Group();
  g.add(flat(THREE, 130, 18, PALETTE.canalWater, -20, 0.06, 66));
  for (let i = 0; i < 5; i++) {
    const bx = -62 + i * 22 + rng() * 6;
    const bz = 62 + rng() * 8;
    g.add(box(THREE, 7, 1.1, 2.6, PALETTE.boatHull, bx, 0.1, bz, (rng() - 0.5) * 0.3));
    g.add(box(THREE, 4.5, 1.6, 2.0, PALETTE.marketAwning, bx, 1.0, bz, (rng() - 0.5) * 0.3));
    colliders.push({ x: bx, z: bz, w: 7, d: 3 });
  }
  // Deret kios di tepi utara kanal — lewati koridor avenue x=0 supaya
  // tidak menutup pandangan kamera kejar shot cover (kamera di (0,58)
  // menghadap utara; atap kios di (-4,52) pernah menutup setengah frame).
  for (let i = 0; i < 6; i++) {
    const kx = -58 + i * 18;
    if (Math.abs(kx) < 24) continue;
    g.add(box(THREE, 6, 3.2, 5, 0xc8b088, kx, 0, 52));
    g.add(box(THREE, 7, 0.5, 6, PALETTE.marketAwning, kx, 3.4, 52));
    colliders.push({ x: kx, z: 52, w: 6, d: 5 });
  }
  scene.add(g);
  return g;
}

// Gudang kontainer Dermaga (dekat -66, 102): aula + pintu hitam + kontainer.
function buildWarehouse(THREE, scene, colliders) {
  const g = new THREE.Group();
  const w = LANDMARKS.warehouse;
  g.add(box(THREE, 34, 12, 20, PALETTE.warehouse, w.x, 0, w.z));
  g.add(box(THREE, 35, 1, 21, PALETTE.roof, w.x, 12, w.z));
  // Pintu hitam besar menghadap utara (ke arah pemain heist di z=94).
  const door = box(THREE, 10, 8, 0.8, PALETTE.warehouseDoor, w.x, 0, w.z - 10.2);
  g.add(door);
  // Kontainer ungu + hijau di kanan gudang, satu karat di kiri.
  g.add(box(THREE, 12, 2.6, 2.6, PALETTE.containerPurple, w.x + 26, 0, w.z - 4));
  g.add(box(THREE, 12, 2.6, 2.6, PALETTE.containerGreen, w.x + 26, 0, w.z + 4));
  g.add(box(THREE, 12, 2.6, 2.6, PALETTE.containerGreen, w.x + 26, 2.6, w.z - 4));
  g.add(box(THREE, 12, 2.6, 2.6, PALETTE.containerRust, w.x - 26, 0, w.z + 2));
  colliders.push({ x: w.x, z: w.z, w: 34, d: 20 });
  colliders.push({ x: w.x + 26, z: w.z - 4, w: 12, d: 2.6 });
  colliders.push({ x: w.x + 26, z: w.z + 4, w: 12, d: 2.6 });
  colliders.push({ x: w.x - 26, z: w.z + 2, w: 12, d: 2.6 });
  scene.add(g);
  return g;
}

// Alun-alun lentera Kampung Lentera (-52,-52): pelataran bundar + tiang
// lentera menyala. Dipakai shot vista — Bara berdiri di ruang terbuka.
function buildLanternPlaza(THREE, scene, colliders) {
  const g = new THREE.Group();
  const c = LANDMARKS.lanternVillage;
  g.add(flat(THREE, 30, 30, PALETTE.plaza, c.x, 0.05, c.z));
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(9, 0.5, 8, 32),
    new THREE.MeshStandardMaterial({ color: 0x8a7a5a, roughness: 0.9 }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(c.x, 0.15, c.z);
  g.add(ring);
  // Empat tiang lentera di sudut pelataran.
  const glowMat = new THREE.MeshStandardMaterial({
    color: 0xffb84d, emissive: 0xff9d2a, emissiveIntensity: 1.4,
  });
  for (const [ox, oz] of [[-8, -8], [8, -8], [-8, 8], [8, 8]]) {
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.14, 0.18, 4.4, 7),
      new THREE.MeshStandardMaterial({ color: PALETTE.lampPole }),
    );
    pole.position.set(c.x + ox, 2.2, c.z + oz);
    pole.castShadow = true;
    g.add(pole);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.55, 10, 8), glowMat);
    lamp.position.set(c.x + ox, 4.6, c.z + oz);
    g.add(lamp);
    colliders.push({ x: c.x + ox, z: c.z + oz, r: 0.35 });
  }
  scene.add(g);
  return g;
}

// Dermaga + laut teal di selatan (z > 112): papan kayu + air berkilau.
function buildDockAndSea(THREE, scene, colliders) {
  const g = new THREE.Group();
  g.add(flat(THREE, 150, 14, PALETTE.sand, -20, 0.05, 108));
  g.add(flat(THREE, 120, 8, PALETTE.dock, -30, 0.08, 112));
  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(560, 160),
    new THREE.MeshStandardMaterial({ color: PALETTE.sea, roughness: 0.25, metalness: 0.35 }),
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(0, -0.15, 196);
  sea.receiveShadow = true;
  g.add(sea);
  // Tiang dermaga.
  for (let i = 0; i < 8; i++) {
    g.add(box(THREE, 0.8, 2.2, 0.8, PALETTE.dock, -84 + i * 16, -0.2, 116));
  }
  colliders.push({ x: -30, z: 112, w: 120, d: 8 });
  scene.add(g);
  return g;
}

// Perakit kota — dipanggil buildWorld. Kembalikan collider + landmark.
export function buildCity(THREE, scene) {
  const rng = mulberry32(7);
  const colliders = [];
  buildGroundAndRoads(THREE, scene, colliders);
  buildBuildings(THREE, scene, rng, colliders);
  buildTreesAndLamps(THREE, scene, rng, colliders);
  buildPlaza(THREE, scene, colliders);
  buildLanternPlaza(THREE, scene, colliders);
  buildCanal(THREE, scene, rng, colliders);
  buildWarehouse(THREE, scene, colliders);
  buildDockAndSea(THREE, scene, colliders);
  return {
    colliders,
    landmarks: LANDMARKS,
    plaza: LANDMARKS.plaza,
    warehouse: LANDMARKS.warehouse,
    dock: LANDMARKS.dock,
  };
}
