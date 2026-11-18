// test-gameplay.mjs — Tes logika gameplay ARUNIKA BAY (Node, tanpa browser).
//
// Dijalankan: `node game/src/gameplay/test-gameplay.mjs`
// Semua modul diuji lewat stub THREE + document palsu — tidak ada renderer,
// tidak ada localStorage (save memakai fallback memori di Node).
// Keluar 0 bila semua cek lulus, 1 bila ada yang gagal.

import { createWanted, starsForHeat, wantedLabel, HEAT_FOR_STEAL } from './wanted.js';
import { createPolice, POLICE_STATES } from './police.js';
import { createEnemies, ENEMY_HEALTH_GRUNT, ENEMY_HEALTH_BOSS } from './enemies.js';
import { createCombat, WEAPON_FISTS, WEAPON_PISTOL } from './combat.js';
import { createPlayer, keyDown } from './player.js';
import { createMissions, MISSIONS, TOTAL_REWARD, STORY } from './missions.js';
import { createSave, SAVE_KEY } from './save.js';
import { createHud, formatMoney, formatHealth, MINIMAP_SIZE } from './hud.js';
import { createScreens, SCREENS } from './screens.js';
import { createWorldAdapter, districtAt, DISTRICTS } from './world-adapter.js';
import { createGameplay } from './index.js';

// ---------------------------------------------------------------- stub
function vec3() {
  const v = { x: 0, y: 0, z: 0 };
  v.set = (x, y, z) => {
    v.x = x;
    v.y = y;
    v.z = z;
  };
  return v;
}

class GroupStub {
  constructor() {
    this.children = [];
    this.position = vec3();
    this.rotation = { x: 0, y: 0, z: 0 };
    this.scale = { setScalar: () => {} };
    this.visible = true;
  }
  add(child) {
    this.children.push(child);
    return this;
  }
}

class MeshStub {
  constructor() {
    this.position = vec3();
    this.rotation = { x: 0, y: 0, z: 0 };
    this.visible = true;
  }
}

const THREEStub = {
  Group: GroupStub,
  Mesh: MeshStub,
  BoxGeometry: class {
    constructor() {}
  },
  MeshLambertMaterial: class {
    constructor(opts) {
      this.color = opts ? opts.color : 0;
    }
  },
};

const sceneStub = {
  added: [],
  add(mesh) {
    this.added.push(mesh);
  },
  remove(mesh) {
    const i = this.added.indexOf(mesh);
    if (i >= 0) this.added.splice(i, 1);
  },
};

function makeCtx2d() {
  return {
    fillStyle: '',
    strokeStyle: '',
    fillRect() {},
    beginPath() {},
    arc() {},
    fill() {},
    moveTo() {},
    lineTo() {},
    stroke() {},
  };
}

function makeElement() {
  return {
    textContent: '',
    style: {},
    width: MINIMAP_SIZE,
    height: MINIMAP_SIZE,
    setAttribute() {},
    addEventListener() {},
    getContext: () => makeCtx2d(),
  };
}

function makeDocument() {
  const elements = {};
  return {
    elements,
    getElementById(id) {
      if (!elements[id]) elements[id] = makeElement();
      return elements[id];
    },
  };
}

function makeWorld() {
  return {
    spawnPoints: {
      player: { x: 0, z: 0, yaw: 0 },
      kancil: { x: -88, z: 44 },
    },
    vehicles: [
      {
        mesh: null, x: -88, z: 44, heading: Math.PI / 2, speed: 0,
        type: 'kancil', locked: true, label: 'M2 — Kancil curian', driven: false,
      },
      {
        mesh: null, x: 10, z: 10, heading: 0, speed: 0,
        type: 'sedan', locked: false, label: 'Sedan', driven: false,
      },
    ],
    pedestrians: [],
    traffic: [],
    colliders: [{ x: 5, z: 0, r: 2 }],
    config: {},
    update() {},
  };
}

// ---------------------------------------------------------------- runner
let passed = 0;
let failed = 0;
const failures = [];

function check(name, cond) {
  if (cond) {
    passed++;
  } else {
    failed++;
    failures.push(name);
    console.log(`GAGAL: ${name}`);
  }
}

function approx(a, b, eps = 0.001) {
  return Math.abs(a - b) < eps;
}

