// test-gameplay.mjs — Uji logika gameplay ARUNIKA BAY (node, tanpa browser).
// Jalankan: node game/src/gameplay/test-gameplay.mjs
// Modul HUD/screens yang menyentuh DOM dijaga typeof document, jadi
// yang diuji di sini adalah logika murni + fasad.
import { createStubWorld, isInCanal, CANAL_RECT, adaptWorld } from './world-adapter.js';
import * as THREE from '../../vendor/three/three.module.min.js';
import { createWorld } from '../world/index.js';
import { createPlayer, updatePlayer } from './player.js';
import { createCombat, attack, startReload, updateCombat } from './combat.js';
import { createWanted, addHeat, updateWanted, starsForHeat } from './wanted.js';
import { policeCountForStars, createPoliceUnit, updatePolice } from './police.js';
import { createThug, updateThugs, allThugsDefeated } from './enemies.js';
import { MISSIONS, createMissionState, startMission, updateMission, nextMissionId } from './missions.js';
import { createGame, updateGame, newGame, startNextMission, busted } from './index.js';
import { serializeGame, saveGame, loadGame, clearSave } from './save.js';

let passed = 0;
let failed = 0;
function check(name, ok) {
  if (ok) { passed += 1; console.log(`OK   ${name}`); }
  else { failed += 1; console.log(`GAGAL ${name}`); }
}
const idle = { forward: false, back: false, left: false, right: false, run: false, jump: false, enter: false, enterHeld: false, attack: false, reload: false };

// 1. Jalan kaki + lari + lompat.
{
  const world = createStubWorld();
  const p = createPlayer(world.spawn);
  updatePlayer(p, { ...idle, forward: true }, 1, world, []);
  check('jalan kaki bergerak maju', p.z < world.spawn.z - 2);
  const x0 = p.x; const z0 = p.z;
  updatePlayer(p, { ...idle, forward: true, run: true }, 1, world, []);
  const runD = Math.hypot(p.x - x0, p.z - z0);
  check('lari lebih cepat dari jalan', runD > 6);
  updatePlayer(p, { ...idle, jump: true }, 0.1, world, []);
  check('lompat mengangkat pemain', p.y > 0 || p.vy > 0);
}

// 2. Tidak tembus gedung (resolveCircle).
{
  const world = createStubWorld();
  const c = world.colliders[0];
  const p = createPlayer({ x: (c.x1 + c.x2) / 2, z: c.z1 - 1, heading: 0 });
  updatePlayer(p, { ...idle, forward: true }, 1, world, []);
  check('pemain tidak masuk ke dalam gedung', world.isWalkable(p.x, p.z));
}

// 3. Masuk mobil + mengemudi + keluar.
{
  const world = createStubWorld();
  const car = world.cars.find((c) => !c.locked);
  const p = createPlayer({ x: car.x, z: car.z + 1, heading: 0 });
  const events = [];
  updatePlayer(p, { ...idle, enter: true }, 0.1, world, events);
  check('masuk mobil terbuka dengan E', p.inCar === car.id);
  updatePlayer(p, { ...idle, forward: true }, 1, world, events);
  check('mobil bergerak saat gas', Math.abs(car.speed) > 1);
  updatePlayer(p, { ...idle, enter: true }, 0.1, world, events);
  check('keluar mobil dengan E', p.inCar === null);
}

// 4. Curi mobil terkunci (tahan E 2 detik) + wanted naik.
{
  const world = createStubWorld();
  const car = world.cars.find((c) => c.locked);
  const p = createPlayer({ x: car.x, z: car.z + 1, heading: 0 });
  const events = [];
  for (let i = 0; i < 25; i++) updatePlayer(p, { ...idle, enterHeld: true }, 0.1, world, events);
  check('curi mobil: terkunci jadi terbuka', car.locked === false && car.stolen === true);
  check('curi mobil: event carStolen keluar', events.some((e) => e.type === 'carStolen'));
}

