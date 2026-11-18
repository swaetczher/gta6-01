// lighting.js — Pencahayaan fajar ARUNIKA BAY.
// Matahari rendah dari timur (oranye), langit gradien oranye-merah muda,
// kabut tipis pelabuhan, lampu kota masih menyala.
// Aturan skill author-game-levels: tiap lampu lokal TERIKAT ke emitter
// yang terlihat — inventaris sumber-ke-cahaya ada di `lightInventory`.
// Cahaya ambient/global didokumentasi terpisah (bukan lampu torob).

import { PALETTE, WORLD_HALF } from './config.js';

// Langit fajar: kubah shader gradien (ungu-mawar atas → oranye → merah
// muda di horizon) + piringan matahari. Tanpa texture eksternal.
// REPAIR-4: radius kubah 480 m (di dalam far plane kamera 600 m — radius
// 900 m sebelumnya terpotong frustum sehingga langit tampil HITAM) dan
// scene.background oranye sebagai pengaman bila kubah gagal dirender.
export function buildSky(THREE, scene) {
  scene.background = new THREE.Color(PALETTE.skyMid);
  const skyGeo = new THREE.SphereGeometry(480, 24, 16);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      topColor: { value: new THREE.Color(PALETTE.skyTop) },
      midColor: { value: new THREE.Color(PALETTE.skyMid) },
      lowColor: { value: new THREE.Color(PALETTE.skyLow) },
    },
    vertexShader: `
      varying vec3 vWorldPosition;
      void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 topColor;
      uniform vec3 midColor;
      uniform vec3 lowColor;
      varying vec3 vWorldPosition;
      void main() {
        float h = normalize(vWorldPosition).y;
        vec3 col = h > 0.25
          ? mix(midColor, topColor, smoothstep(0.25, 0.75, h))
          : mix(lowColor, midColor, smoothstep(-0.05, 0.25, h));
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  const sky = new THREE.Mesh(skyGeo, skyMat);
  sky.name = 'DawnSky';
  scene.add(sky);

  // Piringan matahari fajar di timur (x positif), rendah di horizon.
  // REPAIR-4: posisi ditarik ke dalam far plane kamera (dulu 620 m).
  const sunDisc = new THREE.Mesh(
    new THREE.CircleGeometry(34, 32),
    new THREE.MeshBasicMaterial({ color: PALETTE.sun, fog: false }),
  );
  sunDisc.position.set(430, 80, -60);
  sunDisc.lookAt(0, 40, 0);
  sunDisc.name = 'DawnSunDisc';
  scene.add(sunDisc);

  // Awan fajar: beberapa bidang tipis tembus pandang warna merah muda.
  const cloudMat = new THREE.MeshBasicMaterial({
    color: 0xffc2a8, transparent: true, opacity: 0.5, fog: false,
  });
  const clouds = [];
  // REPAIR-4: semua awan di dalam far plane kamera (dulu ada yang 530 m).
  const spots = [[-260, 200, -220, 220], [130, 230, 260, 160], [300, 180, -300, 280], [-70, 240, 330, 200]];
  for (const [x, y, z, w] of spots) {
    const cloud = new THREE.Mesh(new THREE.PlaneGeometry(w, w * 0.22), cloudMat);
    cloud.position.set(x, y, z);
    cloud.lookAt(0, y * 0.4, 0);
    scene.add(cloud);
    clouds.push(cloud);
  }
  return { sky, sunDisc, clouds };
}

// Geser waktu fajar (0 = sebelum terbit, 1 = matahari penuh).
// Dipakai mode sinematik / shot vista: menaikkan matahari + memudarkan
// kabut supaya ending M5 ("fajar terbit") terbaca di layar.
export function setTimeOfDay(lighting, t) {
  const k = Math.max(0, Math.min(1, t));
  lighting.sun.position.set(180, 40 + k * 90, -40);
  lighting.sun.intensity = 1.8 + k * 1.2;
  lighting.hemi.intensity = 0.7 + k * 0.4;
  if (lighting.fog) {
    lighting.fog.near = 90 + k * 60;
    lighting.fog.far = 420 + k * 180;
  }
  return lighting;
}

// Cahaya global fajar + kabut tipis pelabuhan. Mengembalikan objek lampu
// supaya Gameplay/main bisa mengubah intensitas saat waktu berjalan.
export function buildLighting(THREE, scene) {
  // Kabut tipis: oranye pucat, mulai 90 m — pelabuhan berkabut, kota jelas.
  scene.fog = new THREE.Fog(PALETTE.fog, 90, 420);

  // Matahari fajar: directional rendah dari timur, bayangan panjang.
  const sun = new THREE.DirectionalLight(0xffb37a, 2.4);
  sun.position.set(180, 70, -40);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -WORLD_HALF - 20;
  sun.shadow.camera.right = WORLD_HALF + 20;
  sun.shadow.camera.top = WORLD_HALF + 20;
  sun.shadow.camera.bottom = -WORLD_HALF - 20;
  sun.shadow.camera.far = 500;
  sun.shadow.bias = -0.0004;
  scene.add(sun);
  scene.add(sun.target);

  // Langit memantul: hemisphere oranye-merah muda (atas) / tanah (bawah).
  const hemi = new THREE.HemisphereLight(0xffc2a0, 0x5a4a3a, 0.85);
  scene.add(hemi);

  // Cahaya ambient kecil supaya sisi gelap gedung tetap terbaca di screenshot.
  const ambient = new THREE.AmbientLight(0xffd9c0, 0.35);
  scene.add(ambient);

  return { sun, hemi, ambient, fog: scene.fog };
}

// Lampu jalan yang benar-benar menyala (point light) — HANYA 6 titik,
// di persimpangan pusat, supaya biaya render tetap rendah. Sisanya lampu
// jalan memakai material emissive (terlihat menyala tanpa lampu nyata).
// Inventaris sumber-ke-cahaya: tiap point light terikat ke tiang lampu
// yang dibangun city.js di koordinat yang sama.
export function buildStreetLights(THREE, scene, lamps) {
  const lights = [];
  const lightInventory = [];
  // Ambil 6 lampu di dekat persimpangan pusat (0,0), (0,44), (44,0), (44,44).
  const picked = lamps.filter((l) => Math.abs(l.x) <= 52 && Math.abs(l.z) <= 52).slice(0, 6);
  for (const lamp of picked) {
    const point = new THREE.PointLight(0xffb347, 60, 26, 1.8);
    point.position.set(lamp.x, lamp.y, lamp.z);
    scene.add(point);
    lights.push(point);
    lightInventory.push({
      emitterId: lamp.id,
      lightId: `point-${lamp.id}`,
      position: { x: lamp.x, y: lamp.y, z: lamp.z },
      type: 'PointLight',
      color: 0xffb347,
      range: 26,
      enabled: true,
      fallback: 'material emissive pada kepala lampu tetap menyala',
    });
  }
  return { lights, lightInventory };
}

// Lampu mercusuar: sorot berputar lambat (beam mesh diputar di update).
// Emitter-nya terlihat (ruang lampu + beacon) — bukan cahaya mengambang.
export function buildLighthouseLight(THREE, scene) {
  const beam = new THREE.PointLight(0xffe27a, 80, 60, 1.6);
  beam.position.set(-66, 27.2, -66);
  scene.add(beam);
  return {
    beam,
    inventory: {
      emitterId: 'mercusuar',
      lightId: 'point-mercusuar',
      position: { x: -66, y: 27.2, z: -66 },
      type: 'PointLight',
      color: 0xffe27a,
      range: 60,
      enabled: true,
      fallback: 'beacon emissive tetap menyala bila point light dimatikan',
    },
  };
}
