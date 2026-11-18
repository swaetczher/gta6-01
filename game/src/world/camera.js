// camera.js — Kamera ARUNIKA BAY: kamera permainan + framing shot.
// Mode permainan: kamera mengikuti dari belakang pemain (third-person).
// Mode shot: posisi + arah pandang tetap per mode (kalibrasi round 2,
// dengan perbaikan vista agar matahari masuk frame dan heist agar
// preman ke-3 masuk frame).

import { SHOT_STAGING } from './config.js';

// Buat kamera perspektif permainan.
export function createGameCamera(THREE) {
  const camera = new THREE.PerspectiveCamera(55, 16 / 9, 0.1, 900);
  camera.position.set(0, 6, 14);
  camera.lookAt(0, 1.5, 0);
  return camera;
}

// Sudut pandang tetap tiap mode shot. anchor = { player: {x, z, yaw},
// car: {x, z} } — dipakai untuk menambatkan frame ke subjek.
export function shotFraming(mode, anchor) {
  const p = anchor && anchor.player ? anchor.player : { x: 0, z: 0 };
  switch (mode) {
    case 'cover':
    case 'chase': {
      // Di belakang Kancil, memandang ke utara: 2 polisi head-on di depan.
      const c = anchor && anchor.car ? anchor.car : { x: 0, z: 44 };
      return { pos: { x: c.x, y: 5, z: c.z + 16 }, look: { x: c.x, y: 1.5, z: c.z - 26 } };
    }
    case 'foot':
    case 'play': {
      // Dari tenggara zebra, sedikit dari timur (menghindari tiang lampu
      // di (0, 6.4) yang menutupi frame): Bara di tengah, mobil biru di
      // tepi kanan, air mancur jauh di kiri.
      return { pos: { x: 5, y: 4.5, z: 8 }, look: { x: 0, y: 1.2, z: -2 } };
    }
    case 'heist': {
      // Dari utara gudang, 30 m dari Bara, lebih tinggi (11 m): Bara di
      // depan pintu hitam, 3 preman mengapit (barat, timur, tenggara
      // dekat pintu) — ketiganya di frame; dinding gudang tidak lagi
      // memenuhi layar.
      return { pos: { x: -66, y: 11, z: 64 }, look: { x: -66, y: 2, z: 100 } };
    }
    case 'vista':
    case 'end': {
      // Dari selatan pemain, memandang ke utara-timur dan sedikit ke
      // atas: Bara di bawah-tengah, piringan matahari kuning di atas.
      const v = SHOT_STAGING.vista;
      return {
        pos: { x: v.camera.x, y: v.camera.y, z: v.camera.z },
        look: { x: v.look.x, y: v.look.y, z: v.look.z },
      };
    }
    case 'start':
    default: {
      // Menu: pandang lebar kota dari tenggara.
      return { pos: { x: 34, y: 26, z: 58 }, look: { x: -10, y: 4, z: -20 } };
    }
  }
}

// Terapkan framing shot ke kamera (dipanggil tiap frame saat shot).
export function applyShotCamera(camera, mode, anchor) {
  const f = shotFraming(mode, anchor);
  camera.position.set(f.pos.x, f.pos.y, f.pos.z);
  camera.lookAt(f.look.x, f.look.y, f.look.z);
  rememberLookAt(camera, f.look);
  return f;
}

// Kamera ikuti pemain (mode permainan bebas): di belakang + di atas,
// arah pandang mengikuti yaw pemain. forward(yaw) = (-sin yaw, -cos yaw).
export function followCamera(camera, player, dt) {
  const yaw = player.yaw || 0;
  const fx = -Math.sin(yaw);
  const fz = -Math.cos(yaw);
  const dist = 9;
  const height = 4.2;
  const tx = player.x - fx * dist;
  const tz = player.z - fz * dist;
  const k = Math.min(1, dt * 5);
  camera.position.x += (tx - camera.position.x) * k;
  camera.position.y += (height - camera.position.y) * k;
  camera.position.z += (tz - camera.position.z) * k;
  camera.lookAt(player.x + fx * 6, 1.6, player.z + fz * 6);
}

// ---- Tambahan: kamera sinematik + hitung visibilitas (revisi ke-2) ----

// Apakah titik dunia (x, y, z) berada di dalam kerucut pandang kamera
// shot? Dipakai tes untuk membuktikan matahari / preman ke-3 masuk frame.
export function inShotFrame(camera, x, y, z) {
  // Vektor kamera->titik vs arah pandang kamera (sumbu -z lokal).
  const dx = x - camera.position.x;
  const dy = y - camera.position.y;
  const dz = z - camera.position.z;
  const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
  // Arah pandang: kamera menghadap target lookAt-nya (disimpan saat apply).
  const look = camera.userData.lookAt || { x: 0, y: 0, z: -1 };
  const lx = look.x - camera.position.x;
  const ly = look.y - camera.position.y;
  const lz = look.z - camera.position.z;
  const llen = Math.sqrt(lx * lx + ly * ly + lz * lz) || 1;
  const dot = (dx * lx + dy * ly + dz * lz) / (dist * llen);
  // Setengah sudut pandang horizontal ~43 derajat (fov vertikal 55,
  // aspek 16/9); ambang cos(43 deg) ~= 0,73.
  return dot > 0.73;
}

// Simpan target lookAt di kamera supaya inShotFrame bisa dipakai tes.
export function rememberLookAt(camera, look) {
  camera.userData.lookAt = { x: look.x, y: look.y, z: look.z };
}
