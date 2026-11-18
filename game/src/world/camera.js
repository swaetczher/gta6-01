// camera.js — Kamera third-person ARUNIKA BAY.
// Tiga mode: 'foot' (jalan kaki, di belakang bahu pemain), 'drive'
// (mengejar dari belakang mobil, lebih jauh + lebih tinggi), dan
// 'vista' (sinematik: dari Bukit Mercusuar memandang kota saat fajar).
// Kamera dihaluskan (lerp) supaya tidak patah; tidak pernah menembus
// gedung — jarak ditarik bila ada collider di antara kamera dan target.

import { WORLD_HALF } from './config.js';
import { circleHits } from './collision.js';

// Mode kamera yang dipakai saat ini (string) — Gameplay boleh membaca
// untuk menampilkan label mode di HUD debug.
export const CAMERA_MODES = ['foot', 'drive', 'vista'];

// Hitung posisi kamera ideal di belakang target (heading = arah hadap).
function behindPosition(target, heading, distance, height) {
  return {
    x: target.x - Math.sin(heading) * distance,
    z: target.z - Math.cos(heading) * distance,
    y: height,
  };
}

// Tarik kamera mendekat bila garis pandang ke target terhalang gedung.
// Sederhana: cek titik kamera; bila di dalam collider, majukan 1 m
// berulang sampai keluar (maks 6 langkah).
function pullInIfBlocked(pos, target, colliders) {
  let p = { ...pos };
  for (let i = 0; i < 6; i++) {
    if (!circleHits(p.x, p.z, 0.6, colliders)) return p;
    p.x += (target.x - p.x) * 0.25;
    p.z += (target.z - p.z) * 0.25;
  }
  return p;
}

// Perbarui kamera satu frame. `opts`: { mode, target {x,z,heading},
// car (objek mobil bila drive), colliders, dt, time }.
// `camera` = THREE.PerspectiveCamera milik renderer Gameplay/main.
// Mengembalikan mode yang dipakai.
export function updateCamera(camera, opts) {
  const { mode = 'foot', target, car = null, colliders = [], dt = 0.016 } = opts;
  const k = Math.min(1, dt * 6); // faktor lerp (halus, framerate-independent-ish)
  let desired;
  let lookAt;

  if (mode === 'drive' && car) {
    // Kamera mengemudi: 10 m di belakang mobil, 4,2 m di atas tanah,
    // melebar saat mobil cepat (rasa kecepatan).
    const speed = Math.abs(car.speed || 0);
    const dist = 10 + Math.min(4, speed * 0.12);
    desired = behindPosition({ x: car.x, z: car.z }, car.heading, dist, 4.2);
    lookAt = { x: car.x + Math.sin(car.heading) * 6, y: 1.6, z: car.z + Math.cos(car.heading) * 6 };
  } else if (mode === 'vista') {
    // Vista dari Bukit Mercusuar: kamera diam di atas bukit, memandang
    // kota + matahari terbit di timur. Dipakai shot 4 + layar akhir M5.
    desired = { x: -66, y: 34, z: -88 };
    lookAt = { x: 30, y: 6, z: 10 };
  } else {
    // Jalan kaki: 7 m di belakang, 3,4 m di atas — pemain + jalan depan terlihat.
    desired = behindPosition(target, target.heading || 0, 7, 3.4);
    lookAt = { x: target.x + Math.sin(target.heading || 0) * 4, y: 1.6, z: target.z + Math.cos(target.heading || 0) * 4 };
  }

  // Jangan tembus gedung (kecuali vista yang memang di atas bukit).
  if (mode !== 'vista') desired = pullInIfBlocked(desired, { x: lookAt.x, z: lookAt.z }, colliders);

  // Jepit ke dunia supaya kamera tidak keluar jauh dari kota.
  desired.x = Math.max(-WORLD_HALF - 30, Math.min(WORLD_HALF + 30, desired.x));
  desired.z = Math.max(-WORLD_HALF - 30, Math.min(WORLD_HALF + 30, desired.z));
  desired.y = Math.max(1.2, desired.y);

  camera.position.x += (desired.x - camera.position.x) * k;
  camera.position.y += (desired.y - camera.position.y) * k;
  camera.position.z += (desired.z - camera.position.z) * k;
  camera.lookAt(lookAt.x, lookAt.y, lookAt.z);
  return mode;
}

// Atur kamera langsung ke posisi mode (tanpa lerp) — dipakai saat spawn /
// ganti mode mendadak (masuk mobil) supaya tidak ada sapuan kamera panjang.
export function snapCamera(camera, opts) {
  const { mode = 'foot', target, car = null, colliders = [] } = opts;
  let desired;
  let lookAt;
  if (mode === 'drive' && car) {
    desired = behindPosition({ x: car.x, z: car.z }, car.heading, 10, 4.2);
    lookAt = { x: car.x + Math.sin(car.heading) * 6, y: 1.6, z: car.z + Math.cos(car.heading) * 6 };
  } else if (mode === 'vista') {
    desired = { x: -66, y: 34, z: -88 };
    lookAt = { x: 30, y: 6, z: 10 };
  } else {
    desired = behindPosition(target, target.heading || 0, 7, 3.4);
    lookAt = { x: target.x, y: 1.6, z: target.z };
  }
  if (mode !== 'vista') desired = pullInIfBlocked(desired, { x: lookAt.x, z: lookAt.z }, colliders);
  camera.position.set(desired.x, desired.y, desired.z);
  camera.lookAt(lookAt.x, lookAt.y, lookAt.z);
  return mode;
}