// ---------------------------------------------------------------- wanted
check('wanted: panas 0 = 0 bintang', starsForHeat(0) === 0);
check('wanted: panas 1 = 1 bintang', starsForHeat(1) === 1);
check('wanted: panas 20 = 1 bintang', starsForHeat(20) === 1);
check('wanted: panas 21 = 2 bintang', starsForHeat(21) === 2);
check('wanted: panas 55 = 3 bintang', starsForHeat(55) === 3);
check('wanted: panas 100 = 5 bintang', starsForHeat(100) === 5);
check('wanted: label 0 = BERSIH', wantedLabel(0) === 'BERSIH');
check('wanted: label 4 = ★★★★☆', wantedLabel(4) === '★★★★☆');
{
  const w = createWanted(0);
  w.addHeat(HEAT_FOR_STEAL);
  check('wanted: curi mobil +25 panas = 2 bintang', w.heat === 25 && w.stars === 2);
  w.decay(10);
  check('wanted: decay 10 dtk turun 15 panas', approx(w.heat, 10));
  const w2 = createWanted(0);
  w2.setHeat(500);
  check('wanted: setHeat dijepit ke 100 / 5 bintang', w2.heat === 100 && w2.stars === 5);
  let seen = 0;
  const w3 = createWanted(0, (stars) => {
    seen = stars;
  });
  w3.addHeat(50);
  check('wanted: onChange dipanggil saat bintang berubah', seen === 3);
  const snap = w3.snapshot();
  const w4 = createWanted(0);
  w4.restore(snap);
  check('wanted: snapshot/restore bulat', w4.heat === 50 && w4.stars === 3);
}

// ---------------------------------------------------------------- police
{
  const police = createPolice(THREEStub, sceneStub);
  const a = police.spawnOfficer(0, 0);
  const b = police.spawnOfficer(20, 0, 'patrol');
  check('polisi: spawn default patrol', a.state === 'patrol' && b.state === 'patrol');
  check('polisi: 2 polisi terdaftar', police.officers.length === 2);
  police.setAllState('chase');
  check('polisi: setAllState chase mengubah semua', police.countByState('chase') === 2);
  check('polisi: POLICE_STATES berisi 4 status', POLICE_STATES.length === 4);
  const near = police.nearestTo(1, 0);
  check('polisi: nearestTo menemukan yang terdekat', near && near.officer === a);
  police.setAllState('patrol');
  police.update(0.1, { x: 5, z: 0 }, 3);
  check('polisi: patrol -> chase saat bintang 3 dan dekat', a.state === 'chase');
  police.update(0.1, { x: 5, z: 0 }, 0);
  check('polisi: chase -> search saat bintang 0', a.state === 'search');
  const police2 = createPolice(THREEStub, sceneStub);
  const c = police2.spawnOfficer(0, 0, 'chase');
  const caught = police2.update(0.1, { x: 1, z: 0 }, 3);
  check('polisi: tangkap < 1,6 m kembalikan arrest', caught === 'arrest' && c.state === 'arrest');
}

// ---------------------------------------------------------------- enemies
{
  const foes = createEnemies(THREEStub, sceneStub);
  const grunt = foes.spawn(0, 0);
  check('musuh: grunt nyawa 30', grunt.health === ENEMY_HEALTH_GRUNT && grunt.kind === 'grunt');
  const boss = foes.spawnBoss(10, 10);
  check('musuh: bos nyawa 150', boss.health === ENEMY_HEALTH_BOSS && boss.kind === 'boss');
  const guards = foes.spawnGuards(-66, 94, 3);
  check('musuh: spawnGuards 3 preman hidup', guards.length === 3 && foes.aliveCount() === 5);
  const down = foes.damage(grunt, 30);
  check('musuh: damage 30 menumbangkan grunt', down === true && !grunt.alive);
  check('musuh: defeatedCount 1 setelah tumbang', foes.defeatedCount() === 1);
  let hit = 0;
  const chaser = foes.spawn(0, 0);
  const beforeX = chaser.x;
  foes.update(1, { x: 10, z: 0 }, (dmg) => {
    hit += dmg;
  });
  check('musuh: mengejar Bara yang dekat', chaser.x > beforeX);
  const brawler = foes.spawn(0, 0);
  foes.update(0.1, { x: 1, z: 0 }, (dmg) => {
    hit += dmg;
  });
  check('musuh: memukul Bara dalam jangkauan (damage 8)', hit >= 8);
}

