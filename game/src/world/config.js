// config.js — Konstanta dunia ARUNIKA BAY (kota fajar di tepi dermaga).
// Satu-satunya sumber angka dunia: dipakai city, lighting, traffic,
// pedestrians, vehicles, world/index, dan gameplay (hanya konstanta).
// Semua jarak dalam meter; sumbu +x = timur, +z = selatan, -z = utara.

export const PALETTE = {
  skyTop: 0x9a5f7e, // ungu-merah muda di puncak langit fajar
  skyMid: 0xe8895a, // oranye fajar — warna latar scene
  skyLow: 0xf2b06e, // kuning-oranye di cakrawala
  sun: 0xffd75e, // kuning piringan matahari
  sunHalo: 0xffe9a8,
  sea: 0x1f7a7a, // teal dermaga
  seaDeep: 0x146666,
  ground: 0x46543f, // tanah kota: hijau gelap berdebu
  plaza: 0x8a7a63, // paving alun-alun
  road: 0x33333a, // aspal
  roadLine: 0xe8e4d8, // marka jalan
  sidewalk: 0x6f6a5e,
  buildingA: 0x7a6a8a,
  buildingB: 0x8a7a5a,
  buildingC: 0x5a7a8a,
  buildingD: 0xa88a6a,
  roof: 0x4a3a3a,
  lampGlow: 0xffc46b,
  treeLeaf: 0x3f7a3a,
  treeTrunk: 0x5a4632,
  containerPurple: 0x7a4a9a,
  containerGreen: 0x3f8a4a,
  warehouse: 0x5a5a66,
  doorBlack: 0x14141a,
  kancilOrange: 0xe86a1a, // oranye Kancil curian M2
  policeBlue: 0x2a6fd8,
  baraOrange: 0xf08a1a, // oranye jaket Bara Kelana
};

// Batas kota yang bisa dijelajahi pemain (meter).
export const WORLD_BOUNDS = { minX: -118, maxX: 118, minZ: -118, maxZ: 128 };

// Jaringan jalan: 3 avenida timur-barat dan 3 utara-selatan, lebar 10 m.
export const ROAD_WIDTH = 10;
export const ROAD_Z = [-60, 0, 60]; // avenida timur-barat (garis z tetap)
export const ROAD_X = [-60, 0, 60]; // avenida utara-selatan (garis x tetap)
export const ROAD_EXTENT = 110; // jalan membentang -110..110

// Matahari fajar — bola kuning di utara, jauh di dalam far plane 600.
// Jari-jari 120 (bukan 480): r=480 menelan kamera jadi dinding kuning.
export const SUN_RADIUS = 120;
export const SUN_POSITION = { x: 0, y: 200, z: -520 };
export const SUN_HALO_RADIUS = 168;

// Jumlah penghuni jalan.
export const TRAFFIC_COUNT = 14;
export const PEDESTRIAN_COUNT = 28;
export const PARKED_COUNT = 10;
export const PARKED_LOCKED = 5;

// Kecepatan (m/detik).
export const TRAFFIC_SPEED_MIN = 6;
export const TRAFFIC_SPEED_MAX = 10;
export const PED_SPEED_MIN = 0.9;
export const PED_SPEED_MAX = 1.7;
export const POLICE_CHASE_SPEED = 7.5;

// Kancil M2 curian — mobil pertama Bara.
export const KANCIL = {
  x: -88,
  z: 44,
  rotY: Math.PI / 2,
  type: 'kancil',
  locked: true,
  label: 'M2 — Kancil curian',
};

// Titik spawn awal pemain dan Kancil.
export const SPAWN_POINTS = {
  player: { x: 0, z: 8, yaw: Math.PI },
  kancil: { x: -88, z: 44 },
};

// Air mancur alun-alun (pusat plaza).
export const FOUNTAIN = { x: -12, z: -12, radius: 6 };

// Gudang kontainer pelabuhan + dermaga.
export const WAREHOUSE = { x: -66, z: 104, w: 26, d: 16 };
export const DOCK = { x: -66, z: 122 };
export const SEA_Z = 132; // laut teal mulai di garis z ini

// Zebra cross di persimpangan avenida utama (tempat shot jalan kaki).
export const ZEBRA = { x: 0, z: 0, width: 10, stripes: 7 };

// Nama distrik berdasarkan posisi — dipakai HUD + minimap.
export function districtAt(x, z) {
  if (z >= 80) return 'Dermaga Arunika';
  if (x <= -40 && z <= -40) return 'Kampung Lentera';
  if (Math.abs(x + 12) < 26 && Math.abs(z + 12) < 26) return 'Alun-Alun Arunika';
  if (x >= 40 && z >= 20) return 'Pasar Terapung';
  if (Math.abs(x) < 30 && Math.abs(z) < 30) return 'Alun-Alun Arunika';
  return 'Distrik Niaga';
}

// Generator angka semu deterministik (seed tetap) supaya kota sama di
// setiap pemuatan — penting untuk screenshot yang bisa diulang.
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

export const CITY_SEED = 20261118;

// ---- Tambahan: angka staging shot + detail kota (revisi ke-2) ----

// Posisi staging shot (kalibrasi terverifikasi round 2, dipakai main.js).
export const SHOT_STAGING = {
  cover: {
    car: { x: 0, z: 44, heading: Math.PI / 2, speedKmh: 94 },
    police: [
      { x: 5, z: -6 },
      { x: -5, z: -14 },
    ],
  },
  foot: {
    player: { x: 0, z: 0, yaw: Math.PI },
    blueCar: { x: 6, z: 0.5 },
    heroPed: { x: 3.5, z: -2.5 },
  },
  heist: {
    player: { x: -66, z: 94, yaw: Math.PI },
    guards: [
      { x: -52, z: 94 },
      { x: -80, z: 94 },
      { x: -58, z: 106 },
    ],
  },
  vista: {
    player: { x: -52, z: -52, yaw: Math.PI * 0.25 },
    camera: { x: -52, y: 7, z: -26 },
    look: { x: -38, y: 30, z: -260 },
  },
};

// Detail kota: tinggi gedung, jarak lampu, jarak pohon.
export const BUILDING_HEIGHT_MIN = 9;
export const BUILDING_HEIGHT_MAX = 30;
export const LAMP_SPACING = 22;
export const TREE_SPACING = 16;
export const PARKING_SPOTS = [
  { x: -88, z: 20 },
  { x: -88, z: 26 },
  { x: -88, z: 32 },
  { x: -88, z: 38 },
  { x: -88, z: 44 },
  { x: -88, z: 50 },
  { x: -88, z: 56 },
  { x: -88, z: 62 },
  { x: -80, z: 20 },
  { x: -80, z: 62 },
];

// Warna minimap 2D (dipakai minimap.js, bukan THREE).
export const MINIMAP_COLORS = {
  background: '#1c2430',
  road: '#5a6270',
  sea: '#1f7a7a',
  plaza: '#8a7a63',
  player: '#f08a1a',
  police: '#2a6fd8',
  enemy: '#d83a2a',
  kancil: '#e86a1a',
};
