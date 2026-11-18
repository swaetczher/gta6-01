// main.js — Entry browser ARUNIKA BAY: renderer + loop + staging shot.
// Membaca mode dari ?shot=: start | play/foot | cover/chase | heist |
// end/vista. Tanpa ?shot=, game berjalan normal (mode permainan bebas).
// window.__shotReady = true HANYA setelah 120 frame staging selesai.

import * as THREE from 'three';
import { buildWorld } from './world/index.js';
import { createGameplay } from './gameplay/index.js';
import { createGameCamera, applyShotCamera, followCamera } from './world/camera.js';
import { findKancil, placeVehicle, recolorCar } from './world/vehicles.js';
import { trafficCarAt, parkTrafficCar } from './world/traffic.js';
import { placeHeroPedestrian } from './world/pedestrians.js';
import { SHOT_STAGING, PALETTE } from './world/config.js';

const params = new URLSearchParams(location.search);
const shotMode = params.get('shot') || '';
const SHOT_MODES = ['start', 'play', 'foot', 'cover', 'chase', 'heist', 'end', 'vista'];
const isShot = SHOT_MODES.includes(shotMode);

// ---- Renderer + scene + kamera ----
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(1);
renderer.setSize(window.innerWidth, window.innerHeight);
document.getElementById('app').appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = createGameCamera(THREE);

// ---- Dunia + gameplay ----
const world = buildWorld(THREE, scene);
const input = {
  keys: {},
  up: false, down: false, left: false, right: false,
  forward: false, back: false,
  w: false, a: false, s: false, d: false,
  run: false, action: false, attack: false, pause: false,
};
const gameplay = createGameplay({
  THREE,
  scene,
  world,
  input,
  onEvent: (ev) => {
    if (ev && ev.type) window.__lastEvent = ev.type;
  },
});

// ---- Input keyboard (mode permainan bebas) ----
const KEYMAP = {
  KeyW: 'up', ArrowUp: 'up',
  KeyS: 'down', ArrowDown: 'down',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
  ShiftLeft: 'run', ShiftRight: 'run',
  KeyE: 'action',
  Space: 'attack',
  Escape: 'pause', KeyP: 'pause',
};
window.addEventListener('keydown', (e) => {
  input.keys[e.code] = true;
  const field = KEYMAP[e.code];
  if (field) input[field] = true;
  if (e.code === 'Space') e.preventDefault();
});
window.addEventListener('keyup', (e) => {
  input.keys[e.code] = false;
  const field = KEYMAP[e.code];
  if (field) input[field] = false;
});

// ---- Helikopter polisi: mengikuti pemain dari utara ----
const heli = new THREE.Group();
{
  const bodyMat = new THREE.MeshStandardMaterial({ color: PALETTE.policeBlue });
  const body = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.1, 1.6), bodyMat);
  heli.add(body);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.4, 0.4), bodyMat);
  tail.position.set(-2.8, 0.2, 0);
  heli.add(tail);
  const skidMat = new THREE.MeshStandardMaterial({ color: 0x1c1c22 });
  for (const s of [-0.7, 0.7]) {
    const skid = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.12, 0.12), skidMat);
    skid.position.set(0, -0.8, s);
    heli.add(skid);
  }
  const glass = new THREE.Mesh(
    new THREE.BoxGeometry(1.0, 0.7, 1.4),
    new THREE.MeshStandardMaterial({ color: 0x9fd8e8 }),
  );
  glass.position.set(1.6, 0.1, 0);
  heli.add(glass);
}
const rotor = new THREE.Group();
{
  const bladeMat = new THREE.MeshStandardMaterial({ color: 0x1c1c22 });
  for (const angle of [0, Math.PI / 2]) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(7.5, 0.08, 0.35), bladeMat);
    blade.rotation.y = angle;
    rotor.add(blade);
  }
  rotor.position.y = 0.75;
  heli.add(rotor);
}
heli.visible = false;
scene.add(heli);