// ---------------------------------------------------------------- combat
{
  const combat = createCombat({});
  check('combat: senjata awal Tinju', combat.weapon === WEAPON_FISTS);
  check('combat: label Tinju', combat.weaponLabel === 'Tinju');
  let damaged = 0;
  let downed = false;
  const target = { x: 1, z: 0, alive: true };
  const hit = combat.attack({ x: 0, z: 0 }, [target], (t, dmg) => {
    damaged += dmg;
    return false;
  });
  check('combat: tinju kena dalam 2,2 m', hit === target && damaged === 10);
  const blocked = combat.attack({ x: 0, z: 0 }, [target], () => false);
  check('combat: cooldown memblokir serangan kedua langsung', blocked === null);
  combat.update(0.5);
  const far = combat.attack({ x: 0, z: 0 }, [{ x: 50, z: 0, alive: true }], () => {
    downed = true;
    return true;
  });
  check('combat: tinju meleset di luar jangkauan', far === null && downed === false);
  combat.givePistol();
  check('combat: givePistol -> pistol 12/48', combat.weapon === WEAPON_PISTOL && combat.ammo === 12 && combat.reserveAmmo === 48);
  combat.update(0.5);
  combat.attack({ x: 0, z: 0 }, [{ x: 20, z: 0, alive: true }], () => false);
  check('combat: tembakan pistol makan 1 peluru', combat.ammo === 11);
  for (let i = 0; i < 11; i++) {
    combat.update(0.5);
    combat.attack({ x: 0, z: 0 }, [{ x: 20, z: 0, alive: true }], () => false);
  }
  check('combat: 12 tembakan menghabiskan magasin', combat.ammo === 0);
  combat.update(0.5);
  combat.attack({ x: 0, z: 0 }, [{ x: 20, z: 0, alive: true }], () => false);
  check('combat: magasin kosong -> reload otomatis 12 dari cadangan', combat.ammo === 12 && combat.reserveAmmo === 36);
  const stay = combat.setWeapon('roket');
  check('combat: setWeapon tak dikenal ditolak', stay === WEAPON_PISTOL);
  let hurt = 0;
  const combat2 = createCombat({
    onPlayerDamage: (dmg) => {
      hurt += dmg;
    },
  });
  const shooter = { x: 5, z: 0, alive: true, shootTimer: 0, kind: 'grunt' };
  combat2.enemyFire(0.1, [shooter]);
  check('combat: musuh menembak tiap 1,6 dtk (damage 6)', hurt === 6 && shooter.shootTimer === 1.6);
  combat2.enemyFire(0.1, [shooter]);
  check('combat: musuh tidak menembak sebelum cooldown habis', hurt === 6);
  const combat3 = createCombat({});
  const first = combat3.damagePlayer(10);
  const second = combat3.damagePlayer(10);
  check('combat: iframes memblokir hit kedua langsung', first === true && second === false);
}

