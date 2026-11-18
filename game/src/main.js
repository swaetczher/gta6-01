// ARUNIKA BAY — entry browser + staging shot (tulis ulang round 2).
// Alur: renderer/scene/kamera -> buildWorld -> createGameplay -> loop.
// Mode ?shot=cover|foot|heist|vista men-stage adegan, membekukan setelah
// 120 frame, lalu window.__shotReady = true untuk driver screenshot.
import * as THREE from 'three';
import { buildWorld } from './world/index.js';
import { createGameplay } from './gameplay/index.js';
import { createChaseCamera, clampCamera } from './world/camera.js';
import { findKancil } from './world/vehicles.js';
import { findConeHatPedestrian } from './world/pedestrians.js';

// ---------- input keyboard (bentuk kaya: Set + alias boolean) ----------
const input = {
  keys: new Set(),
  up: false, down: false, left: false, right: false,
  forward: false, back: false,
  w: false, a: false, s: false, d: false,
  run: false, action: false, attack: false, pause: false,
  minimapFocus: null,
  down(code) { return this.keys.has(code); },
};
function refreshInputAliases() {
  const k = input.keys;
  input.up = k.has('KeyW') || k.has('ArrowUp');
  input.down = k.has('KeyS') || k.has('ArrowDown');
  input.left = k.has('KeyA') || k.has('ArrowLeft');
  input.right = k.has('KeyD') || k.has('ArrowRight');
  input.forward = input.up;
  input.back = input.down;
  input.w = k.has('KeyW');
  input.a = k.has('KeyA');
  input.s = k.has('KeyS');
  input.d = k.has('KeyD');
  input.run = k.has('ShiftLeft') || k.has('ShiftRight');
  input.action = k.has('KeyE');
  input.attack = k.has('Space') || input.mouseAttack === true;
  input.pause = k.has('Escape') || k.has('KeyP');
}
window.addEventListener('keydown', (e) => {
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
  input.keys.add(e.code);
  refreshInputAliases();
});
window.addEventListener('keyup', (e) => {
  input.keys.delete(e.code);
  refreshInputAliases();
});
window.addEventListener('mousedown', () => { input.mouseAttack = true; refreshInputAliases(); });
window.addEventListener('mouseup', () => { input.mouseAttack = false; refreshInputAliases(); });
window.addEventListener('blur', () => { input.keys.clear(); refreshInputAliases(); });

// ---------- renderer / scene / kamera ----------
const canvasHost = document.getElementById('game-root') || document.body;
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.domElement.id = 'game-canvas';
canvasHost.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const rig = createChaseCamera(THREE, window.innerWidth / window.innerHeight);
const camera = rig.camera;
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---------- dunia + gameplay ----------
const world = buildWorld(THREE, scene);
const gameplay = createGameplay({
  THREE,
  scene,
  world,
  input,
  onEvent: (ev) => handleEvent(ev),
});
window.__game = { THREE, scene, world, gameplay, rig, input };

// ---------- helikopter polisi (mengikuti pemain) ----------
const heli = new THREE.Group();
{
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x2a4a8a, roughness: 0.5, metalness: 0.3 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.1, 4.2), bodyMat);
  body.castShadow = true;
  heli.add(body);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 3.2), bodyMat);
  tail.position.set(0, 0.2, 3.4);
  heli.add(tail);
  const glass = new THREE.Mesh(
    new THREE.BoxGeometry(1.9, 0.7, 1.2),
    new THREE.MeshStandardMaterial({ color: 0x9ac8e8, roughness: 0.15, metalness: 0.5 }),
  );
  glass.position.set(0, 0.1, -1.8);
  heli.add(glass);
  const rotorMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1e, roughness: 0.6 });
  const rotor = new THREE.Mesh(new THREE.BoxGeometry(7.5, 0.08, 0.5), rotorMat);
  rotor.position.y = 0.85;
  rotor.name = 'rotor';
  heli.add(rotor);
  const skidMat = new THREE.MeshStandardMaterial({ color: 0x333333 });
  for (const sx of [-0.8, 0.8]) {
    const skid = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 3.4), skidMat);
    skid.position.set(sx, -0.75, 0);
    heli.add(skid);
  }
  heli.visible = false;
  scene.add(heli);
}
function updateHeli(dt, playerPos, stars) {
  const rotor = heli.getObjectByName('rotor');
  if (rotor) rotor.rotation.y += dt * 22;
  const show = stars >= 3 || shotMode === 'cover' || shotMode === 'chase';
  heli.visible = show;
  if (!show || !playerPos) return;
  heli.position.set(playerPos.x, 7, playerPos.z - 45);
  heli.rotation.y = Math.sin(world.elapsed * 0.4) * 0.3;
}