// ---- Tubuh Bara Kelana (gameplay tidak membuat mesh pemain) ----
// Sosok oranye: badan + kepala + kaki + bandana, disinkron tiap frame
// dari gameplay.player (x, z, yaw). Disembunyikan saat Bara di mobil.
const playerMesh = new THREE.Group();
{
  const jacket = new THREE.MeshStandardMaterial({ color: PALETTE.baraOrange });
  const skin = new THREE.MeshStandardMaterial({ color: 0xd8a878 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x2e2e34 });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.55, 1.0, 0.32), jacket);
  torso.position.y = 0.95;
  playerMesh.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 10), skin);
  head.position.y = 1.68;
  playerMesh.add(head);
  const legs = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.5, 0.28), dark);
  legs.position.y = 0.25;
  playerMesh.add(legs);
  const band = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.14, 0.5),
    new THREE.MeshStandardMaterial({ color: 0xc85a10 }),
  );
  band.position.y = 1.86;
  playerMesh.add(band);
}
scene.add(playerMesh);

function syncPlayerMesh() {
  const p = gameplay.player;
  if (!p) return;
  playerMesh.visible = !p.inCar;
  if (p.inCar) return;
  playerMesh.position.set(p.x, 0, p.z);
  playerMesh.rotation.y = p.yaw || 0;
}

function updateHeli(dt) {
  const p = gameplay.player;
  if (!p) return;
  heli.visible = true;
  heli.position.set(p.x, 7, p.z - 45);
  heli.rotation.y = (p.yaw || 0) + Math.PI / 2;
  rotor.rotation.y += dt * 22;
}

// ---- Staging shot: susun adegan persis kontrak ----

// Nilai HUD tiap mode — diterapkan ULANG tiap frame (stagedHud) supaya
// simulasi gameplay tidak menimpanya selama 120 frame staging.
const STAGED_HUD = {
  cover: {
    wanted: 4, money: 50, health: 100, weapon: ['Tinju', 0, 0],
    objective: 'M4 Pelarian Pasar Terapung (2/4)',
    district: 'Distrik Niaga',
    dialog: 'Empat mobil polisi dan helikopter! Lewat kanal Pasar Terapung!',
  },
  foot: {
    wanted: 0, money: 50, health: 100, weapon: ['Jalan kaki — Bara Kelana', 0, 0],
    objective: 'M1 Kurir Fajar (1/4): Ambil paket di Alun-Alun Arunika',
    district: 'Alun-Alun Arunika',
    dialog: 'Satu paket terakhir sebelum matahari terbit.',
  },
  heist: {
    wanted: 2, money: 50, health: 100, weapon: ['Pistol Rakitan', 12, 48],
    objective: 'M3 Brankas Pelabuhan (2/4): Kalahkan preman penjaga gudang (3 orang)',
    district: 'Dermaga Arunika',
    dialog: 'Rangga menyimpan uang tebusan di brankas gudang kontainer.',
  },
  vista: {
    wanted: 0, money: 2450, health: 100, weapon: ['Tinju', 0, 0],
    objective: 'M5 Fajar Terakhir (4/4)',
    district: 'Kampung Lentera',
    dialog: 'Fajar terbit di atas Arunika Bay.',
    banner: 'FAJAR TERBIT — ARUNIKA BAY',
    toast: 'Semua misi selesai — Arunika Bay bebas!',
  },
};

function applyStagedHud(mode) {
  const h = STAGED_HUD[mode];
  if (!h) return;
  const hud = gameplay.hud;
  if (!hud) return;
  if (h.wanted !== undefined && hud.setWanted) hud.setWanted(h.wanted);
  if (hud.setMoney) hud.setMoney(h.money);
  if (hud.setHealth) hud.setHealth(h.health);
  if (hud.setWeapon) hud.setWeapon(h.weapon[0], h.weapon[1], h.weapon[2]);
  if (hud.setObjective) hud.setObjective(h.objective);
  if (hud.setDistrict) hud.setDistrict(h.district);
  if (hud.setDialog) hud.setDialog(h.dialog);
  if (h.banner && hud.showBanner) hud.showBanner(h.banner);
  if (h.toast && hud.showToast) hud.showToast(h.toast);
}

function spawnGuard(x, z) {
  const e = gameplay.enemies;
  if (!e) return;
  // spawn() dulu (posisi PERSIS): spawnGuards menaruh preman di lingkaran
  // radius 6 dari titik yang diberi, jadi bukan posisi yang dimaksud.
  if (typeof e.spawn === 'function') e.spawn(x, z, {});
  else if (typeof e.spawnGuards === 'function') e.spawnGuards(x, z, 1);
}

