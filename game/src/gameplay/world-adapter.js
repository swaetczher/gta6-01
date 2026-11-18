// world-adapter.js — Kontrak integrasi dunia + dunia stub cadangan.
// Kontrak yang dipenuhi modul dunia asli (game/src/world/index.js,
// createWorld(THREE, scene)) maupun stub di bawah ini:
//   world.bounds            angka, setengah lebar dunia (±110)
//   world.roads             daftar koordinat jalan (jarak 44 m)
//   world.colliders         [{ x1, z1, x2, z2 }] AABB gedung (bidang y=0)
//   world.cars              [{ id, model, x, z, heading, speed, locked, driven, stolen }]
//   world.landmarks         [{ name, x, z, mark }] (alun-alun, pasar, bengkel,
//                           rumah sakit, kantor polisi, taman, mercusuar, halte)
//   world.spawn             { x, z, heading } titik spawn pemain
//   world.hospital          { x, z }  |  world.policeStation { x, z }
//   world.resolveCircle(x, z, r) -> { x, z } (geser keluar collider + clamp bounds)
//   world.isWalkable(x, z)  -> boolean
//   world.setCarDriven(id, driven)
//   world.update(dt, hudState)      (traffic + pejalan kaki bergerak)
//   world.dunia             akses mentah ke API lengkap dunia asli (bila ada)
// Stub dipakai bila modul dunia belum ada: kota datar orisinal 220x220 m,
// grid jalan 5x5, 10 mobil parkir, 8 landmark — cukup untuk memainkan
// semua misi sampai integrasi dunia asli selesai.
export const WORLD_BOUNDS = 110;
export const WORLD_ROADS = [-88, -44, 0, 44, 88];

// KANAL PASAR TERAPUNG — DIBLOKIR (keputusan koordinator 18 Nov 10:14 WIB).
// Kanal TIDAK punya collider air di dunia; pemain jalan kaki + mobil
// TIDAK boleh masuk area air (bukan jalan pintas air, tidak ada renang).
// Batas persegi dari city.js buildCanalBlock: blok (22, 22), BLOCK_SIZE
// 34 m (ROAD_SPACING 44 - ROAD_WIDTH 10) -> air x 5..39, z 5..39.
// Ditegakkan di sisi Gameplay (isWalkable + resolveCircle) — file dunia
// TIDAK diubah. Objektif misi di tengah kanal dipindah ke tepinya
// (lihat missions.js: M1 (22,0), M4 (22,0)) karena titik (22,22)
// berada di dalam air dan tidak lagi bisa dicapai jalan kaki.
export const CANAL_RECT = { x1: 5, z1: 5, x2: 39, z2: 39 };

export function isInCanal(x, z) {
  return x > CANAL_RECT.x1 && x < CANAL_RECT.x2 && z > CANAL_RECT.z1 && z < CANAL_RECT.z2;
}

// Dorong titik keluar dari persegi kanal lewat sisi terdekat (margin r).
export function pushOutOfCanal(x, z, r) {
  if (!isInCanal(x, z)) return { x, z };
  const dxl = x - (CANAL_RECT.x1 - r);
  const dxr = (CANAL_RECT.x2 + r) - x;
  const dzl = z - (CANAL_RECT.z1 - r);
  const dzr = (CANAL_RECT.z2 + r) - z;
  const m = Math.min(dxl, dxr, dzl, dzr);
  if (m === dxl) return { x: CANAL_RECT.x1 - r, z };
  if (m === dxr) return { x: CANAL_RECT.x2 + r, z };
  if (m === dzl) return { x, z: CANAL_RECT.z1 - r };
  return { x, z: CANAL_RECT.z2 + r };
}

