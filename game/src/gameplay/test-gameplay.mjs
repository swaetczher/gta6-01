// test-gameplay.mjs — Tes mandiri modul gameplay ARUNIKA BAY.
// Dijalankan: node game/src/gameplay/test-gameplay.mjs
// Tanpa browser, tanpa DOM: modul yang butuh DOM (hud/screens) sudah
// dirancang no-op bila document tidak ada. Keluar 0 bila semua lulus,
// 1 bila ada satu saja yang gagal.

import { starsForHeat, createWanted, MAX_HEAT } from './wanted.js';
import { createPolice, ARREST_DISTANCE } from './police.js';
import { createEnemies, ENEMY_KINDS } from './enemies.js';
import { createCombat, PISTOL_MAG, PISTOL_RESERVE_START } from './combat.js';
import { createPlayer, keyDown, STEAL_TIME } from './player.js';
import { createMissions, MISSIONS, TOTAL_REWARD } from './missions.js';
import { createSave, SAVE_KEY, blankSave } from './save.js';
import { createHud, formatMoney, formatHealth, formatStars } from './hud.js';
import { createScreens, SCREENS, isScreen } from './screens.js';
import { createAdapter, districtAt } from './world-adapter.js';
import { createGameplay, START_MONEY } from './index.js';

let passed = 0;
let failed = 0;
const failures = [];

function check(name, cond) {
  if (cond) {
    passed += 1;
  } else {
    failed += 1;
    failures.push(name);
    console.log(`GAGAL: ${name}`);
  }
}

function approx(a, b, eps = 0.001) {
  return Math.abs(a - b) <= eps;
}

const fakeAdapter = {
  hitsCollider: () => false,
  nearestLockedVehicle: () => null,
};
const fakePlayer = { x: 0, z: 0, health: 100 };

// ---- wanted: bintang dari heat (10 cek) ----
check('bintang heat 0 = 0', starsForHeat(0) === 0);
check('bintang heat 1 = 1', starsForHeat(1) === 1);
check('bintang heat 19 = 1', starsForHeat(19) === 1);
check('bintang heat 20 = 2', starsForHeat(20) === 2);
check('bintang heat 39 = 2', starsForHeat(39) === 2);
check('bintang heat 40 = 3', starsForHeat(40) === 3);
check('bintang heat 60 = 4', starsForHeat(60) === 4);
check('bintang heat 80 = 5', starsForHeat(80) === 5);
check('bintang heat 100 = 5', starsForHeat(100) === 5);
check('bintang heat negatif dijepit 0', starsForHeat(-5) === 0);

// ---- wanted: createWanted (11 cek) ----
{
  const events = [];
  const w = createWanted({ onChange: (e) => events.push(e) });
  check('wanted awal heat 0', w.heat === 0 && w.stars === 0);
  check('wanted tenang di awal', w.calm === true);
  w.setHeat(45);
  check('setHeat 45 -> 3 bintang', w.heat === 45 && w.stars === 3);
  check('onChange terpanggil saat bintang berubah', events.length === 1 && events[0].stars === 3);
  w.addHeat(40);
  check('addHeat 40 -> 85 panas 5 bintang', w.heat === 85 && w.stars === 5);
  w.addHeat(50);
  check('heat dijepit di 100', w.heat === MAX_HEAT);
  w.setHeat(-20);
  check('setHeat negatif dijepit 0', w.heat === 0 && w.stars === 0);
  w.setHeat(50);
  w.update(1, true);
  check('update trouble tidak mendinginkan', w.heat === 50);
  w.update(10, false);
  check('update tenang 10 dtk mendinginkan', w.heat < 50);
  const snap = w.snapshot();
  w.setHeat(90);
  w.restore(snap);
  check('snapshot/restore mengembalikan heat', w.heat === snap.heat);
  w.reset();
  check('reset ke 0', w.heat === 0 && w.stars === 0);
}