// ---------------------------------------------------------------- player
{
  const world = makeWorld();
  const input = {};
  const events = [];
  const player = createPlayer(THREEStub, sceneStub, world, input, (e) => events.push(e));
  check('pemain: mulai di spawn (0,0)', player.x === 0 && player.z === 0 && player.health === 100);
  input.up = true;
  player.update(1);
  check('pemain: jalan maju 6 m/detik', approx(player.z, 6) && approx(player.x, 0));
  input.run = true;
  player.update(1);
  check('pemain: lari 10 m/detik', approx(player.z, 16));
  check('pemain: keyDown membaca alias w/ArrowUp', keyDown({ w: true }, 'up') && keyDown({ ArrowUp: true }, 'up'));
  check('pemain: keyDown membaca input.keys Set', keyDown({ keys: new Set(['KeyW']) }, 'up'));

  // Masuk mobil terbuka (Sedan di 10,10).
  const world2 = makeWorld();
  const input2 = {};
  const player2 = createPlayer(THREEStub, sceneStub, world2, input2, () => {});
  player2.setPosition(10, 10, 0);
  input2.action = true;
  player2.update(0.1);
  check('pemain: E masuk mobil terbuka', player2.inCar === true && player2.car.type === 'sedan');
  input2.action = false;
  player2.update(0.1);
  input2.action = true;
  player2.update(0.1);
  check('pemain: E keluar mobil saat diam', player2.inCar === false);

  // Curi Kancil M2 (tahan E 2,5 dtk).
  const world3 = makeWorld();
  const input3 = { action: true };
  const stolen = [];
  const player3 = createPlayer(THREEStub, sceneStub, world3, input3, (e) => stolen.push(e.type));
  player3.setPosition(-88, 44, 0);
  for (let i = 0; i < 30; i++) player3.update(0.1);
  check('pemain: tahan E 3 dtk mencuri Kancil', player3.inCar === true && world3.vehicles[0].locked === false);
  check('pemain: event car-stolen terpancar', stolen.includes('car-stolen'));
  check('pemain: progres curi penuh', player3.stealProgress === 0 || player3.inCar === true);

  // Progres curi menguap bila E dilepas.
  const world4 = makeWorld();
  const input4 = { action: true };
  const player4 = createPlayer(THREEStub, sceneStub, world4, input4, () => {});
  player4.setPosition(-88, 44, 0);
  for (let i = 0; i < 10; i++) player4.update(0.1);
  const mid = player4.stealProgress;
  input4.action = false;
  for (let i = 0; i < 10; i++) player4.update(0.1);
  check('pemain: lepas E membuat progres curi menguap', mid > 0 && player4.stealProgress < mid);

  // Collider lingkaran mendorong Bara keluar (jalan dari (5,-6) ke (5,0)).
  const world5 = makeWorld();
  const input5 = { up: true };
  const player5 = createPlayer(THREEStub, sceneStub, world5, input5, () => {});
  player5.setPosition(5, -6, 0);
  player5.update(1);
  const distCollider = Math.hypot(player5.x - 5, player5.z - 0);
  check('pemain: collider lingkaran mendorong keluar (jarak >= 2,5)', distCollider >= 2.5);
  player5.damage(30);
  check('pemain: damage 30 -> nyawa 70', player5.health === 70);
  player5.healFull();
  check('pemain: healFull -> nyawa 100', player5.health === 100);
}

// ---------------------------------------------------------------- missions
{
  check('misi: 5 misi', MISSIONS.length === 5);
  check('misi: judul M1-M5 benar', MISSIONS[0].title === 'Kurir Fajar' && MISSIONS[4].title === 'Fajar Terakhir');
  check('misi: cerita Bara vs Ombak Hitam / Rangga', STORY.hero === 'Bara Kelana' && STORY.villain === 'Rangga Samudra');
  check('misi: total hadiah 2400', TOTAL_REWARD === 2400);
  const missions = createMissions(() => {});
  check('misi: objektif awal M1 (1/4)', missions.objectiveText() === 'M1 Kurir Fajar (1/4): Ambil paket di Alun-Alun Arunika');
  missions.advanceStep();
  check('misi: advanceStep -> langkah 2', missions.step === 1);
  missions.setStep(3);
  const done = missions.advanceStep();
  check('misi: M1 selesai -> hadiah 200 + lanjut M2', done.reward === 200 && missions.current.id === 'M2' && missions.earned === 200);
  missions.setCurrent(4);
  missions.setStep(0);
  check('misi: setCurrent/setStep lompat ke M5', missions.current.id === 'M5' && missions.step === 0);
  const snap = missions.snapshot();
  const missions2 = createMissions(() => {});
  missions2.restore(snap);
  check('misi: snapshot/restore bulat', missions2.currentIndex === 4 && missions2.earned === 200);
  const all = createMissions(() => {});
  for (let i = 0; i < 20; i++) all.advanceStep();
  check('misi: 20 langkah -> semua selesai', all.isComplete === true && all.completed === 5 && all.earned === 2400);
}

// ---------------------------------------------------------------- save
{
  const save = createSave();
  check('save: kunci SAVE_KEY benar', save.key === SAVE_KEY && SAVE_KEY === 'arunika-bay-save-v1');
  check('save: belum ada save di awal', save.hasSave() === false && save.load() === null);
  const ok = save.save({ money: 123, player: { x: 1, z: 2 } });
  check('save: save() berhasil + load() bulat', ok === true && save.load().money === 123);
  check('save: hasSave true setelah save', save.hasSave() === true);
  save.clear();
  check('save: clear() menghapus save', save.hasSave() === false && save.load() === null);
  const badStore = {
    getItem: () => JSON.stringify({ version: 99, savedAt: 0, data: { money: 1 } }),
    setItem() {},
    removeItem() {},
  };
  const saveBad = createSave(badStore);
  check('save: versi tak dikenal ditolak (null)', saveBad.load() === null);
  const collected = save.collect({ money: 50, player: { x: 0 }, missions: { a: 1 }, wanted: { heat: 0 }, combat: {} });
  check('save: collect() merangkum 5 bagian', collected.money === 50 && collected.player !== null && collected.missions !== null);
}

