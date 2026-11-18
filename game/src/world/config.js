// config.js — Konstanta dunia ARUNIKA BAY (kota fajar, satu bidang datar).
// Semua angka di sini adalah sumber kebenaran tunggal: jarak jalan 44 meter,
// batas dunia +-110 meter, dan titik-titik misi. Modul lain TIDAK boleh
// menebak angka ini sendiri — impor dari sini.

// Dimensi kota: grid jalan 5 x 5, jarak antar jalan 44 meter.
export const ROAD_SPACING = 44;
export const ROAD_COUNT = 5;
export const ROAD_WIDTH = 10;
export const SIDEWALK_WIDTH = 3;
// Sumbu jalan: -88, -44, 0, 44, 88 (5 jalan tiap arah).
export const ROAD_AXES = [-88, -44, 0, 44, 88];
// Batas dunia yang bisa dijelajahi pemain.
export const WORLD_HALF = 110;
export const WORLD_SIZE = WORLD_HALF * 2;

// Pusat blok kota (16 blok, 4 x 4): -66, -22, 22, 66 tiap sumbu.
export const BLOCK_CENTERS = [-66, -22, 22, 66];
// Lebar blok yang bisa dibangun (jarak jalan dikurangi lebar jalan).
export const BLOCK_SIZE = ROAD_SPACING - ROAD_WIDTH;

// Gedung tertinggi: Menara Arunika 55 meter di Distrik Niaga.
export const TOWER_HEIGHT = 55;
export const TOWER_BLOCK = { x: 66, z: -66 };

// Palet fajar Arunika: oranye-merah muda di langit, teal di laut/pelabuhan.
export const PALETTE = {
  // Langit atas fajar: ungu-mawar redup (bukan biru gelap malam) supaya
  // kubah langit terbaca sebagai fajar oranye, bukan langit hitam.
  skyTop: 0x9a5f7e,
  skyMid: 0xff9a5c,
  skyLow: 0xffc98a,
  sun: 0xffd9a0,
  fog: 0xf2b98c,
  ground: 0x8a7f6a,
  road: 0x33343a,
  roadLine: 0xf5e9c8,
  sidewalk: 0x9a938a,
  sea: 0x2f7f8f,
  canal: 0x3f8fa3,
  buildingBase: [0xb98a6a, 0x8a9aa8, 0xc2a878, 0x7a8a7a, 0xa86a7a, 0x6a7a9a],
  windowLit: 0xffd27a,
  windowDark: 0x2a3442,
  lantern: 0xffb347,
  container: [0xc0392b, 0x2471a3, 0x1e8449, 0xd4ac0d, 0x7d3c98],
};

// Lima distrik Arunika. `bounds` dipakai minimap + penanda misi.
export const DISTRICTS = [
  {
    id: 'dermaga',
    name: 'Dermaga Arunika',
    desc: 'Pelabuhan kontainer dan gudang',
    bounds: { minX: -110, maxX: -44, minZ: -22, maxZ: 110 },
  },
  {
    id: 'pasar',
    name: 'Pasar Terapung',
    desc: 'Kanal dan perahu dagang',
    bounds: { minX: 0, maxX: 110, minZ: 0, maxZ: 44 },
  },
  {
    id: 'kampung',
    name: 'Kampung Lentera',
    desc: 'Permukiman padat berlampion',
    bounds: { minX: -110, maxX: 0, minZ: -110, maxZ: -22 },
  },
  {
    id: 'bukit',
    name: 'Bukit Mercusuar',
    desc: 'Mercusuar tua di bukit',
    bounds: { minX: -110, maxX: -44, minZ: -110, maxZ: -22 },
  },
  {
    id: 'niaga',
    name: 'Distrik Niaga',
    desc: 'Jalan lebar, gedung, traffic padat',
    bounds: { minX: 0, maxX: 110, minZ: -110, maxZ: 0 },
  },
];

// Landmark yang dijamin ada (id stabil — dipakai Gameplay + minimap).
export const LANDMARKS = [
  { id: 'alun-alun', name: 'Alun-Alun Arunika', kind: 'plaza', x: -22, z: 22 },
  { id: 'pasar-terapung', name: 'Pasar Terapung', kind: 'market', x: 22, z: 22 },
  { id: 'bengkel', name: 'Bengkel Lentera', kind: 'garage', x: -22, z: -66 },
  { id: 'rumah-sakit', name: 'RS Arunika', kind: 'hospital', x: 66, z: -22 },
  { id: 'kantor-polisi', name: 'Kantor Polair Arunika', kind: 'police', x: 22, z: -22 },
  { id: 'taman', name: 'Taman Fajar', kind: 'park', x: 66, z: 66 },
  { id: 'menara', name: 'Menara Arunika', kind: 'tower', x: 66, z: -66 },
  { id: 'mercusuar', name: 'Mercusuar Tua', kind: 'lighthouse', x: -66, z: -66 },
  { id: 'gudang', name: 'Gudang Kontainer 7', kind: 'warehouse', x: -66, z: 66 },
  { id: 'halte-pasar', name: 'Halte Pasar Terapung', kind: 'bus-stop', x: 44, z: 22 },
];