// ---------- pembantu staging (defensif: dukung beberapa bentuk API) ----------
function playerObj() {
  return (gameplay && gameplay.player) || null;
}
function playerPos() {
  const p = playerObj();
  if (!p) return { x: 0, z: 0, yaw: 0 };
  if (p.position && typeof p.position.x === 'number') {
    return { x: p.position.x, z: p.position.z, yaw: p.yaw ?? p.rotation?.y ?? 0 };
  }
  if (p.mesh && p.mesh.position) {
    return { x: p.mesh.position.x, z: p.mesh.position.z, yaw: p.mesh.rotation.y || 0 };
  }
  return { x: p.x || 0, z: p.z || 0, yaw: p.yaw || 0 };
}
function setPlayerPose(x, z, yaw) {
  const p = playerObj();
  if (!p) return;
  // Jalur resmi B: setPosition. Penugasan langsung ke p.x/p.z/p.yaw
  // DILARANG — sebagian properti player hanya getter (inCar dkk.).
  if (typeof p.setPosition === 'function') {
    p.setPosition(x, z, yaw);
    return;
  }
  if (p.position && typeof p.position.set === 'function') p.position.set(x, 0, z);
  if (p.mesh && p.mesh.position) {
    p.mesh.position.set(x, 0, z);
    p.mesh.rotation.y = yaw;
  }
}
// Tulis satu field state gameplay — tahan bila field itu getter-only.
function setStateField(key, val) {
  try {
    if (gameplay && gameplay.state) gameplay.state[key] = val;
  } catch (e) {
    /* field read-only di gameplay B — HUD sudah di-set lewat hudCall */
  }
}
function setScreen(name) {
  setStateField('screen', name);
  if (gameplay && typeof gameplay.setScreen === 'function') gameplay.setScreen(name);
  const screens = gameplay && gameplay.screens;
  if (screens && typeof screens.setScreen === 'function') {
    try { screens.setScreen(name); } catch (e) { /* abaikan */ }
  }
}
function hudCall(method, ...args) {
  const hud = gameplay && gameplay.hud;
  if (hud && typeof hud[method] === 'function') hud[method](...args);
}
function setMoney(n) {
  setStateField('money', n);
  hudCall('setMoney', n);
  const el = document.getElementById('hud-money');
  if (el) el.textContent = `$${n}`;
}
function setHealth(n) {
  setStateField('health', n);
  hudCall('setHealth', n);
  const el = document.getElementById('hud-health');
  if (el) el.textContent = `❤ ${n}`;
}
function setWantedStars(stars) {
  if (gameplay && gameplay.wanted && typeof gameplay.wanted.setHeat === 'function') {
    gameplay.wanted.setHeat(stars <= 0 ? 0 : 15 + stars * 16);
  }
  setStateField('wantedStars', stars);
  hudCall('setWanted', stars);
  const el = document.getElementById('hud-wanted');
  if (el) el.textContent = stars <= 0 ? 'BERSIH' : '★'.repeat(stars) + '☆'.repeat(5 - stars);
}
function setWeapon(name, ammo, reserve) {
  if (gameplay && gameplay.combat && typeof gameplay.combat.setWeapon === 'function') {
    gameplay.combat.setWeapon(name === 'Tinju' ? 'fists' : 'pistol');
  }
  if (gameplay && gameplay.state) {
    setStateField('weapon', name);
    setStateField('ammo', ammo);
    setStateField('reserveAmmo', reserve);
  }
  hudCall('setWeapon', name, ammo, reserve);
}
function setObjective(text) {
  setStateField('objective', text);
  hudCall('setObjective', text);
  const el = document.getElementById('hud-objective');
  if (el) el.textContent = text;
}
function setDistrict(name) {
  setStateField('district', name);
  hudCall('setDistrict', name);
  const el = document.getElementById('hud-district');
  if (el) el.textContent = name;
}
function setDialog(text, sub) {
  setStateField('dialog', text);
  if (sub) setStateField('statusLine', sub);
  hudCall('setDialog', text);
  const el = document.getElementById('hud-dialog');
  if (el) el.textContent = text;
  const subEl = document.getElementById('hud-status');
  if (subEl && sub) subEl.textContent = sub;
}
function handleEvent(ev) {
  if (!ev || !ev.type) return;
  if (ev.type === 'complete' && shotMode !== 'vista' && shotMode !== 'end') {
    const banner = document.getElementById('hud-banner');
    if (banner) banner.style.display = 'block';
  }
}