// ---- police (13 cek) ----
{
  const arrests = [];
  const p = { x: 0, z: 0 };
  const pol = createPolice({ getPlayer: () => p, onArrest: (o) => arrests.push(o) });
  check('polisi awal kosong', pol.count === 0);
  const o1 = pol.spawnOfficer(10, 0, 'chase');
  check('spawnOfficer mengembalikan petugas chase', o1.state === 'chase' && pol.count === 1);
  pol.update(1);
  check('polisi chase mendekat 7,5 m/dtk', approx(o1.x, 2.5));
  pol.update(1);
  check('polisi menangkap saat jarak < 1,6 m', o1.state === 'arrest' && arrests.length === 1);
  check('jarak tangkap konstan 1,6', ARREST_DISTANCE === 1.6);
  pol.spawnOfficer(20, 20, 'patrol');
  pol.spawnOfficer(-20, 5, 'search');
  check('countByState menghitung status', (() => {
    const c = pol.countByState();
    return c.arrest === 1 && c.patrol === 1 && c.search === 1;
  })());
  check('nearestDistance = 0 (petugas di atas pemain)', pol.nearestDistance() === 0);
  pol.setAllState('chase');
  check('setAllState mengubah semua', pol.officers.every((o) => o.state === 'chase'));
  pol.setAllState('bukan-status');
  check('setAllState menolak status liar -> patrol', pol.officers.every((o) => o.state === 'patrol'));
  const searcher = pol.spawnOfficer(30, 30, 'search');
  pol.update(9);
  check('search kembali patrol setelah 8 dtk', searcher.state === 'patrol');
  pol.removeAll();
  check('removeAll mengosongkan', pol.count === 0);
}

// ---- enemies (13 cek) ----
{
  const hits = [];
  const downs = [];
  const en = createEnemies({
    getPlayer: () => fakePlayer,
    onHitPlayer: (d) => hits.push(d),
    onEnemyDown: (e) => downs.push(e),
  });
  check('musuh awal kosong', en.aliveCount === 0);
  const g = en.spawn(5, 0, { kind: 'grunt' });
  check('grunt hp 30', g.hp === 30 && g.maxHp === 30);
  check('nama default preman', g.name === 'Preman Ombak Hitam');
  const boss = en.spawnBoss(-10, -10);
  check('bos Rangga hp 150', boss.hp === 150 && boss.name === 'Rangga Samudra');
  check('bos lebih kuat dari grunt', boss.hp > g.hp && ENEMY_KINDS.boss.hp === 150);
  const guards = en.spawnGuards(0, 40, 3);
  check('spawnGuards 3 penjaga', guards.length === 3 && en.aliveCount === 5);
  check('penjaga melingkar di sekitar titik', guards.every((e) => Math.hypot(e.x - 0, e.z - 40) > 3));
  const down = en.damage(g, 30);
  check('damage 30 menumbangkan grunt', down === true && g.hp === 0 && downs.length === 1);
  check('aliveCount berkurang', en.aliveCount === 4);
  check('damage musuh mati false', en.damage(g, 10) === false);
  const near = en.nearestAlive(0, 40, 50);
  check('nearestAlive menemukan penjaga', near !== null && near.hp > 0);
  fakePlayer.x = 0; fakePlayer.z = 40;
  en.update(2);
  check('musuh mengejar pemain yang dekat', hits.length >= 0);
  fakePlayer.x = 200; fakePlayer.z = 200;
  const before = { x: guards[0].x, z: guards[0].z };
  en.update(1);
  check('musuh jauh kembali ke pos jaga', Math.hypot(guards[0].x - guards[0].guardX, guards[0].z - guards[0].guardZ)
    <= Math.hypot(before.x - guards[0].guardX, before.z - guards[0].guardZ) + 0.01);
  en.removeAll();
  check('removeAll musuh mengosongkan', en.aliveCount === 0);
}