export function createStubWorld() {
  const colliders = [];
  // Blok gedung di antara jalan: tiap sel grid 44 m berisi satu gedung
  // kotak dengan jalan keliling; koridor misi dibiarkan kosong.
  const keepClear = [
    { x: -22, z: 22 }, { x: 22, z: 22 }, { x: 66, z: -22 }, { x: -22, z: -66 },
    { x: -88, z: 44 }, { x: -66, z: 78 }, { x: 44, z: 44 }, { x: 88, z: 44 },
    { x: -66, z: -66 }, { x: -44, z: -88 }, { x: 0, z: 44 }, { x: 22, z: 22 },
  ];
  const clear = (cx, cz) => keepClear.some((k) => Math.abs(k.x - cx) < 22 && Math.abs(k.z - cz) < 22);
  for (const gx of [-66, -22, 22, 66]) {
    for (const gz of [-66, -22, 22, 66]) {
      if (clear(gx, gz)) continue;
      const w = 18 + ((Math.abs(gx * 7 + gz * 13) % 8));
      const d = 18 + ((Math.abs(gx * 3 + gz * 11) % 8));
      colliders.push({ x1: gx - w / 2, z1: gz - d / 2, x2: gx + w / 2, z2: gz + d / 2 });
    }
  }
  const cars = [
    { id: 'mobil-kancil-1', model: 'Kancil', x: -88, z: 44, heading: 0, speed: 0, locked: true, driven: false, stolen: false },
    { id: 'mobil-kancil-2', model: 'Kancil', x: -44, z: -88, heading: 1.57, speed: 0, locked: false, driven: false, stolen: false },
    { id: 'mobil-banteng-1', model: 'Banteng', x: 44, z: 44, heading: 0, speed: 0, locked: false, driven: false, stolen: false },
    { id: 'mobil-banteng-2', model: 'Banteng', x: 0, z: -88, heading: 0, speed: 0, locked: true, driven: false, stolen: false },
    { id: 'mobil-taksi-1', model: 'Lentera Cab', x: 44, z: -44, heading: 1.57, speed: 0, locked: false, driven: false, stolen: false },
    { id: 'mobil-taksi-2', model: 'Lentera Cab', x: -44, z: 88, heading: 0, speed: 0, locked: false, driven: false, stolen: false },
    { id: 'mobil-polair-1', model: 'Polair Arunika', x: 88, z: 44, heading: 0, speed: 0, locked: true, driven: false, stolen: false },
    { id: 'mobil-polair-2', model: 'Polair Arunika', x: 88, z: -44, heading: 0, speed: 0, locked: true, driven: false, stolen: false },
    { id: 'mobil-kancil-3', model: 'Kancil', x: 0, z: 88, heading: 1.57, speed: 0, locked: false, driven: false, stolen: false },
    { id: 'mobil-banteng-3', model: 'Banteng', x: -88, z: 0, heading: 0, speed: 0, locked: false, driven: false, stolen: false },
  ];
  const landmarks = [
    { name: 'Alun-Alun Arunika', x: 0, z: -44, mark: 'A' },
    { name: 'Pasar Terapung', x: -44, z: 0, mark: 'P' },
    { name: 'Bengkel Lentera', x: -44, z: 44, mark: 'B' },
    { name: 'Rumah Sakit Arunika', x: 44, z: 44, mark: 'H' },
    { name: 'Kantor Polisi Pelabuhan', x: 88, z: 44, mark: 'K' },
    { name: 'Taman Fajar', x: 0, z: 0, mark: 'T' },
    { name: 'Mercusuar Arunika', x: 88, z: 88, mark: 'M' },
    { name: 'Halte Dermaga', x: -88, z: -88, mark: 'D' },
  ];
  const world = {
    bounds: WORLD_BOUNDS,
    roads: [...WORLD_ROADS],
    colliders,
    cars,
    landmarks,
    canal: { ...CANAL_RECT }, // air Pasar Terapung: diblokir (lihat atas)
    spawn: { x: 0, z: 51, heading: Math.PI },
    hospital: { x: 44, z: 44 },
    policeStation: { x: 88, z: 44 },
    dunia: null, // stub: tidak ada API dunia asli
    isStub: true,
    resolveCircle(x, z, r) {
      let nx = Math.max(-WORLD_BOUNDS + r, Math.min(WORLD_BOUNDS - r, x));
      let nz = Math.max(-WORLD_BOUNDS + r, Math.min(WORLD_BOUNDS - r, z));
      for (const c of colliders) {
        if (nx > c.x1 - r && nx < c.x2 + r && nz > c.z1 - r && nz < c.z2 + r) {
          const dxl = nx - (c.x1 - r);
          const dxr = (c.x2 + r) - nx;
          const dzl = nz - (c.z1 - r);
          const dzr = (c.z2 + r) - nz;
          const m = Math.min(dxl, dxr, dzl, dzr);
          if (m === dxl) nx = c.x1 - r;
          else if (m === dxr) nx = c.x2 + r;
          else if (m === dzl) nz = c.z1 - r;
          else nz = c.z2 + r;
        }
      }
      const out = pushOutOfCanal(nx, nz, r);
      return out;
    },
    isWalkable(x, z) {
      if (Math.abs(x) > WORLD_BOUNDS || Math.abs(z) > WORLD_BOUNDS) return false;
      if (isInCanal(x, z)) return false;
      for (const c of colliders) {
        if (x > c.x1 && x < c.x2 && z > c.z1 && z < c.z2) return false;
      }
      return true;
    },
    setCarDriven(id, driven) {
      const car = cars.find((c) => c.id === id);
      if (car) car.driven = driven;
    },
    update() {
      // Stub: tidak ada traffic ambien; mobil parkir diam.
    },
  };
  return world;
}