// ---------- HUD staged: diterapkan ulang TIAP frame saat mode shot ----------
// gameplay.update() menulis ulang HUD dari state live tiap frame (uang,
// nyawa, objektif, distrik, dialog, senjata) — tanpa ini, nilai staging
// tertimpa dalam 1 frame. applyStagedHud() dipanggil setelah
// gameplay.update() di frame(), sebelum render, supaya frame yang
// di-screenshot selalu menampilkan nilai staging kontrak.
let stagedHud = null;
function applyStagedHud() {
  if (!stagedHud) return;
  // Nyawa asli dipulihkan dulu — preman/bos bisa melukai Bara selama shot.
  const p = playerObj();
  if (p && typeof p.healFull === 'function') p.healFull();
  setScreen('playing');
  if (typeof stagedHud.stars === 'number') setWantedStars(stagedHud.stars);
  if (typeof stagedHud.money === 'number') setMoney(stagedHud.money);
  if (typeof stagedHud.health === 'number') setHealth(stagedHud.health);
  if (stagedHud.weapon) setWeapon(stagedHud.weapon, stagedHud.ammo || 0, stagedHud.reserve || 0);
  if (stagedHud.objective) setObjective(stagedHud.objective);
  if (stagedHud.district) setDistrict(stagedHud.district);
  if (stagedHud.dialog) setDialog(stagedHud.dialog, stagedHud.sub);
  if (stagedHud.banner) hudCall('showBanner', stagedHud.banner);
  if (stagedHud.toast) hudCall('showToast', stagedHud.toast);
  if (stagedHud.banner) {
    const banner = document.getElementById('hud-banner');
    if (banner) {
      banner.textContent = stagedHud.banner;
      banner.style.display = 'block';
    }
  } else {
    const banner = document.getElementById('hud-banner');
    if (banner) banner.style.display = 'none';
  }
  if (stagedHud.toast) {
    const toast = document.getElementById('hud-toast');
    if (toast) {
      toast.textContent = stagedHud.toast;
      toast.style.display = 'block';
    }
  } else {
    const toast = document.getElementById('hud-toast');
    if (toast) toast.style.display = 'none';
  }
}

// Bekukan lalu lintas + pejalan kaki selama staging shot — mobil traffic
// yang melaju bisa lewat tepat di depan kamera dan menutup frame.
function freezeStreetLife() {
  for (const car of world.traffic || []) car.speed = 0;
  for (const ped of world.pedestrians || []) ped.speed = 0;
}

// ---------- staging shot (koordinat persis CONTRACT.md) ----------
const shotModeRaw = new URLSearchParams(location.search).get('shot');
const shotMode = shotModeRaw === 'play' ? 'foot'
  : shotModeRaw === 'chase' ? 'cover'
  : shotModeRaw === 'end' ? 'vista'
  : shotModeRaw;
let shotFrames = 0;
let shotDone = false;

