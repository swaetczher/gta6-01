// ARUNIKA BAY — konstanta dunia fajar (tulis ulang round 2, dari CONTRACT.md).
// Satu-satunya sumber angka dunia: semua modul world + gameplay (via config)
// membaca dari sini, supaya staging, tes, dan HUD memakai angka yang sama.

// Palet fajar: langit ungu-mawar di atas, oranye di cakrawala, laut teal.
export const PALETTE = {
  skyTop: 0x9a5f7e,
  skyMid: 0xe08a4c,
  skyHorizon: 0xf2b06e,
  sun: 0xffd76a,
  sunGlow: 0xff9d4d,
  road: 0x33303a,
  roadEdge: 0x4a4552,
  roadLine: 0xf5e9c8,
  zebra: 0xe8e4da,
  sidewalk: 0x9a8d7c,
  ground: 0x7d8a5f,
  plaza: 0xb8a88f,
  sea: 0x1f8a8a,
  sand: 0xd9c49a,
  dock: 0x7a5c38,
  buildingA: 0xb0563a,
  buildingB: 0x7a6a8f,
  buildingC: 0x4a7a8a,
  buildingD: 0x8f7a4a,
  roof: 0x3a3340,
  windowLit: 0xffd98a,
  windowDark: 0x2c2836,
  lampPole: 0x2e2a33,
  lampGlow: 0xffe9a8,
  treeTrunk: 0x5a4028,
  treeLeaf: 0x3f7a3a,
  treeLeaf2: 0x6a9a3a,
  fountainWater: 0x7ec8d8,
  containerPurple: 0x7a4a9a,
  containerGreen: 0x3f8a4a,
  containerRust: 0xa85a2a,
  warehouse: 0x8a8f96,
  warehouseDoor: 0x1a1a20,
  canalWater: 0x2a7a8a,
  boatHull: 0x8a4a2a,
  marketAwning: 0xd84a4a,
};

// Geometri kota: grid jalan 5x5, blok 30 m, jalan selebar 10 m.
export const WORLD = {
  half: 130,
  size: 260,
  roadWidth: 10,
  blockSize: 30,
  roadHalf: 5,
  seaStartZ: 112,
  seaEndZ: 260,
  groundY: 0,
};

export const AVENUES = [-80, -40, 0, 40, 80];
export const STREETS = [-80, -40, 0, 40, 80];

export const TRAFFIC_COUNT = 14;
export const PEDESTRIAN_COUNT = 28;
export const PARKED_COUNT = 10;

// Titik spawn pemain (dekat Alun-Alun) dan Kancil curian M2.
export const SPAWN = {
  player: { x: 8, z: 6, yaw: Math.PI },
  kancil: { x: -88, z: 44 },
};

// Spot parkir Kancil M2 — mobil pertama yang dicuri (M2 "Mobil Pertama").
export const KANCIL_SPOT = {
  x: -88,
  z: 44,
  rotY: Math.PI / 2,
  type: 'kancil',
  locked: true,
  label: 'M2 — Kancil curian',
};

// Landmark yang dipakai staging shot + tes dunia.
export const LANDMARKS = {
  plaza: { x: 0, z: 0, name: 'Alun-Alun Arunika' },
  warehouse: { x: -66, z: 106, name: 'Gudang Kontainer' },
  dock: { x: -40, z: 108, name: 'Dermaga Arunika' },
  marketCanal: { x: -20, z: 64, name: 'Pasar Terapung' },
  lanternVillage: { x: -52, z: -52, name: 'Kampung Lentera' },
  businessDistrict: { x: 0, z: 44, name: 'Distrik Niaga' },
};

// Distrik bernama — dipakai HUD + minimap + staging (kotak x/z inklusif).
export const DISTRICTS = [
  { name: 'Alun-Alun Arunika', x0: -20, x1: 20, z0: -20, z1: 20 },
  { name: 'Distrik Niaga', x0: -20, x1: 60, z0: 20, z1: 60 },
  { name: 'Kampung Lentera', x0: -100, x1: -20, z0: -100, z1: -20 },
  { name: 'Dermaga Arunika', x0: -100, x1: 20, z0: 80, z1: 130 },
  { name: 'Pasar Terapung', x0: -70, x1: 30, z0: 56, z1: 76 },
  { name: 'Kampung Pesisir', x0: 20, x1: 100, z0: 80, z1: 130 },
];

// Nama distrik untuk satu titik; jatuh ke nama umum bila di luar kotak.
export function districtAt(x, z) {
  for (const d of DISTRICTS) {
    if (x >= d.x0 && x <= d.x1 && z >= d.z0 && z <= d.z1) return d.name;
  }
  return 'Arunika Bay';
}

// RNG deterministik (mulberry32) — penempatan gedung/pohon stabil tiap load.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Bundel konstanta yang dikembalikan buildWorld sebagai `world.config`.
export const CONFIG = {
  PALETTE,
  WORLD,
  AVENUES,
  STREETS,
  TRAFFIC_COUNT,
  PEDESTRIAN_COUNT,
  PARKED_COUNT,
  SPAWN,
  KANCIL_SPOT,
  LANDMARKS,
  DISTRICTS,
};