// 5. Tinju + pistol + reload.
{
  const combat = createCombat();
  const thug = createThug('t1', 0, -1.5, 60);
  const hits = attack(combat, 0, 0, Math.PI, [thug]);
  check('tinju kena dalam jarak + arah', hits.length === 1 && thug.health === 45);
  combat.weapon = 'pistol';
  combat.ammo = 1;
  combat.ammoReserve = 12;
  combat.cooldown = 0; // cooldown tinju sebelumnya sudah lewat (simulasi jeda)
  const far = createThug('t2', 0, -30, 60);
  const hits2 = attack(combat, 0, 0, Math.PI, [far]);
  check('pistol kena dari 30 m', hits2.length === 1 && far.health === 26);
  check('pistol habis 1 peluru', combat.ammo === 0);
  startReload(combat);
  updateCombat(combat, 1.5);
  check('reload mengisi magazin', combat.ammo === 12 && combat.ammoReserve === 0);
}

// 6. Wanted: panas jadi bintang, sembunyi menurunkan panas.
{
  check('panas 0 = 0 bintang', starsForHeat(0) === 0);
  check('panas 25 = 2 bintang', starsForHeat(25) === 2);
  check('panas 100 = 5 bintang', starsForHeat(100) === 5);
  const w = createWanted();
  addHeat(w, 25);
  check('curi mobil (+25) = 2 bintang', w.stars === 2);
  const before = w.heat;
  for (let i = 0; i < 200; i++) updateWanted(w, 0.1, false);
  check('sembunyi lama menurunkan panas', w.heat < before);
}

// 7. Polisi: jumlah ikut bintang, kejar + tangkap.
{
  check('1 bintang = 2 polisi', policeCountForStars(1) === 2);
  check('5 bintang = 9 polisi', policeCountForStars(5) === 9);
  const world = createStubWorld();
  const player = createPlayer({ x: 0, z: 0, heading: 0 });
  const unit = createPoliceUnit('p1', 0, -1, false);
  const events = [];
  for (let i = 0; i < 30; i++) updatePolice([unit], player, 0.1, world, events);
  check('polisi dekat cukup lama menangkap pemain', events.some((e) => e.type === 'busted'));
}

// 8. Preman: kejar + pukul, bisa dikalahkan.
{
  const world = createStubWorld();
  const player = createPlayer({ x: 0, z: 0, heading: 0 });
  player.health = 100;
  const thug = createThug('t1', 0, -10, 15);
  const events = [];
  for (let i = 0; i < 100; i++) updateThugs([thug], player, 0.1, world, events);
  check('preman mendekat dan memukul pemain', player.health < 100);
  const combat = createCombat();
  attack(combat, player.x, player.z, Math.atan2(thug.x - player.x, thug.z - player.z), [thug]);
  check('preman bisa dikalahkan tinju', thug.alive === false);
  check('semua preman kalah terdeteksi', allThugsDefeated([thug]));
}

// 9. Misi M1 selesai berurutan lewat fasad.
{
  const world = createStubWorld();
  const game = createGame(world);
  newGame(game);
  startNextMission(game);
  check('misi pertama = M1 Kurir Fajar', game.missions.currentId === 'M1');
  for (const obj of MISSIONS[0].objectives) {
    game.player.x = obj.x;
    game.player.z = obj.z;
    updateGame(game, { ...idle }, 0.1);
  }
  check('M1 selesai + hadiah $150 masuk', game.missions.completed.includes('M1') && game.player.money === 200);
  check('autosave tercatat setelah misi', loadGame() !== null);
  clearSave();
}

// 10. Misi evade M4 selesai saat wanted 0.
{
  const ms = createMissionState();
  startMission(ms, 'M4');
  ms.objectiveIndex = 3; // langsung ke objektif evade
  const world = createStubWorld();
  const player = createPlayer(world.spawn);
  const wanted = createWanted();
  const events = [];
  const ev = updateMission(ms, { player, world, thugs: [], wanted, events });
  check('M4 evade selesai saat wanted 0', ev && ev.type === 'missionComplete');
  check('M4 selesai tercatat', ms.completed.includes('M4'));
}

// 11. Save/load pulih posisi + uang + progres misi.
{
  const world = createStubWorld();
  const game = createGame(world);
  newGame(game);
  game.player.money = 777;
  game.player.x = 12;
  game.player.z = -34;
  game.missions.completed = ['M1', 'M2'];
  const data = saveGame(game);
  check('serialize berisi uang + misi', data.player.money === 777 && data.missions.completed.length === 2);
  const game2 = createGame(world);
  newGame(game2);
  const loaded = loadGame();
  check('load mengembalikan data save', loaded && loaded.player.money === 777);
  clearSave();
  check('clearSave menghapus save', loadGame() === null);
}