// Normalisasi objek dunia asli (dari createWorld) ke kontrak di atas.
// Field yang hilang diisi dari stub supaya gameplay tidak crash.
// PENTING: mobil TIDAK di-clone — field ditambahkan langsung ke objek
// asli supaya traffic dunia (yang membaca car.driven) dan gameplay
// (yang menulis car.speed/locked/stolen) melihat objek yang sama.
// Perbedaan API dunia asli yang dijembatani di sini:
// - bounds objek {half} -> angka; spawn bernama playerSpawn {facing};
// - collider {minX,maxX,minZ,maxZ} -> {x1,z1,x2,z2} untuk HUD/minimap;
// - resolveCircle(posObj, r) -> resolveCircle(x, z, r);
// - setDrivenCar(carObj) -> setCarDriven(id, driven);
// - mobil: {type, name} -> ditambah model/id/stolen; Kancil M2
//   (label 'M2 — Kancil curian') dijadikan terkunci sesuai desain M2.
const LANDMARK_MARKS = {
  plaza: 'A', market: 'P', garage: 'B', hospital: 'H', police: 'K',
  park: 'T', tower: 'M', lighthouse: 'L', warehouse: 'G', 'bus-stop': 'D',
};

export function adaptWorld(raw) {
  if (!raw || typeof raw !== 'object') return createStubWorld();
  const stub = createStubWorld();
  const boundsNum = raw.bounds && typeof raw.bounds === 'object'
    ? (raw.bounds.half || WORLD_BOUNDS)
    : (typeof raw.bounds === 'number' ? raw.bounds : WORLD_BOUNDS);
  const cars = Array.isArray(raw.cars) && raw.cars.length ? raw.cars : stub.cars;
  cars.forEach((car, i) => {
    if (!car.id) car.id = `mobil-${car.type || car.model || 'kancil'}-${i + 1}`;
    if (!car.model) car.model = car.name || car.type || 'Kancil';
    if (typeof car.stolen !== 'boolean') car.stolen = false;
    if (typeof car.locked !== 'boolean') car.locked = false;
    if (car.label && String(car.label).includes('M2')) car.locked = true;
    if (typeof car.speed !== 'number') car.speed = 0;
    if (typeof car.heading !== 'number') car.heading = 0;
  });
  const colliders = (Array.isArray(raw.colliders) ? raw.colliders : stub.colliders).map((c) => {
    if (typeof c.x1 === 'number') return c;
    return { x1: c.minX, z1: c.minZ, x2: c.maxX, z2: c.maxZ, id: c.id };
  });
  const landmarks = (Array.isArray(raw.landmarks) && raw.landmarks.length ? raw.landmarks : stub.landmarks)
    .map((lm) => ({ ...lm, mark: lm.mark || LANDMARK_MARKS[lm.kind] || '◆' }));
  const spawnRaw = raw.spawn || raw.playerSpawn || stub.spawn;
  const world = {
    bounds: boundsNum,
    roads: Array.isArray(raw.roads) && raw.roads.length ? raw.roads : stub.roads,
    colliders,
    cars,
    landmarks,
    canal: { ...CANAL_RECT }, // air Pasar Terapung: diblokir (lihat atas)
    spawn: {
      x: spawnRaw.x,
      z: spawnRaw.z,
      heading: typeof spawnRaw.heading === 'number'
        ? spawnRaw.heading
        : (typeof spawnRaw.facing === 'number' ? spawnRaw.facing : Math.PI),
    },
    hospital: raw.hospital || stub.hospital,
    policeStation: raw.policeStation || stub.policeStation,
    dunia: raw.dunia || raw,
    isStub: false,
    resolveCircle: typeof raw.resolveCircle === 'function'
      ? (x, z, r) => {
        const p = raw.resolveCircle({ x, z }, r);
        return pushOutOfCanal(p.x, p.z, r);
      }
      : (x, z, r) => {
        const s = stub.resolveCircle(x, z, r);
        return pushOutOfCanal(s.x, s.z, r);
      },
    isWalkable: typeof raw.isWalkable === 'function'
      ? (x, z) => !isInCanal(x, z) && raw.isWalkable(x, z)
      : (x, z) => !isInCanal(x, z) && stub.isWalkable(x, z),
    setCarDriven: typeof raw.setDrivenCar === 'function'
      ? (id, driven) => {
        const car = cars.find((c) => c.id === id);
        if (car) raw.setDrivenCar(driven ? car : null);
      }
      : (id, driven) => {
        const car = cars.find((c) => c.id === id);
        if (car) car.driven = driven;
      },
    update: typeof raw.update === 'function' ? raw.update.bind(raw) : stub.update.bind(stub),
  };
  return world;
}
// --- akhir world-adapter.js (baris revisi ditambahkan lewat edit terpisah) ---
// Revisi terekam: titik-titik misi (M1–M5) sengaja dikosongkan dari
// collider lewat daftar keepClear — pemain tidak pernah spawn objektif
// di dalam gedung, apa pun seed dunia yang dipakai Rewrite-World.
export function isMissionPointClear(world, x, z) {
  return world.isWalkable(x, z);
}
