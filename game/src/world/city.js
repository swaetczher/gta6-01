// city.js — Geometri kota ARUNIKA BAY: tanah, laut, jalan, gedung,
// alun-alun + air mancur, gudang pelabuhan + kontainer, pohon, lampu.
// Satu-satunya builder kota; dipanggil world/index.js. Mengembalikan
// collider, graf jalan (untuk traffic), dan pegangan landmark.

import {
  PALETTE,
  ROAD_WIDTH,
  ROAD_Z,
  ROAD_X,
  ROAD_EXTENT,
  FOUNTAIN,
  WAREHOUSE,
  DOCK,
  SEA_Z,
  ZEBRA,
  CITY_SEED,
  BUILDING_HEIGHT_MIN,
  BUILDING_HEIGHT_MAX,
  LAMP_SPACING,
  TREE_SPACING,
  mulberry32,
} from './config.js';
import { makeStreetLamp } from './lighting.js';

function box(THREE, w, h, d, color, x, y, z) {
  const geo = new THREE.BoxGeometry(w, h, d);
  const mat = new THREE.MeshStandardMaterial({ color });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, y, z);
  return mesh;
}

function flat(THREE, w, d, color, x, z, y = 0.02) {
  const geo = new THREE.PlaneGeometry(w, d);
  const mat = new THREE.MeshStandardMaterial({ color });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(x, y, z);
  return mesh;
}

// Graf jalan untuk traffic: ruas lurus antar persimpangan.
export function buildRoadGraph() {
  const segments = [];
  for (const z of ROAD_Z) {
    segments.push({ ax: -ROAD_EXTENT, az: z, bx: ROAD_EXTENT, bz: z });
  }
  for (const x of ROAD_X) {
    segments.push({ ax: x, az: -ROAD_EXTENT, bx: x, bz: ROAD_EXTENT });
  }
  return { segments };
}