function stageCover() {
  freezeStreetLife();
  const kancil = findKancil(world.vehicles);
  if (kancil) {
    kancil.x = 0;
    kancil.z = 44;
    kancil.heading = Math.PI / 2;
    kancil.speed = 94 / 3.6;
    kancil.driven = true;
    kancil.mesh.position.set(0, 0, 44);
    kancil.mesh.rotation.y = kancil.heading - Math.PI / 2;
  }
  const p = playerObj();
  if (p) {
    // Jalur resmi B: enterCar — JANGAN set p.inCar/p.car langsung
    // (properti player getter-only, menugaskan langsung melempar TypeError).
    if (typeof p.enterCar === 'function' && kancil) p.enterCar(kancil);
  }
  setPlayerPose(0, 44, 0);
  // Dua polisi head-on di depan mobil, status chase.
  const police = gameplay.police;
  if (police && typeof police.spawnOfficer === 'function') {
    // Polisi 'chase' 7,5 m/dtk menempuh ~45 m selama 120 frame staging
    // (~6 dtk game). Spawn ~50 m di utara Kancil supaya saat shot mereka
    // berakhir ~5–10 m di depannya, head-on — bukan menempel di atap
    // (spawn 30 m, shot 3) atau tak terlihat (spawn 78 m, shot 2).
    police.spawnOfficer(5, -6, 'chase');
    police.spawnOfficer(-5, -14, 'chase');
  } else if (police && typeof police.setAllState === 'function') {
    police.setAllState('chase');
  }
  // Dorong pejalan kaki yang kebetulan membeku DI ATAS Kancil (0,44)
  // 10 m ke timur — shot 1: satu pejalan kaki berdiri di atap Kancil.
  for (const ped of world.pedestrians) {
    if (Math.hypot(ped.x - 0, ped.z - 44) < 6) {
      if (ped.horizontal) ped.along = ped.x + 10;
      else ped.side = ped.side + 10;
      ped.x = ped.x + 10;
      ped.mesh.position.set(ped.x, 0, ped.z);
    }
  }
  if (gameplay.missions && typeof gameplay.missions.setCurrent === 'function') {
    gameplay.missions.setCurrent(3);
    gameplay.missions.setStep(1);
  }
  setScreen('playing');
  setWantedStars(4);
  setMoney(50);
  setHealth(100);
  setWeapon('Tinju', 0, 0);
  setObjective('M4 Pelarian Pasar Terapung (2/4)');
  setDistrict('Distrik Niaga');
  setDialog('Empat mobil polisi dan helikopter! Lewat kanal Pasar Terapung!');
  stagedHud = {
    stars: 4, money: 50, health: 100, weapon: 'Tinju', ammo: 0, reserve: 0,
    objective: 'M4 Pelarian Pasar Terapung (2/4)', district: 'Distrik Niaga',
    dialog: 'Empat mobil polisi dan helikopter! Lewat kanal Pasar Terapung!',
  };
  rig.snap(0, 44, Math.PI, 0.38, 14);
}