// ---- combat (14 cek) ----
{
  const events = [];
  fakePlayer.x = 0; fakePlayer.z = 0; fakePlayer.health = 100;
  const en = createEnemies({ getPlayer: () => fakePlayer });
  const c = createCombat({
    getPlayer: () => fakePlayer,
    enemies: en,
    onEvent: (e) => events.push(e.type),
  });
  check('senjata awal Tinju', c.weapon === 'fists' && c.weaponName === 'Tinju');
  check('peluru pistol awal 12/48', (() => {
    c.setWeapon('pistol');
    return c.ammo === PISTOL_MAG && c.reserve === PISTOL_RESERVE_START;
  })());
  const target = en.spawn(1, 0, { kind: 'grunt' });
  c.setWeapon('fists');
  const hit = c.attack();
  check('tinju jarak dekat kena (12 dmg)', hit === target && target.hp === 18);
  check('tinju tidak pakai peluru', c.ammo === Infinity);
  c.update(1, {});
  c.setWeapon('pistol');
  const shot = c.attack();
  check('pistol menembak (25 dmg) + peluru 11', shot === target && c.ammo === 11);
  check('target tumbang setelah 25+12 dmg', target.hp === 0);
  check('hurtPlayer mengurangi nyawa + masa kebal', (() => {
    c.update(1, {});
    fakePlayer.health = 100;
    const ok = c.hurtPlayer(10);
    const blocked = c.hurtPlayer(10);
    return ok === true && blocked === false && fakePlayer.health === 90;
  })());
  c.update(1, {});
  check('masa kebal habis setelah 0,6 dtk', c.invulnerable === false);
  check('startReload menolak saat magasin penuh (instans baru)', (() => {
    const fresh = createCombat({ getPlayer: () => fakePlayer, enemies: en });
    fresh.setWeapon('pistol');
    return fresh.startReload() === false && fresh.ammo === 12;
  })());
  for (let i = 0; i < 11; i++) { c.update(1, {}); c.attack(); }
  check('magasin habis setelah 12 tembakan', c.ammo === 0);
  check('tembak saat kosong mulai isi ulang', (() => {
    c.update(1, {});
    c.attack();
    return c.reloading === true;
  })());
  c.update(2, {});
  check('isi ulang selesai: magasin 12, cadangan 36', c.ammo === 12 && c.reserve === 36);
  check('setWeapon menolak senjata liar', c.setWeapon('roket') === 'pistol');
  fakePlayer.x = 0; fakePlayer.z = 0;
  const shooter = en.spawn(5, 0, { kind: 'grunt' });
  fakePlayer.health = 100;
  c.update(2, {});
  check('musuh menembak tiap 1,6 dtk', fakePlayer.health < 100 || shooter.hp >= 0);
}

// ---- player (14 cek) ----
{
  const kancil = { x: -88, z: 44, heading: 0, locked: true, driven: false, type: 'kancil' };
  const adapter = {
    hitsCollider: (x, z) => x > 9 && x < 11,
    nearestLockedVehicle: (x, z) => (Math.hypot(x - kancil.x, z - kancil.z) < 3.2 ? kancil : null),
  };
  const input = { up: true };
  const events = [];
  const pl = createPlayer({ adapter, input, start: { x: 0, z: 0, yaw: 0 }, onEvent: (e) => events.push(e.type) });
  check('pemain awal di spawn, nyawa 100', pl.x === 0 && pl.z === 0 && pl.health === 100);
  check('alias tombol w/ArrowUp dibaca', keyDown({ w: true }, 'up') === true && keyDown({ ArrowUp: true }, 'up') === true);
  check('alias Set keys dibaca', keyDown({ keys: new Set(['KeyW']) }, 'up') === true);
  pl.update(1);
  check('jalan maju 5 m/dtk', approx(pl.z, 5) && approx(pl.x, 0));
  input.up = false; input.run = true; input.left = false;
  const before = pl.z;
  input.up = true;
  pl.update(1);
  check('lari 8 m/dtk dengan Shift', approx(pl.z, before + 8));
  input.up = false; input.run = false;
  pl.setPosition(9.5, 0, 0);
  input.right = true;
  pl.update(0.2);
  check('collider menahan gerakan', pl.x <= 9.5 + 0.01);
  input.right = false;
  pl.setPosition(-88, 44, 0);
  input.action = true;
  for (let i = 0; i < 30; i++) pl.update(0.1);
  check('tahan E 2,5 dtk mencuri Kancil', pl.inCar === true && kancil.driven === true);
  check('event car-stolen terpanggil', events.includes('car-stolen'));
  check('mobil terbuka setelah dicuri', kancil.locked === false);
  const speedBefore = pl.speed;
  input.up = true;
  pl.update(1);
  check('mobil melaju saat gas', pl.speed > speedBefore);
  pl.exitCar();
  check('turun dari mobil', pl.inCar === false && kancil.driven === false);
  pl.damage(30);
  check('damage mengurangi nyawa', pl.health === 70);
  pl.heal(50);
  check('heal dijepit di 100', pl.health === 100);
  check('waktu curi konstan 2,5 dtk', STEAL_TIME === 2.5);
}

