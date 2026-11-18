// lighting.js — Langit fajar ARUNIKA BAY.
// Matahari: bola kuning berjari-jari 120 di (0, 200, -520) — jauh di utara,
// di dalam far plane 600. Jari-jari 120 yang benar: cukup besar untuk
// terlihat sebagai piringan fajar, cukup kecil untuk tidak menelan kamera.
// (Catatan: angka lama 480 sudah tidak dipakai — itu membuat kamera berdiri
// di permukaan bola dan layar jadi dinding kuning.)

import { PALETTE, SUN_RADIUS, SUN_POSITION, SUN_HALO_RADIUS } from './config.js';

export { SUN_RADIUS, SUN_POSITION };

// Bangun pencahayaan + langit, kembalikan pegangan objek langit.
export function buildLighting(THREE, scene) {
  // Latar langit oranye fajar + kabut tipis warna cakrawala.
  scene.background = new THREE.Color(PALETTE.skyMid);
  scene.fog = new THREE.Fog(PALETTE.skyLow, 180, 560);

  // Cahaya langit menyeluruh (ungu-merah muda dari atas, tanah dari bawah).
  const hemi = new THREE.HemisphereLight(0xd98ab0, 0x4a4038, 0.95);
  scene.add(hemi);

  // Matahari arah: dari utara-timur, hangat, bayangan lembut.
  const sunLight = new THREE.DirectionalLight(0xffc27a, 1.6);
  sunLight.position.set(60, 220, -420);
  sunLight.target.position.set(0, 0, 0);
  scene.add(sunLight);
  scene.add(sunLight.target);

  // Cahaya isi dari selatan supaya sisi gelap gedung tidak hitam pekat.
  const fill = new THREE.DirectionalLight(0x8a7ab0, 0.35);
  fill.position.set(-40, 120, 300);
  scene.add(fill);

  // Piringan matahari: bola kuning polos (basic = tidak kena shading).
  const sunGeo = new THREE.SphereGeometry(SUN_RADIUS, 24, 18);
  const sunMat = new THREE.MeshBasicMaterial({ color: PALETTE.sun });
  const sun = new THREE.Mesh(sunGeo, sunMat);
  sun.position.set(SUN_POSITION.x, SUN_POSITION.y, SUN_POSITION.z);
  scene.add(sun);

  // Halo: bola lebih besar, transparan, memberi glow fajar.
  const haloGeo = new THREE.SphereGeometry(SUN_HALO_RADIUS, 24, 18);
  const haloMat = new THREE.MeshBasicMaterial({
    color: PALETTE.sunHalo,
    transparent: true,
    opacity: 0.28,
  });
  const halo = new THREE.Mesh(haloGeo, haloMat);
  halo.position.set(SUN_POSITION.x, SUN_POSITION.y, SUN_POSITION.z);
  scene.add(halo);

  return { hemi, sunLight, fill, sun, halo };
}

// ---- Tambahan: lampu jalan menyala (revisi ke-2) ----

// Lampu jalan: tiang + bola pijar oranye. Dipanggil city.js untuk tiap
// titik lampu di tepi jalan; bola memakai material basic supaya menyala
// di langit fajar tanpa butuh sumber cahaya tambahan.
export function makeStreetLamp(THREE, x, z) {
  const group = new THREE.Group();
  const poleGeo = new THREE.CylinderGeometry(0.09, 0.12, 5.2, 8);
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x2e2e34 });
  const pole = new THREE.Mesh(poleGeo, poleMat);
  pole.position.y = 2.6;
  group.add(pole);
  const armGeo = new THREE.BoxGeometry(1.4, 0.1, 0.1);
  const arm = new THREE.Mesh(armGeo, poleMat);
  arm.position.set(0.6, 5.1, 0);
  group.add(arm);
  const bulbGeo = new THREE.SphereGeometry(0.32, 12, 10);
  const bulbMat = new THREE.MeshBasicMaterial({ color: PALETTE.lampGlow });
  const bulb = new THREE.Mesh(bulbGeo, bulbMat);
  bulb.position.set(1.3, 4.95, 0);
  group.add(bulb);
  group.position.set(x, 0, z);
  return group;
}

// Cahaya senja tambahan untuk area dermaga (dipakai main.js saat staging
// heist supaya gudang tidak gelap dari sisi kamera selatan).
export function dockLight(THREE, scene, x, z) {
  const lamp = new THREE.PointLight(0xffc46b, 30, 40, 1.6);
  lamp.position.set(x, 6, z);
  scene.add(lamp);
  return lamp;
}