function stageShot(mode) {
  const g = gameplay;
  world.setFrozen(true); // freezeStreetLife: lalu lintas + pejalan diam
  // Staging = mode permainan, bukan menu awal: paksa layar 'playing' dan
  // sembunyikan menu supaya adegan + HUD terlihat penuh di screenshot.
  g.state.screen = 'playing';
  const menu = document.getElementById('menu-screen');
  if (menu) menu.style.display = 'none';
  if (mode === 'cover' || mode === 'chase') {
    const s = SHOT_STAGING.cover;
    const kancil = findKancil(world.vehicles);
    placeVehicle(kancil, s.car.x, s.car.z, s.car.heading);
    kancil.speed = s.car.speedKmh / 3.6;
    kancil.driven = true;
    g.player.enterCar(kancil);
    // Spawn kalibrasi: polisi chase dari ~50 m supaya setelah 120 frame
    // keduanya berhenti head-on beberapa meter di depan Kancil.
    for (const p of s.police) g.police.spawnOfficer(p.x, p.z, 'chase');
    g.wanted.setHeat(80);
    g.missions.setCurrent(3);
    g.missions.setStep(1);
    g.combat.setWeapon('fists');
  } else if (mode === 'foot' || mode === 'play') {
    const s = SHOT_STAGING.foot;
    g.player.setPosition(s.player.x, s.player.z, s.player.yaw);
    g.combat.setWeapon('fists');
    g.missions.setCurrent(0);
    g.missions.setStep(0);
    g.wanted.setHeat(0);
    // Pejalan hero topi kerucut baju hijau di kanan Bara.
    placeHeroPedestrian(world.pedestriansApi, s.heroPed.x, s.heroPed.z, -Math.PI / 2);
    // Mobil biru di tepi kanan frame.
    const blue = trafficCarAt(world.trafficApi, 0);
    recolorCar(blue, PALETTE.policeBlue);
    parkTrafficCar(blue, s.blueCar.x, s.blueCar.z, Math.PI / 2);
  } else if (mode === 'heist') {
    const s = SHOT_STAGING.heist;
    g.player.setPosition(s.player.x, s.player.z, s.player.yaw);
    g.combat.setWeapon('pistol');
    g.missions.setCurrent(2);
    g.missions.setStep(1);
    // 3 preman: barat, timur, tenggara dekat pintu — ketiganya di frame.
    for (const guard of s.guards) spawnGuard(guard.x, guard.z);
  } else if (mode === 'vista' || mode === 'end') {
    const s = SHOT_STAGING.vista;
    g.player.setPosition(s.player.x, s.player.z, s.player.yaw);
    g.missions.setCurrent(4);
    g.missions.setStep(3);
  }
  applyStagedHud(mode);
  return true;
}

// ---- Loop utama ----
let shotFrames = 0;
let shotDone = false;
window.__shotReady = false;
const clock = new THREE.Clock();
const shotKey = isShot ? (shotMode === 'chase' ? 'cover' : shotMode === 'play' ? 'foot' : shotMode === 'end' ? 'vista' : shotMode) : '';

if (isShot) stageShot(shotMode);

function clearInput() {
  for (const k of Object.keys(input)) {
    if (k === 'keys') input.keys = {};
    else input[k] = false;
  }
}

function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.05);
  if (isShot) clearInput(); // staging: pemain tidak bergerak sendiri
  gameplay.update(dt);
  world.update(dt, input);
  updateHeli(dt);
  syncPlayerMesh();
  if (isShot) {
    applyStagedHud(shotKey);
    applyShotCamera(camera, shotMode, {
      player: { x: gameplay.player.x, z: gameplay.player.z, yaw: gameplay.player.yaw },
      car: gameplay.player.car ? { x: gameplay.player.car.x, z: gameplay.player.car.z } : { x: 0, z: 44 },
    });
    // Penahan layar: selama staging, layar tetap 'playing' dan menu awal
    // tetap tersembunyi (gameplay bisa mengubah screen tiap update).
    // Vista TIDAK BOLEH menampilkan layar complete.
    gameplay.state.screen = 'playing';
    const menuEl = document.getElementById('menu-screen');
    if (menuEl && menuEl.style.display !== 'none') menuEl.style.display = 'none';
    if (!shotDone) {
      shotFrames++;
      if (shotFrames >= 120) {
        shotDone = true;
        window.__shotReady = true;
      }
    }
  } else {
    followCamera(camera, gameplay.player, dt);
  }
  // Minimap digambar oleh gameplay.update (dengan data pemain/polisi/
  // musuh yang benar) — main.js tidak memanggil drawMinimap sendiri
  // supaya tidak menimpa gambar itu dengan pusat (0,0).
  renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

frame();