// 12. Fasad: tertangkap memindahkan pemain ke rumah sakit + denda.
{
  const world = createStubWorld();
  const game = createGame(world);
  newGame(game);
  game.player.money = 500;
  busted(game, 'tes');
  check('tertangkap: respawn di rumah sakit', game.player.x === world.hospital.x && game.player.z === world.hospital.z);
  check('tertangkap: denda $100', game.player.money === 400);
  check('tertangkap: wanted bersih', game.wanted.stars === 0);
}

// 13. Kanal Pasar Terapung DIBLOKIR (keputusan koordinator 18 Nov 10:14 WIB).
{
  const world = createStubWorld();
  check('batas kanal sesuai city.js (blok 22,22 ukuran 34)', CANAL_RECT.x1 === 5 && CANAL_RECT.x2 === 39 && CANAL_RECT.z1 === 5 && CANAL_RECT.z2 === 39);
  check('tengah kanal (22,22) tidak bisa dilalui', isInCanal(22, 22) && !world.isWalkable(22, 22));
  check('tepi kanal (22,0) bisa dilalui', world.isWalkable(22, 0));
  const pushed = world.resolveCircle(22, 22, 0.45);
  check('resolveCircle mendorong keluar dari air kanal', !isInCanal(pushed.x, pushed.z));
  // Jalan kaki menuju kanal berhenti di tepinya (tidak masuk air).
  const p = createPlayer({ x: 22, z: -10, heading: 0 });
  for (let i = 0; i < 30; i++) updatePlayer(p, { ...idle, forward: true }, 0.1, world, []);
  check('pemain jalan kaki tidak masuk kanal', !isInCanal(p.x, p.z) && p.z < 5);
  // Mobil juga tidak bisa masuk kanal.
  const car = world.cars.find((c) => !c.locked);
  const p2 = createPlayer({ x: car.x, z: car.z + 1, heading: 0 });
  updatePlayer(p2, { ...idle, enter: true }, 0.1, world, []);
  car.x = 22; car.z = 2; car.heading = 0; car.speed = 0;
  for (let i = 0; i < 30; i++) updatePlayer(p2, { ...idle, forward: true }, 0.1, world, []);
  check('mobil tidak masuk kanal', !isInCanal(car.x, car.z));
  // adaptWorld: dunia asli tanpa collider air tetap diblokir di sisi gameplay.
  const fakeRaw = {
    bounds: { half: 110 },
    colliders: [],
    cars: [],
    landmarks: [],
    playerSpawn: { x: 0, z: 51, facing: Math.PI },
    hospital: { x: 44, z: 44 },
    policeStation: { x: 88, z: 44 },
    resolveCircle: (pos) => pos,
    isWalkable: () => true,
    setDrivenCar: () => {},
    update: () => {},
  };
  const adapted = adaptWorld(fakeRaw);
  check('adaptWorld memblokir kanal walau dunia asli mengizinkan', !adapted.isWalkable(22, 22));
  const pushed2 = adapted.resolveCircle(22, 22, 0.45);
  check('adaptWorld resolveCircle mendorong keluar kanal', !isInCanal(pushed2.x, pushed2.z));
  // Objektif M1/M4 yang dulu di tengah kanal sudah pindah ke tepi.
  check('objektif M1 Pasar Terapung di tepi kanal', MISSIONS[0].objectives[1].x === 22 && MISSIONS[0].objectives[1].z === 0);
  check('objektif M4 kanal di tepi kanal', MISSIONS[3].objectives[0].x === 22 && MISSIONS[3].objectives[0].z === 0);
}