function stageFoot() {
  freezeStreetLife();
  // Bara di zebra utara persimpangan (0,-8): di atas garis zebra, di luar
  // baskom air mancur (r 6,6 di 0,0) supaya tidak tenggelam di dalamnya.
  setPlayerPose(0, -8, 0);
  const p = playerObj();
  if (p && typeof p.exitCar === 'function') p.exitCar();
  // Mobil biru di tepi kanan frame (cukup jauh di depan kamera supaya
  // masuk sudut pandang: kamera di (0,2), mobil di (14,-14)).
  const blue = world.vehicles.find((v) => v.label === 'Sedan biru');
  if (blue) {
    blue.x = 14;
    blue.z = -14;
    blue.heading = 0;
    blue.mesh.position.set(14, 0, -14);
    blue.mesh.rotation.y = blue.heading - Math.PI / 2;
  }
  // Pejalan kaki bertopi kerucut baju hijau di kanan zebra. Perhatian:
  // updatePedestrians menghitung ulang x/z dari field along/road/side
  // tiap frame — jadi set FIELD-nya, bukan cuma mesh.position.
  const ped = findConeHatPedestrian(world.pedestrians);
  if (ped) {
    if (ped.horizontal) {
      ped.along = 6;
      ped.road = -20;
      ped.side = 8;
    } else {
      ped.along = -12;
      ped.road = 0;
      ped.side = 6;
    }
    ped.x = 6;
    ped.z = -12;
    ped.mesh.position.set(6, 0, -12);
  }
  if (gameplay.missions && typeof gameplay.missions.setCurrent === 'function') {
    gameplay.missions.setCurrent(0);
    gameplay.missions.setStep(0);
  }
  setScreen('playing');
  setWantedStars(0);
  setMoney(50);
  setHealth(100);
  setWeapon('Tinju', 0, 0);
  setObjective('M1 Kurir Fajar (1/4): Ambil paket di Alun-Alun Arunika');
  setDistrict('Distrik Niaga');
  setDialog('Satu paket terakhir sebelum matahari terbit.', 'Jalan kaki — Bara Kelana');
  stagedHud = {
    stars: 0, money: 50, health: 100, weapon: 'Tinju', ammo: 0, reserve: 0,
    objective: 'M1 Kurir Fajar (1/4): Ambil paket di Alun-Alun Arunika',
    district: 'Distrik Niaga',
    dialog: 'Satu paket terakhir sebelum matahari terbit.',
    sub: 'Jalan kaki — Bara Kelana',
  };
  rig.snap(0, -8, Math.PI, 0.30, 10);
}

function stageHeist() {
  freezeStreetLife();
  setPlayerPose(-66, 94, Math.PI);
  const p = playerObj();
  if (p && typeof p.exitCar === 'function') p.exitCar();
  // Tiga preman menjaga gudang kontainer.
  const enemies = gameplay.enemies;
  if (enemies && typeof enemies.spawn === 'function') {
    // Preman mengejar ~2,7 m/dtk dan menempuh ~16 m selama 120 frame
    // staging. Spawn 20–25 m dari Bara supaya saat shot mereka masih
    // terlihat mendekat dari 3 arah — bukan menumpuk di atas Bara
    // (spawn 8–14 m, shot 2).
    enemies.spawn(-46, 94, { guard: true });
    enemies.spawn(-86, 94, { guard: true });
    enemies.spawn(-66, 74, { guard: true });
  }
  if (gameplay.missions && typeof gameplay.missions.setCurrent === 'function') {
    gameplay.missions.setCurrent(2);
    gameplay.missions.setStep(1);
  }
  setScreen('playing');
  setWantedStars(0);
  setMoney(50);
  setHealth(100);
  setWeapon('Pistol Rakitan', 12, 48);
  setObjective('M3 Brankas Pelabuhan (2/4): Kalahkan preman penjaga gudang (3 orang)');
  setDistrict('Dermaga Arunika');
  setDialog('Rangga menyimpan uang tebusan di brankas gudang kontainer.', 'Jalan kaki — Bara Kelana');
  stagedHud = {
    stars: 0, money: 50, health: 100, weapon: 'Pistol Rakitan', ammo: 12, reserve: 48,
    objective: 'M3 Brankas Pelabuhan (2/4): Kalahkan preman penjaga gudang (3 orang)',
    district: 'Dermaga Arunika',
    dialog: 'Rangga menyimpan uang tebusan di brankas gudang kontainer.',
    sub: 'Jalan kaki — Bara Kelana',
  };
  // Kamera 3/4 dari barat-daya: preman yang mengerubungi Bara terlihat
  // di kedua sisi, bukan menumpuk di belakangnya (kamera lurus dari utara).
  rig.snap(-66, 94, 0.5, 0.38, 18);
}