// Titik-titik misi Gameplay (M1-M5 riset). Semua dijamin BISA DILALUI:
// city.js TIDAK pernah menaruh gedung/collider dalam radius 12 m titik ini.
export const MISSION_POINTS = {
  m1_start: { x: -22, z: 22, label: 'M1 Kurir Fajar — start Alun-Alun' },
  m1_a: { x: 22, z: 22, label: 'M1 Kurir Fajar — Pasar Terapung' },
  m1_b: { x: 66, z: -22, label: 'M1 Kurir Fajar — RS Arunika' },
  m2_car: { x: -88, z: 44, label: 'M2 Mobil Pertama — parkiran Dermaga' },
  m2_garage: { x: -22, z: -66, label: 'M2 Mobil Pertama — Bengkel Lentera' },
  m3_warehouse: { x: -66, z: 78, label: 'M3 Brankas Pelabuhan — depan pintu Gudang 7' },
  m4_canal: { x: 22, z: 22, label: 'M4 Pelarian Pasar Terapung — kanal' },
  m4_exit: { x: 88, z: 44, label: 'M4 Pelarian — ujung kanal timur' },
  m5_lighthouse: { x: -66, z: -66, label: 'M5 Fajar Terakhir — Bukit Mercusuar' },
};

// Spawn pemain: trotoar Alun-Alun, menghadap Pasar Terapung (timur).
export const PLAYER_SPAWN = { x: -22, z: 34, facing: Math.PI / 2 };
// Rumah sakit + kantor polisi (dipakai sistem wanted / respawn Gameplay).
export const HOSPITAL_POS = { x: 66, z: -22 };
export const POLICE_POS = { x: 22, z: -22 };
// Spawn mobil polisi (depan kantor polisi, di jalan).
export const POLICE_SPAWN = { x: 22, z: -10 };

// Enam tipe kendaraan prosedural orisinal (bukan merek nyata).
export const VEHICLE_TYPES = [
  { id: 'kancil', name: 'Kancil', kind: 'sedan', color: 0xd94f3d, topSpeed: 26, accel: 14 },
  { id: 'banteng', name: 'Banteng', kind: 'pickup', color: 0x3d6ed9, topSpeed: 24, accel: 12 },
  { id: 'lentera', name: 'Lentera Cab', kind: 'taxi', color: 0xf2c230, topSpeed: 25, accel: 13 },
  { id: 'polair', name: 'Polair Arunika', kind: 'police', color: 0x2f6fb2, topSpeed: 30, accel: 16 },
  { id: 'angkot', name: 'Angkot Fajar', kind: 'minibus', color: 0x2fa36b, topSpeed: 21, accel: 10 },
  { id: 'truk', name: 'Truk Dermaga', kind: 'truck', color: 0x8a8f96, topSpeed: 19, accel: 9 },
];

// Jumlah ambien: belasan mobil traffic, puluhan pejalan kaki, 10 parkir.
export const TRAFFIC_COUNT = 14;
export const PEDESTRIAN_COUNT = 28;
export const PARKED_COUNT = 10;

// Lampu lalu lintas: 4 persimpangan pusat, siklus hijau 6 dtk / merah 6 dtk.
export const TRAFFIC_LIGHT_NODES = [
  { x: 0, z: 0 },
  { x: 0, z: 44 },
  { x: 44, z: 0 },
  { x: 44, z: 44 },
];
export const TRAFFIC_LIGHT_CYCLE = 12;

// Util: apakah titik (x, z) berada di atas badan jalan (bukan trotoar/blok).
// Dipakai traffic (tetap di jalan) dan pejalan kaki (menghindari jalan raya).
export function isOnRoad(x, z) {
  const half = ROAD_WIDTH / 2;
  const onVertical = ROAD_AXES.some((ax) => Math.abs(x - ax) <= half);
  const onHorizontal = ROAD_AXES.some((az) => Math.abs(z - az) <= half);
  return onVertical || onHorizontal;
}

// Util: cari distrik yang memuat titik (x, z). Dipakai minimap + HUD.
export function districtAt(x, z) {
  for (const d of DISTRICTS) {
    const b = d.bounds;
    if (x >= b.minX && x < b.maxX && z >= b.minZ && z < b.maxZ) return d;
  }
  return DISTRICTS[4];
}

// Util: jepit titik ke dalam batas dunia.
export function clampToWorld(x, z) {
  const m = WORLD_HALF - 2;
  return { x: Math.max(-m, Math.min(m, x)), z: Math.max(-m, Math.min(m, z)) };
}
