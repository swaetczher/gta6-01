// minimap.js — Data minimap ARUNIKA BAY.
// Data berasal dari dunia yang sebenarnya: jarak jalan 44 m (ROAD_SPACING
// dari config.js), distrik + landmark dari config, posisi mobil live
// dari traffic + parkir. Gameplay/HUD yang menggambar canvas-nya —
// modul ini HANYA menyediakan data + proyeksi dunia-ke-minimap.
// Proyeksi: dunia +-110 m -> minimap 0..1 (x dan z dinormalisasi).

import { ROAD_AXES, ROAD_SPACING, WORLD_HALF, DISTRICTS, LANDMARKS } from './config.js';

// Nama distrik di titik (x, z) — label yang ditampilkan HUD saat
// pemain pindah distrik.
export function districtNameAt(x, z) {
  for (const d of DISTRICTS) {
    const b = d.bounds;
    if (x >= b.minX && x < b.maxX && z >= b.minZ && z < b.maxZ) return d.name;
  }
  return 'Distrik Niaga';
}

// Proyeksi satu titik dunia ke koordinat minimap 0..1.
// (0,0) = barat laut (-110,-110); (1,1) = tenggara (110,110).
export function worldToMinimap(x, z) {
  return {
    u: (x + WORLD_HALF) / (WORLD_HALF * 2),
    v: (z + WORLD_HALF) / (WORLD_HALF * 2),
  };
}

// Proyeksi balik minimap -> dunia (dipakai klik minimap / debug).
export function minimapToWorld(u, v) {
  return {
    x: u * WORLD_HALF * 2 - WORLD_HALF,
    z: v * WORLD_HALF * 2 - WORLD_HALF,
  };
}

// Data minimap lengkap untuk satu frame. `world` = objek dari createWorld.
// `player` = { x, z, heading } atau null; `missionTarget` = { x, z } atau null.
export function getMinimapData(world, player = null, missionTarget = null) {
  const roads = [];
  // Jalan vertikal + horizontal: garis dari -110 ke 110 di tiap sumbu jalan.
  for (const ax of ROAD_AXES) {
    roads.push({ x1: ax, z1: -WORLD_HALF, x2: ax, z2: WORLD_HALF });
    roads.push({ x1: -WORLD_HALF, z1: ax, x2: WORLD_HALF, z2: ax });
  }
  const districts = DISTRICTS.map((d) => ({
    id: d.id,
    name: d.name,
    bounds: d.bounds,
    center: {
      x: (d.bounds.minX + d.bounds.maxX) / 2,
      z: (d.bounds.minZ + d.bounds.maxZ) / 2,
    },
  }));
  const landmarks = LANDMARKS.map((l) => ({ ...l }));
  // Mobil live: traffic (bergerak) + parkir (diam). Posisi diambil dari
  // objek mobil yang sama dengan yang dirender — tidak ada tebakan.
  const cars = [];
  for (const car of world.cars || []) {
    cars.push({
      x: car.x,
      z: car.z,
      heading: car.heading,
      type: car.type,
      parked: !!car.parked,
      driven: !!car.driven,
      locked: !!car.locked,
    });
  }
  return {
    roadSpacing: ROAD_SPACING,
    worldHalf: WORLD_HALF,
    roads,
    districts,
    landmarks,
    cars,
    player: player ? { x: player.x, z: player.z, heading: player.heading || 0 } : null,
    missionTarget: missionTarget ? { x: missionTarget.x, z: missionTarget.z } : null,
    hospital: world.hospital,
    policeStation: world.policeStation,
  };
}

// Gambar minimap ke canvas 2D (dipakai HUD bila Gameplay tidak punya
// renderer minimap sendiri). `ctx` = CanvasRenderingContext2D,
// `size` = sisi canvas (px). Warna: jalan abu, distrik label, landmark
// kuning, pemain panah putih, mobil titik biru, target misi bintang merah.
export function drawMinimap(ctx, size, data) {
  const scale = size / (WORLD_HALF * 2);
  const px = (x) => (x + WORLD_HALF) * scale;
  const pz = (z) => (z + WORLD_HALF) * scale;
  ctx.clearRect(0, 0, size, size);
  // Latar: laut barat + daratan.
  ctx.fillStyle = '#2f7f8f';
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = '#5a5148';
  ctx.fillRect(px(-WORLD_HALF), 0, size, size);
  // Blok distrik: garis batas tipis.
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 1;
  for (const d of data.districts) {
    ctx.strokeRect(px(d.bounds.minX), pz(d.bounds.minZ),
      (d.bounds.maxX - d.bounds.minX) * scale, (d.bounds.maxZ - d.bounds.minZ) * scale);
  }
  // Jalan (pakai jarak 44 m yang sebenarnya dari data).
  ctx.strokeStyle = '#e8e4da';
  ctx.lineWidth = Math.max(2, 10 * scale);
  for (const r of data.roads) {
    ctx.beginPath();
    ctx.moveTo(px(r.x1), pz(r.z1));
    ctx.lineTo(px(r.x2), pz(r.z2));
    ctx.stroke();
  }
  // Landmark: titik kuning.
  ctx.fillStyle = '#ffd27a';
  for (const l of data.landmarks) {
    ctx.beginPath();
    ctx.arc(px(l.x), pz(l.z), 3, 0, Math.PI * 2);
    ctx.fill();
  }
  // Rumah sakit (salib hijau) + kantor polisi (biru).
  ctx.fillStyle = '#2fa36b';
  ctx.fillRect(px(data.hospital.x) - 4, pz(data.hospital.z) - 1.5, 8, 3);
  ctx.fillRect(px(data.hospital.x) - 1.5, pz(data.hospital.z) - 4, 3, 8);
  ctx.fillStyle = '#2f6fb2';
  ctx.beginPath();
  ctx.arc(px(data.policeStation.x), pz(data.policeStation.z), 4, 0, Math.PI * 2);
  ctx.fill();
  // Mobil: titik biru (parkir = abu-abu).
  for (const c of data.cars) {
    ctx.fillStyle = c.parked ? '#9a938a' : '#7ab8ff';
    ctx.beginPath();
    ctx.arc(px(c.x), pz(c.z), c.driven ? 4 : 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
  // Target misi: bintang merah.
  if (data.missionTarget) {
    ctx.fillStyle = '#ff4444';
    const tx = px(data.missionTarget.x);
    const tz = pz(data.missionTarget.z);
    ctx.beginPath();
    ctx.arc(tx, tz, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  // Pemain: panah putih searah heading.
  if (data.player) {
    const p = data.player;
    ctx.save();
    ctx.translate(px(p.x), pz(p.z));
    ctx.rotate(Math.atan2(Math.sin(p.heading), Math.cos(p.heading)) + Math.PI / 2);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(0, -7);
    ctx.lineTo(5, 6);
    ctx.lineTo(-5, 6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  return data;
}