function stageVista() {
  freezeStreetLife();
  setPlayerPose(-52, -52, Math.PI * 0.25);
  const p = playerObj();
  if (p && typeof p.exitCar === 'function') p.exitCar();
  if (gameplay.missions && typeof gameplay.missions.setCurrent === 'function') {
    gameplay.missions.setCurrent(4);
    gameplay.missions.setStep(3);
  }
  setScreen('playing');
  setWantedStars(0);
  setMoney(2450);
  setHealth(100);
  setWeapon('Tinju', 0, 0);
  setObjective('Semua misi selesai — Arunika Bay bebas!');
  setDistrict('Kampung Lentera');
  setDialog('Fajar terbit di atas Arunika Bay.');
  hudCall('showBanner', 'FAJAR TERBIT — ARUNIKA BAY');
  hudCall('showToast', 'Semua misi selesai — Arunika Bay bebas!');
  stagedHud = {
    stars: 0, money: 2450, health: 100, weapon: 'Tinju', ammo: 0, reserve: 0,
    objective: 'Semua misi selesai — Arunika Bay bebas!',
    district: 'Kampung Lentera',
    dialog: 'Fajar terbit di atas Arunika Bay.',
    banner: 'FAJAR TERBIT — ARUNIKA BAY',
    toast: 'Semua misi selesai — Arunika Bay bebas!',
  };
  const banner = document.getElementById('hud-banner');
  if (banner) {
    banner.textContent = 'FAJAR TERBIT — ARUNIKA BAY';
    banner.style.display = 'block';
  }
  const toast = document.getElementById('hud-toast');
  if (toast) {
    toast.textContent = 'Semua misi selesai — Arunika Bay bebas!';
    toast.style.display = 'block';
  }
  // Kamera digeser +0,4 rad dari sumbu pemain — tiang lentera (-44,-44)
  // tepat segaris dengan kamera bila yaw 1,25π, menutup Bara.
  rig.snap(-52, -52, Math.PI * 1.25 + 0.4, 0.32, 18);
}

function stageShot(mode) {
  if (mode === 'cover' || mode === 'chase') stageCover();
  else if (mode === 'foot' || mode === 'play') stageFoot();
  else if (mode === 'heist') stageHeist();
  else if (mode === 'vista' || mode === 'end') stageVista();
  else if (mode === 'start') setScreen('start');
}

// ---------- tombol mulai (layar start normal) ----------
const startBtn = document.getElementById('start-button');
if (startBtn) {
  startBtn.addEventListener('click', () => {
    if (gameplay && typeof gameplay.start === 'function') gameplay.start();
    setScreen('playing');
    const menu = document.getElementById('menu-screen');
    if (menu) menu.style.display = 'none';
  });
}

// ---------- loop utama ----------
const clock = new THREE.Clock();
let lastPlayer = { x: 0, z: 0 };
function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.05);
  // Mode shot: layar akhir/busted TIDAK BOLEH muncul — tahan di 'playing'
  // di SETIAP frame (Bara bisa mati/tertangkap selama 120 frame staging).
  if (shotMode) {
    if (gameplay && gameplay.state && gameplay.state.screen !== 'playing') {
      setScreen('playing');
    }
  }
  if (!shotDone) {
    const pos = playerPos();
    input.minimapFocus = {
      player: pos,
      markers: [],
      police: [],
    };
    world.update(dt, input);
    if (gameplay && typeof gameplay.update === 'function') gameplay.update(dt);
    // Terapkan ulang nilai staging SETELAH gameplay.update menimpa HUD.
    if (shotMode) applyStagedHud();
    // Kamera: ikuti pemain saat bermain normal; diam saat staging shot.
    if (!shotMode) {
      const dx = pos.x - lastPlayer.x;
      const dz = pos.z - lastPlayer.z;
      if (Math.hypot(dx, dz) > 0.02) {
        const heading = Math.atan2(-dz, dx);
        rig.yaw = heading + Math.PI / 2;
      }
      rig.target.x = pos.x;
      rig.target.y = 1.2;
      rig.target.z = pos.z;
      rig.apply();
      clampCamera(rig);
    }
    lastPlayer = { x: pos.x, z: pos.z };
    const stars = (gameplay.wanted && gameplay.wanted.stars) || gameplay.state?.wantedStars || 0;
    updateHeli(dt, pos, stars);
    if (shotMode) {
      shotFrames += 1;
      if (shotFrames >= 120) {
        shotDone = true;
        window.__shotReady = true;
      }
    }
  }
  renderer.render(scene, camera);
}

// ---------- boot ----------
if (shotMode) {
  stageShot(shotMode);
} else {
  setScreen('start');
}
window.__shotReady = false;
frame();