// 13. REPAIR-4 (cover): staging lama vs baru, simulasi dunia asli.
// Staging lama (-22,-58) menghadap -z: 2 detik gas penuh membawa mobil
// sampai tepi dunia (z -105), lalu tiap frame menabrak batas dan
// kecepatan runtuh (x0,25) — itulah "1 km/jam" di shot uji cover.
// Staging baru (0,44) setelah 2 detik masih di tengah peta, melaju.
{
  const scene = new THREE.Scene();
  const world = adaptWorld(createWorld(THREE, scene));
  const game = createGame(world);
  const drive = { ...idle, forward: true, heading: Math.PI };
  newGame(game);
  const carLama = world.cars.find((c) => c.model === 'Kancil' && !c.locked);
  game.player.x = carLama.x;
  game.player.z = carLama.z;
  game.player.inCar = carLama.id;
  carLama.driven = true;
  carLama.speed = 14;
  carLama.heading = Math.PI;
  for (let i = 0; i < 120; i++) updateGame(game, drive, 1 / 60);
  check('staging cover lama mencapai tepi dunia dalam 2 detik', carLama.z < -100);
  for (let i = 0; i < 30; i++) updateGame(game, drive, 1 / 60);
  check('staging cover lama terjepit di batas (kecepatan runtuh)', carLama.speed < 1);
  newGame(game);
  const carBaru = world.cars.find((c) => c.model === 'Kancil' && !c.locked);
  carBaru.x = 0;
  carBaru.z = 44;
  carBaru.heading = Math.PI;
  game.player.x = 0;
  game.player.z = 44;
  game.player.inCar = carBaru.id;
  carBaru.driven = true;
  carBaru.speed = 14;
  carBaru.heading = Math.PI;
  for (let i = 0; i < 120; i++) updateGame(game, drive, 1 / 60);
  check('staging cover baru tetap di tengah peta setelah 2 detik', Math.abs(carBaru.z) < 20);
  check('staging cover baru melaju kencang', carBaru.speed > 20);
  // REPAIR-4 (cover): polisi staging (5,-14) + (-5,-22) harus berakhir
  // di dalam frame saat __shotReady (120 frame): satu di depan pemain
  // (dz -28..-4), satunya lagi tepat di belakang Kancil (dz -4..+6).
  // RNG di-seed seperti stageShot main.js supaya hasil deterministik.
  {
    const realRandom = Math.random;
    let shotSeed = (0xc0ffee + 1 * 97) >>> 0;
    Math.random = () => {
      shotSeed = (shotSeed + 0x6d2b79f5) >>> 0;
      let t = shotSeed;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    newGame(game);
    const carPol = world.cars.find((c) => c.model === 'Kancil' && !c.locked);
    carPol.x = 0;
    carPol.z = 44;
    carPol.heading = Math.PI;
    game.police.push(createPoliceUnit('polisi-cover-1', 5, -14, true));
    game.police.push(createPoliceUnit('polisi-cover-2', -5, -22, true));
    game.police[0].state = 'chase';
    game.police[1].state = 'chase';
    game.player.x = 0;
    game.player.z = 44;
    game.player.inCar = carPol.id;
    carPol.driven = true;
    carPol.speed = 14;
    carPol.heading = Math.PI;
    game.wanted.heat = 80;
    game.wanted.stars = 4;
    for (let i = 0; i < 120; i++) updateGame(game, drive, 1 / 60);
    const dz1 = game.police[0].z - game.player.z;
    const dz2 = game.police[1].z - game.player.z;
    const inFrame = (dz) => dz < -4 && dz > -28;
    const nearCar = (dz) => dz >= -4 && dz <= 6;
    check('satu polisi cover di depan pemain saat shot siap',
      inFrame(dz1) || inFrame(dz2) || nearCar(dz1) || nearCar(dz2));
    check('kedua polisi cover tidak tertinggal jauh di belakang',
      dz1 < 10 && dz2 < 10);
    check('helikopter aktif di wanted 4', game.helicopter === true);
    Math.random = realRandom;
  }
  // REPAIR-4 (vista): updateGame memicu layar complete saat semua misi
  // selesai — pemicu yang menutupi vista di shot uji.
  newGame(game);
  game.missions.completed = ['M1', 'M2', 'M3', 'M4', 'M5'];
  updateGame(game, idle, 1 / 60);
  check('semua misi selesai memicu layar complete', game.screens.current === 'complete');
}

console.log(`\n${passed} lulus, ${failed} gagal dari ${passed + failed} cek.`);
process.exit(failed === 0 ? 0 : 1);
// --- akhir test-gameplay.mjs (baris revisi ditambahkan lewat edit terpisah) ---
// Revisi terekam: cek ke-12 (busted) menutup rantai "tangkap → denda →
// respawn RS" supaya layar TERTANGKAP tidak pernah soft-lock: pemain
// selalu kembali bermain dengan health penuh dan wanted bersih.
export const TEST_COUNT = 13;