export function buildCity(THREE, scene) {
  const colliders = [];
  const rand = mulberry32(CITY_SEED);
  const group = new THREE.Group();
  scene.add(group);

  // Tanah dasar kota.
  const ground = flat(THREE, 420, 420, PALETTE.ground, 0, 10, 0);
  group.add(ground);

  // Laut teal di dermaga selatan (z >= SEA_Z).
  const sea = flat(THREE, 420, 200, PALETTE.sea, 0, SEA_Z + 100, 0.01);
  group.add(sea);
  const seaDeep = flat(THREE, 420, 60, PALETTE.seaDeep, 0, SEA_Z + 170, 0.015);
  group.add(seaDeep);

  // Dermaga kayu di tepi laut.
  const dock = box(THREE, 120, 0.6, 12, 0x6a5138, DOCK.x, 0.3, DOCK.z);
  group.add(dock);

  // Jalan aspal + trotoar di kedua sisinya.
  for (const z of ROAD_Z) {
    group.add(flat(THREE, ROAD_EXTENT * 2, ROAD_WIDTH, PALETTE.road, 0, z, 0.03));
    group.add(flat(THREE, ROAD_EXTENT * 2, 2.4, PALETTE.sidewalk, 0, z - ROAD_WIDTH / 2 - 1.2, 0.035));
    group.add(flat(THREE, ROAD_EXTENT * 2, 2.4, PALETTE.sidewalk, 0, z + ROAD_WIDTH / 2 + 1.2, 0.035));
    // Marka tengah putus-putus.
    for (let x = -100; x <= 100; x += 8) {
      group.add(flat(THREE, 3.2, 0.35, PALETTE.roadLine, x, z, 0.05));
    }
  }
  for (const x of ROAD_X) {
    group.add(flat(THREE, ROAD_WIDTH, ROAD_EXTENT * 2, PALETTE.road, x, 0, 0.03));
    group.add(flat(THREE, 2.4, ROAD_EXTENT * 2, PALETTE.sidewalk, x - ROAD_WIDTH / 2 - 1.2, 0, 0.035));
    group.add(flat(THREE, 2.4, ROAD_EXTENT * 2, PALETTE.sidewalk, x + ROAD_WIDTH / 2 + 1.2, 0, 0.035));
    for (let z = -100; z <= 100; z += 8) {
      group.add(flat(THREE, 0.35, 3.2, PALETTE.roadLine, x, z, 0.05));
    }
  }

  // Zebra cross di persimpangan utama (0,0) — tempat shot jalan kaki.
  for (let i = 0; i < ZEBRA.stripes; i++) {
    const sx = -ZEBRA.width / 2 + (i + 0.5) * (ZEBRA.width / ZEBRA.stripes);
    group.add(flat(THREE, 0.9, ROAD_WIDTH + 2, 0xf5f2e8, sx, ZEBRA.z, 0.06));
  }

  // Alun-alun: lingkaran paving di sekitar air mancur.
  const plazaGeo = new THREE.CircleGeometry(16, 28);
  const plazaMat = new THREE.MeshStandardMaterial({ color: PALETTE.plaza });
  const plaza = new THREE.Mesh(plazaGeo, plazaMat);
  plaza.rotation.x = -Math.PI / 2;
  plaza.position.set(FOUNTAIN.x, 0.04, FOUNTAIN.z);
  group.add(plaza);

  // Air mancur: bak bundar + kolom tengah + cakram air biru.
  const basinGeo = new THREE.CylinderGeometry(FOUNTAIN.radius, FOUNTAIN.radius + 0.6, 1.1, 24);
  const basinMat = new THREE.MeshStandardMaterial({ color: 0x9a8a72 });
  const basin = new THREE.Mesh(basinGeo, basinMat);
  basin.position.set(FOUNTAIN.x, 0.55, FOUNTAIN.z);
  group.add(basin);
  const waterGeo = new THREE.CircleGeometry(FOUNTAIN.radius - 0.5, 24);
  const waterMat = new THREE.MeshStandardMaterial({ color: 0x3fa8c8 });
  const water = new THREE.Mesh(waterGeo, waterMat);
  water.rotation.x = -Math.PI / 2;
  water.position.set(FOUNTAIN.x, 1.05, FOUNTAIN.z);
  group.add(water);
  const colGeo = new THREE.CylinderGeometry(0.7, 0.9, 2.6, 12);
  const col = new THREE.Mesh(colGeo, new THREE.MeshStandardMaterial({ color: 0x8a7a63 }));
  col.position.set(FOUNTAIN.x, 1.8, FOUNTAIN.z);
  group.add(col);
  colliders.push({ x: FOUNTAIN.x, z: FOUNTAIN.z, r: FOUNTAIN.radius + 0.4 });

  // Gedung di blok-blok antar jalan (lewati petak plaza + parkir barat).
  const paletteCycle = [PALETTE.buildingA, PALETTE.buildingB, PALETTE.buildingC, PALETTE.buildingD];
  const blockCenters = [];
  for (const gx of [-90, -30, 30, 90]) {
    for (const gz of [-90, -30, 30, 90]) {
      blockCenters.push({ x: gx, z: gz });
    }
  }
  let bi = 0;
  for (const b of blockCenters) {
    // Petak plaza (-30,-30) menampung alun-alun; petak (-90,30) parkir.
    if (b.x === -30 && b.z === -30) continue;
    if (b.x === -90 && b.z === 30) continue;
    const n = 2 + Math.floor(rand() * 2); // 2-3 gedung per blok
    for (let k = 0; k < n; k++) {
      const w = 12 + rand() * 10;
      const d = 12 + rand() * 10;
      const h = BUILDING_HEIGHT_MIN + rand() * (BUILDING_HEIGHT_MAX - BUILDING_HEIGHT_MIN);
      const ox = (rand() - 0.5) * 22;
      const oz = (rand() - 0.5) * 22;
      const bx = b.x + ox;
      const bz = b.z + oz;
      const color = paletteCycle[bi % paletteCycle.length];
      bi++;
      const tower = box(THREE, w, h, d, color, bx, h / 2, bz);
      group.add(tower);
      const roof = box(THREE, w + 0.6, 0.8, d + 0.6, PALETTE.roof, bx, h + 0.4, bz);
      group.add(roof);
      // Jendela menyala: strip tipis kuning di sisi menghadap jalan.
      const win = box(THREE, w * 0.7, 0.5, 0.2, PALETTE.lampGlow, bx, h * 0.55, bz - d / 2 - 0.05);
      group.add(win);
      colliders.push({ x: bx, z: bz, w, d });
    }
  }

  // Pohon di tepi trotoar avenida utama.
  for (let x = -100; x <= 100; x += TREE_SPACING) {
    for (const z of [-6.8, 6.8]) {
      if (Math.abs(x) < 8) continue; // jangan tutupi zebra cross
      const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.22, 0.3, 2.4, 8),
        new THREE.MeshStandardMaterial({ color: PALETTE.treeTrunk }),
      );
      trunk.position.set(x, 1.2, z);
      group.add(trunk);
      const crown = new THREE.Mesh(
        new THREE.ConeGeometry(1.9, 4.2, 8),
        new THREE.MeshStandardMaterial({ color: PALETTE.treeLeaf }),
      );
      crown.position.set(x, 4.4, z);
      group.add(crown);
    }
  }

  // Lampu jalan di kedua sisi avenida z=0 dan x=0.
  for (let x = -99; x <= 99; x += LAMP_SPACING) {
    group.add(makeStreetLamp(THREE, x, -6.4));
    group.add(makeStreetLamp(THREE, x + 11, 6.4));
  }
  for (let z = -99; z <= 99; z += LAMP_SPACING) {
    group.add(makeStreetLamp(THREE, -6.4, z));
    group.add(makeStreetLamp(THREE, 6.4, z + 11));
  }

  // Gudang pelabuhan: kotak besar + pintu hitam menghadap utara (ke pemain).
  const wh = WAREHOUSE;
  const shed = box(THREE, wh.w, 9, wh.d, PALETTE.warehouse, wh.x, 4.5, wh.z);
  group.add(shed);
  const shedRoof = box(THREE, wh.w + 1, 0.7, wh.d + 1, PALETTE.roof, wh.x, 9.3, wh.z);
  group.add(shedRoof);
  const door = box(THREE, 6, 6.5, 0.4, PALETTE.doorBlack, wh.x, 3.25, wh.z - wh.d / 2 - 0.1);
  group.add(door);
  colliders.push({ x: wh.x, z: wh.z, w: wh.w, d: wh.d });

  // Kontainer: ungu di barat gudang, hijau di timur — penanda shot heist.
  const contPurple = box(THREE, 10, 3.2, 3.4, PALETTE.containerPurple, wh.x - 22, 1.6, wh.z - 2);
  group.add(contPurple);
  const contGreen = box(THREE, 10, 3.2, 3.4, PALETTE.containerGreen, wh.x + 22, 1.6, wh.z + 1);
  group.add(contGreen);
  const contStack = box(THREE, 8, 3.2, 3.4, PALETTE.containerGreen, wh.x - 22, 4.8, wh.z - 2);
  group.add(contStack);
  colliders.push({ x: wh.x - 22, z: wh.z - 2, w: 10, d: 3.4 });
  colliders.push({ x: wh.x + 22, z: wh.z + 1, w: 10, d: 3.4 });

  const roads = buildRoadGraph();
  return {
    group,
    colliders,
    roads,
    fountain: { x: FOUNTAIN.x, z: FOUNTAIN.z },
    warehouse: { x: wh.x, z: wh.z },
    zebra: { x: ZEBRA.x, z: ZEBRA.z },
    dock: { x: DOCK.x, z: DOCK.z },
  };
}