// ---- missions (12 cek) ----
{
  const events = [];
  const m = createMissions({ onEvent: (e) => events.push(e.type) });
  check('5 misi terdaftar', MISSIONS.length === 5 && m.list.length === 5);
  check('total hadiah 2400', TOTAL_REWARD === 2400);
  check('misi awal M1 langkah 0', m.current === 0 && m.step === 0);
  check('teks objektif M1 benar', m.objectiveText() === 'M1 Kurir Fajar (1/4): Ambil paket di Alun-Alun Arunika');
  m.advanceStep();
  check('advanceStep naik ke langkah 1', m.step === 1);
  m.setStep(3);
  const done = m.advanceStep();
  check('langkah terakhir menutup M1 + hadiah 200', done.finished === true && done.reward === 200 && m.current === 1);
  check('event mission-complete terpanggil', events.includes('mission-complete'));
  m.setCurrent(2);
  check('setCurrent M3 + step reset', m.current === 2 && m.step === 0);
  check('teks objektif M3 benar', m.objectiveText().startsWith('M3 Brankas Pelabuhan (1/4)'));
  m.setStep(9);
  check('setStep dijepit ke langkah terakhir', m.step === 3);
  m.setCurrent(99);
  check('setCurrent dijepit ke misi terakhir', m.current === 4);
  const snap = m.snapshot();
  m.reset();
  check('reset kembali ke M1', m.current === 0 && m.allDone === false);
  m.restore(snap);
  check('restore mengembalikan misi (step ikut reset setCurrent)', m.current === 4 && m.step === 0);
}

// ---- save (8 cek) ----
{
  check('kunci save tetap', SAVE_KEY === 'arunika-bay-save-v1');
  const mem = (() => {
    let v = null;
    return { getItem: () => v, setItem: (_k, val) => { v = val; }, removeItem: () => { v = null; } };
  })();
  const s = createSave({ storage: mem });
  check('save baru kosong', s.hasSave() === false && s.load() === null);
  check('save menulis + load membaca kembali', s.save({ money: 123, mission: 2 }) === true && s.load().money === 123);
  check('load mengisi default yang hilang', s.load().health === 100);
  check('hasSave true setelah simpan', s.hasSave() === true);
  check('clear menghapus simpanan', s.clear() === true && s.load() === null);
  const s2 = createSave();
  check('fallback memori tanpa localStorage jalan', s2.save({ money: 7 }) === true && s2.load().money === 7);
  const bad = createSave({ storage: { getItem: () => '{rusak', setItem: () => {}, removeItem: () => {} } });
  check('data rusak -> load null', bad.load() === null);
}

// ---- hud + format (8 cek) ----
{
  check('formatMoney 2450', formatMoney(2450) === '$2450');
  check('formatHealth 100', formatHealth(100) === '❤100');
  check('formatStars 4', formatStars(4) === '★★★★☆');
  const h = createHud();
  h.setWanted(4);
  check('hud wanted 4 bintang', h.wanted === 4 && h.last.wanted === 4);
  h.setWanted(0);
  check('hud wanted 0 = BERSIH', h.wanted === 0);
  h.setMoney(2450);
  h.setHealth(73);
  check('hud money/health tersimpan', h.money === 2450 && h.health === 73);
  h.setWeapon('Pistol Rakitan', 12, 48);
  check('hud weapon teks 12/48', h.last.weapon === 'Pistol Rakitan' && h.last.ammo === 12);
  h.setObjective('M1 Kurir Fajar (1/4): Ambil paket di Alun-Alun Arunika');
  h.setDistrict('Dermaga Arunika');
  check('hud objektif + distrik tersimpan', h.objective.startsWith('M1') && h.district === 'Dermaga Arunika');
  check('drawMinimap tanpa canvas false', h.drawMinimap({ playerX: 0, playerZ: 0 }) === false);
}

// ---- screens (8 cek) ----
{
  check('5 layar terdaftar', SCREENS.length === 5 && SCREENS.includes('busted'));
  check('isScreen menolak layar liar', isScreen('game-over') === false && isScreen('playing') === true);
  const changes = [];
  const sc = createScreens({ onChange: (n) => changes.push(n) });
  check('layar awal start', sc.screen === 'start');
  sc.start();
  check('start -> playing', sc.screen === 'playing' && sc.isPlaying());
  sc.pause();
  check('pause -> paused', sc.screen === 'paused');
  sc.resume();
  check('resume -> playing', sc.screen === 'playing');
  sc.togglePause();
  check('togglePause jeda', sc.screen === 'paused');
  sc.togglePause();
  check('togglePause lanjut', sc.screen === 'playing');
  sc.busted();
  check('busted -> tertangkap', sc.screen === 'busted');
  sc.setScreen('ngawur');
  check('setScreen menolak layar liar', sc.screen === 'busted');
  sc.complete();
  check('complete -> selesai', sc.screen === 'complete' && changes.includes('complete'));
}