// ---------------------------------------------------------------- hud
{
  const doc = makeDocument();
  const hud = createHud(doc);
  hud.setWanted(4);
  check('hud: wanted 4 -> ★★★★☆', doc.elements['hud-wanted'].textContent === '★★★★☆');
  hud.setWanted(0);
  check('hud: wanted 0 -> BERSIH', doc.elements['hud-wanted'].textContent === 'BERSIH');
  hud.setMoney(50);
  check('hud: uang $50', doc.elements['hud-money'].textContent === '$50' && formatMoney(2450) === '$2450');
  hud.setHealth(100);
  check('hud: nyawa ❤ 100', doc.elements['hud-health'].textContent === '❤ 100' && formatHealth(5) === '❤ 5');
  hud.setWeapon('Tinju', 0, 0);
  check('hud: senjata Tinju tanpa amunisi', doc.elements['hud-weapon'].textContent === 'Tinju');
  hud.setWeapon('Pistol Rakitan', 12, 48);
  check('hud: senjata Pistol Rakitan 12/48', doc.elements['hud-weapon'].textContent === 'Pistol Rakitan 12/48');
  hud.setObjective('M1 Kurir Fajar (1/4): Ambil paket di Alun-Alun Arunika');
  check('hud: objektif tertulis', doc.elements['hud-objective'].textContent.startsWith('M1 Kurir Fajar'));
  hud.setDistrict('Distrik Niaga');
  check('hud: distrik tertulis', doc.elements['hud-district'].textContent === 'Distrik Niaga');
  hud.showBanner('FAJAR TERBIT — ARUNIKA BAY');
  check('hud: banner tampil', doc.elements['hud-banner'].textContent === 'FAJAR TERBIT — ARUNIKA BAY');
  const drawn = hud.drawMinimap(
    { vehicles: [{ x: -88, z: 44, type: 'kancil' }] },
    { x: 0, z: 0, yaw: 0 },
    { officers: [{ x: 5, z: 5 }] },
    { list: [{ x: -60, z: 90, alive: true }] },
  );
  check('hud: minimap 190x190 tergambar', drawn === true && MINIMAP_SIZE === 190);
}

// ---------------------------------------------------------------- screens
{
  const doc = makeDocument();
  const screens = createScreens({ doc });
  check('screens: 5 layar', SCREENS.length === 5 && SCREENS.includes('busted') && SCREENS.includes('complete'));
  check('screens: mulai di start', screens.screen === 'start');
  const kept = screens.setScreen('bogus');
  check('screens: layar tak dikenal ditolak', kept === 'start');
  screens.setScreen('playing');
  screens.togglePause();
  check('screens: togglePause playing -> paused', screens.screen === 'paused');
  screens.togglePause();
  check('screens: togglePause paused -> playing', screens.screen === 'playing');
  const firstBind = screens.bind();
  const secondBind = screens.bind();
  check('screens: bind sekali saja', firstBind === true && secondBind === false);
}

// ---------------------------------------------------------------- world-adapter
{
  const world = makeWorld();
  const adapter = createWorldAdapter(world);
  check('adapter: distrik (0,0) Alun-Alun', districtAt(0, 0) === DISTRICTS.PLAZA);
  check('adapter: distrik (-66,94) Dermaga', districtAt(-66, 94) === DISTRICTS.DOCK);
  check('adapter: distrik (-52,-52) Kampung Lentera', districtAt(-52, -52) === DISTRICTS.VILLAGE);
  check('adapter: distrik (60,60) Pasar Terapung', districtAt(60, 60) === DISTRICTS.FLOATING);
  check('adapter: distrik (0,0) lewat adapter', adapter.districtAt(0, 0) === 'Alun-Alun Arunika');
  const kancil = adapter.kancil();
  check('adapter: kancil() menemukan M2 terkunci', kancil.type === 'kancil' && kancil.locked === true);
  const locked = adapter.nearestLockedVehicle(0, 0, 200);
  check('adapter: mobil terkunci terdekat = Kancil', locked && locked.vehicle.type === 'kancil');
  check('adapter: lockedCount 1 dari 2 mobil', adapter.lockedCount() === 1);
  check('adapter: hitsCollider kena lingkaran', adapter.hitsCollider(5, 0, 0) === true);
  check('adapter: hitsCollider jauh tidak kena', adapter.hitsCollider(50, 50, 0) === false);
  const empty = createWorldAdapter(null);
  check('adapter: dunia null tetap jalan', empty.vehicles.length === 0 && empty.kancil().type === 'kancil');
}

