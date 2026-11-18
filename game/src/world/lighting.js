// ARUNIKA BAY — cahaya fajar + langit + matahari (tulis ulang round 2).
// Langit oranye (PALETTE.skyMid), matahari bola r=480 di dalam far plane 600,
// matahari terbit rendah di timur sehingga bayangan memanjang ke barat.
import { PALETTE } from './config.js';

export function buildLighting(THREE, scene) {
  scene.background = new THREE.Color(PALETTE.skyMid);
  scene.fog = new THREE.Fog(PALETTE.skyHorizon, 180, 520);

  // Cahaya langit: ungu-mawar dari atas, oranye hangat dari cakrawala.
  const hemi = new THREE.HemisphereLight(PALETTE.skyTop, PALETTE.skyHorizon, 0.85);
  hemi.position.set(0, 120, 0);
  scene.add(hemi);

  // Matahari fajar: directional dari utara (searah piringan), hangat.
  const sun = new THREE.DirectionalLight(PALETTE.sun, 2.1);
  sun.position.set(0, 140, -260);
  sun.target.position.set(0, 0, 0);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -140;
  sun.shadow.camera.right = 140;
  sun.shadow.camera.top = 140;
  sun.shadow.camera.bottom = -140;
  sun.shadow.camera.near = 10;
  sun.shadow.camera.far = 480;
  sun.shadow.bias = -0.0004;
  scene.add(sun);
  scene.add(sun.target);

  // Piringan matahari: bola kuning di cakrawala utara, jauh dari kamera.
  // (r=480 membuat kamera berdiri DI permukaan bola — dinding kuning di
  // tiap shot; r=120 memberi piringan fajar yang terbaca sebagai matahari.)
  const sunMesh = new THREE.Mesh(
    new THREE.SphereGeometry(SUN_RADIUS, 24, 16),
    new THREE.MeshBasicMaterial({ color: PALETTE.sun, fog: false }),
  );
  sunMesh.position.set(SUN_POSITION.x, SUN_POSITION.y, SUN_POSITION.z);
  scene.add(sunMesh);

  // Cahaya isi lembut supaya sisi gelap gedung tetap terbaca.
  const fill = new THREE.AmbientLight(0xffc890, 0.35);
  scene.add(fill);

  return { hemi, sun, sunMesh, fill };
}

// Posisi piringan matahari — dipakai tes dunia + staging vista.
export const SUN_POSITION = { x: 0, y: 200, z: -520 };
export const SUN_RADIUS = 120;

// Lampu jalan: SENGAJA tanpa PointLight nyata — 25 lampu titik akan
// membuat renderer software (swiftshader) merangkak; bola lampu emissive
// di city.js sudah memberi kesan menyala. Fungsi dipertahankan sebagai
// no-op supaya pemanggil city.js tidak perlu diubah.
export function addLampLight(THREE, scene, x, z, height = 5.2) {
  return null;
}

// Perbarui cahaya seiring waktu permainan (fajar merambat naik perlahan).
// dt detik sejak frame terakhir; t total detik sejak game dimulai.
export function updateLighting(lighting, dt, t) {
  if (!lighting || !lighting.sunMesh) return;
  const lift = Math.min(1, t / 240) * 24;
  lighting.sunMesh.position.y = SUN_POSITION.y + lift;
  lighting.sun.position.y = 140 + lift * 0.4;
}