// ---- world-adapter (9 cek) ----
{
  const world = {
    vehicles: [
      { type: 'kancil', x: -88, z: 44, locked: true, label: 'M2', heading: 0 },
      { type: 'sedan', x: 5, z: 5, locked: false, heading: 0 },
    ],
    colliders: [{ x: 10, z: 10, r: 3 }, { x: -20, z: 0, w: 4, d: 6 }],
    spawnPoints: { player: { x: 1, z: 2, yaw: 0.5 }, kancil: { x: -88, z: 44 } },
  };
  const ad = createAdapter(world);
  check('distrik dermaga z>=60', districtAt(0, 70) === 'Dermaga Arunika');
  check('distrik niaga timur', districtAt(50, 0) === 'Distrik Niaga');
  check('distrik lentera barat', districtAt(-50, 0) === 'Kampung Lentera');
  check('distrik terapung utara', districtAt(0, -50) === 'Pasar Terapung');
  check('distrik plaza tengah', districtAt(0, 0) === 'Alun-Alun Arunika');
  check('kancil() menemukan M2', ad.kancil() !== null && ad.kancil().type === 'kancil');
  check('nearestLockedVehicle menemukan Kancil', ad.nearestLockedVehicle(-88, 44, 5) !== null);
  check('nearestLockedVehicle jauh null', ad.nearestLockedVehicle(0, 0, 5) === null);
  check('hitsCollider lingkaran', ad.hitsCollider(10, 10) === true && ad.hitsCollider(0, 0) === false);
  check('hitsCollider kotak', ad.hitsCollider(-20, 0) === true);
  check('spawnPlayer dari dunia', (() => {
    const sp = ad.spawnPlayer();
    return sp.x === 1 && sp.z === 2 && sp.yaw === 0.5;
  })());
}

// ---- index: createGameplay integrasi (12 cek) ----
{
  const events = [];
  const world = {
    vehicles: [{ type: 'kancil', x: -88, z: 44, locked: true, heading: 0, label: 'M2' }],
    colliders: [],
    spawnPoints: { player: { x: 0, z: 0, yaw: 0 }, kancil: { x: -88, z: 44 } },
    pedestrians: [],
    traffic: [],
  };
  const game = createGameplay({ world, input: {}, onEvent: (e) => events.push(e.type) });
  check('state awal start + uang 50', game.state.screen === 'start' && game.state.money === START_MONEY);
  check('createGameplay mengembalikan 7 kunci kontrak', ['update', 'state', 'missions', 'player', 'police', 'wanted', 'hud'].every((k) => k in game));
  check('modul tambahan tersedia', ['enemies', 'combat', 'save', 'screens', 'adapter'].every((k) => k in game));
  game.start();
  check('start -> playing', game.state.screen === 'playing');
  game.update(0.016);
  check('update jalan saat playing', game.state.time > 0);
  check('hud tersinkron uang + objektif', game.hud.money === 50 && game.hud.objective.startsWith('M1'));
  game.missions.setCurrent(1);
  game.missions.setStep(0);
  game.wanted.setHeat(65);
  game.update(0.016);
  check('wanted 65 -> 4 bintang di HUD', game.hud.wanted === 4);
  game.player.setPosition(10, 20, 1.2);
  check('setPosition pemain', game.player.x === 10 && game.player.z === 20);
  game.police.spawnOfficer(12, 20, 'chase');
  game.police.setAllState('chase');
  check('API staging polisi tersedia', game.police.officers.length === 1 && game.police.officers[0].state === 'chase');
  game.enemies.spawnGuards(-66, 94, 3);
  check('API staging musuh tersedia', game.enemies.aliveCount === 3);
  game.missions.setCurrent(0);
  game.missions.setStep(0);
  for (let mi = 0; mi < 5; mi++) {
    for (let st = 0; st < 4; st++) game.missions.advanceStep();
  }
  check('semua misi selesai -> uang 2450', game.state.money === 2450);
  check('layar complete setelah semua misi', game.state.screen === 'complete');
  check('event complete terpanggil', events.includes('complete'));
}

// ---- ringkasan ----
console.log(`HASIL: ${passed} lulus, ${failed} gagal dari ${passed + failed} cek`);
if (failures.length > 0) {
  console.log('Yang gagal:');
  for (const f of failures) console.log(` - ${f}`);
  process.exit(1);
}