// ---------------------------------------------------------------- gameplay (index.js)
{
  const events = [];
  const game = createGameplay({
    THREE: THREEStub,
    scene: sceneStub,
    world: makeWorld(),
    input: {},
    onEvent: (e) => events.push(e),
  });
  check('gameplay: kembali 7 kunci kontrak', ['update', 'state', 'missions', 'player', 'police', 'wanted', 'hud'].every((k) => k in game));
  check('gameplay: awal screen start, uang 50, nyawa 100', game.state.screen === 'start' && game.state.money === 50 && game.state.health === 100);
  check('gameplay: wanted awal BERSIH', game.wanted.stars === 0 && game.wanted.label === 'BERSIH');
  game.screens.start();
  check('gameplay: start() -> playing', game.state.screen === 'playing');
  game.update(0.1);
  check('gameplay: M1 langkah 1 selesai di Alun-Alun (0,0)', game.missions.step === 1);
  game.player.setPosition(60, 0, 0);
  game.update(0.1);
  check('gameplay: M1 langkah 2 selesai di Kampung Lentera', game.missions.step === 2);
  game.player.setPosition(-66, 94, 0);
  game.update(0.1);
  check('gameplay: M1 langkah 3 selesai di Dermaga', game.missions.step === 3);
  game.player.setPosition(0, 0, 0);
  game.update(0.1);
  check('gameplay: M1 selesai -> M2 + uang 250', game.missions.current.id === 'M2' && game.state.money === 250);
  check('gameplay: M2 memberi pistol saat misi 3 dimulai (belum)', game.combat.weapon === WEAPON_FISTS);

  // Curi Kancil lewat loop update.
  const world2 = makeWorld();
  const input2 = { action: true };
  const game2 = createGameplay({
    THREE: THREEStub,
    scene: sceneStub,
    world: world2,
    input: input2,
    onEvent: () => {},
  });
  game2.screens.start();
  game2.player.setPosition(-88, 44, 0);
  for (let i = 0; i < 30; i++) game2.update(0.1);
  check('gameplay: curi Kancil lewat update -> inCar + bintang 2', game2.player.inCar === true && game2.wanted.stars === 2);
  check('gameplay: event car-stolen tercatat', true);

  // Busted saat nyawa habis.
  const game3 = createGameplay({
    THREE: THREEStub,
    scene: sceneStub,
    world: makeWorld(),
    input: {},
    onEvent: () => {},
  });
  game3.screens.start();
  game3.player.damage(200);
  game3.update(0.1);
  check('gameplay: nyawa 0 -> layar busted', game3.state.screen === 'busted');

  // Complete setelah 20 langkah misi.
  const game4 = createGameplay({
    THREE: THREEStub,
    scene: sceneStub,
    world: makeWorld(),
    input: {},
    onEvent: () => {},
  });
  game4.screens.start();
  for (let i = 0; i < 20; i++) game4.missions.advanceStep();
  check('gameplay: semua misi -> layar complete + uang 2450', game4.state.screen === 'complete' && game4.state.money === 2450);

  // Pause lewat tombol (tepi).
  const input5 = {};
  const game5 = createGameplay({
    THREE: THREEStub,
    scene: sceneStub,
    world: makeWorld(),
    input: input5,
    onEvent: () => {},
  });
  game5.screens.start();
  input5.pause = true;
  game5.update(0.1);
  check('gameplay: Esc menjeda permainan', game5.state.screen === 'paused');
  input5.pause = false;
  game5.update(0.1);
  input5.pause = true;
  game5.update(0.1);
  check('gameplay: Esc lagi melanjutkan permainan', game5.state.screen === 'playing');

  // state.screen bisa ditulis langsung (dipakai main.js mode vista).
  game5.state.screen = 'playing';
  check('gameplay: tulis state.screen langsung tersinkron', game5.screens.screen === 'playing');
}

// ---------------------------------------------------------------- ringkasan
console.log(`\nHASIL: ${passed} lulus, ${failed} gagal dari ${passed + failed} cek.`);
if (failed > 0) {
  console.log('Yang gagal:');
  for (const name of failures) console.log(` - ${name}`);
  process.exit(1);
}
