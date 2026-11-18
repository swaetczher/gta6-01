// index.js — Fasad gameplay ARUNIKA BAY: satu update(dt, input) per frame
// yang merangkai semua modul: pemain, combat, wanted, polisi, preman,
// misi, layar, save. main.js (three.js) hanya memanggil updateGame dan
// membaca state untuk dirender; logika di sini tanpa three.js.
import { createPlayer, updatePlayer } from './player.js';
import { createCombat, updateCombat, attack, switchWeapon, startReload } from './combat.js';
import { createWanted, addHeat, updateWanted, heatForCrime, clearWanted } from './wanted.js';
import { syncPolice, updatePolice, helicopterActive } from './police.js';
import { spawnThugs, updateThugs } from './enemies.js';
import {
  MISSIONS, createMissionState, getMission, nextMissionId,
  startMission, updateMission,
} from './missions.js';
import { createScreenState, setScreen, isPlaying } from './screens.js';
import { saveGame, loadGame, applySave } from './save.js';

export { MISSIONS };

export function createGame(world) {
  const state = {
    world,
    player: createPlayer(world.spawn),
    combat: createCombat(),
    wanted: createWanted(),
    police: [],
    thugs: [],
    missions: createMissionState(),
    missionDefs: MISSIONS,
    screens: createScreenState(),
    events: [],
    toasts: [],
    time: 0,
    helicopter: false,
    gameOver: false,
    allMissionsDone: false,
  };
  return state;
}

export function newGame(state) {
  state.player = createPlayer(state.world.spawn);
  state.combat = createCombat();
  state.wanted = createWanted();
  state.police = [];
  state.thugs = [];
  state.missions = createMissionState();
  state.events = [];
  state.time = 0;
  state.gameOver = false;
  state.allMissionsDone = false;
  setScreen(state.screens, 'playing');
  return state;
}

export function continueGame(state) {
  const data = loadGame();
  if (!data) return false;
  newGame(state);
  applySave(state, data);
  setScreen(state.screens, 'playing');
  return true;
}

// input: { forward, back, left, right, run, jump, enter, enterHeld,
//          attack, reload, weapon, startMission, pause, heading, lookDX }
export function updateGame(state, input, dt) {
  state.time += dt;
  if (!isPlaying(state.screens)) return state;
  const { player, world } = state;
  const events = state.events;

  // Arah hadap dari mouse (pointer-lock) bila diberikan main.js.
  if (typeof input.heading === 'number') player.heading = input.heading;

  updatePlayer(player, input, dt, world, events);
  updateCombat(state.combat, dt);
  if (input.weapon) switchWeapon(state.combat, input.weapon);
  if (input.reload) startReload(state.combat);
  if (input.attack) {
    const targets = [...state.thugs, ...state.police.map((p) => ({ ...p, health: 40 }))];
    const hits = attack(state.combat, player.x, player.z, player.heading, targets);
    for (const hit of hits) {
      const thug = state.thugs.find((t) => t.id === hit.id);
      if (thug && hit.killed) events.push({ type: 'thugDown', id: thug.id });
      const cop = state.police.find((p) => p.id === hit.id);
      if (cop && hit.killed) addHeat(state.wanted, heatForCrime('hurtPolice'));
      else if (thug) addHeat(state.wanted, heatForCrime('hurtThug'));
    }
    if (state.combat.weapon === 'pistol' && hits.length === 0) {
      // Tembakan yang meleset tetap berisik: sedikit panas bila ada polisi dekat.
      if (state.police.some((p) => Math.hypot(p.x - player.x, p.z - player.z) < 30)) {
        addHeat(state.wanted, 4);
      }
    }
  }

  // Misi: Enter memulai misi berikutnya; preman misi di-spawn sekali.
  if (input.startMission && !state.missions.currentId) {
    const next = nextMissionId(state.missions.completed);
    if (next) {
      const mission = startMission(state.missions, next);
      addHeat(state.wanted, mission.wantedOnStart || 0);
      if (mission.thugs && !state.missions.thugsSpawned) {
        state.thugs = spawnThugs(mission.thugs);
        state.missions.thugsSpawned = true;
      }
      events.push({ type: 'missionStart', missionId: next, intro: mission.intro });
    }
  }
  updateMission(state.missions, {
    player, world, thugs: state.thugs, wanted: state.wanted, events,
  });
  updateThugs(state.thugs, player, dt, world, events);

  // Wanted + polisi.
  syncPolice(state.police, state.wanted.stars, player, world);
  const seen = updatePolice(state.police, player, dt, world, events);
  updateWanted(state.wanted, dt, seen.anySees);
  state.helicopter = helicopterActive(state.wanted.stars);
  syncPolice(state.police, state.wanted.stars, player, world);

  // Konsumsi event yang dihasilkan modul.
  drainEvents(state);
  if (world.update) world.update(dt, { player, wanted: state.wanted });

  if (player.health <= 0) {
    player.health = 0;
    busted(state, 'Kau tumbang di jalanan Arunika.');
  }
  if (state.missions.completed.length >= MISSIONS.length && !state.allMissionsDone) {
    state.allMissionsDone = true;
    setScreen(state.screens, 'complete');
    events.push({ type: 'gameComplete' });
  }
  return state;
}

function drainEvents(state) {
  const events = state.events;
  while (events.length > 0) {
    const ev = events.shift();
    if (ev.type === 'carStolen') {
      addHeat(state.wanted, ev.heat || 25);
      state.toasts.push({ text: 'Mobil dicuri! Polisi Pelabuhan waspada.', ttl: 3 });
    } else if (ev.type === 'missionComplete') {
      state.toasts.push({ text: `Misi selesai! Hadiah $${ev.reward}.`, ttl: 4 });
      saveGame(state); // autosave tiap misi selesai
    } else if (ev.type === 'missionStart') {
      state.toasts.push({ text: ev.intro, ttl: 5 });
    } else if (ev.type === 'busted') {
      busted(state, 'Polisi Pelabuhan menangkap Bara.');
    } else if (ev.type === 'playerHit' || ev.type === 'playerShot') {
      // Health sudah dikurangi modul penyerang; tidak ada aksi tambahan.
    }
  }
}

export function busted(state, reason) {
  if (state.screens.current === 'busted') return;
  state.player.money = Math.max(0, state.player.money - state.screens.bustedFine);
  state.player.health = 100;
  state.player.inCar = null;
  state.player.x = state.world.hospital.x;
  state.player.z = state.world.hospital.z;
  state.player.y = 0;
  clearWanted(state.wanted);
  state.police = [];
  state.thugs = [];
  state.missions.currentId = null;
  state.missions.started = false;
  state.toasts.push({ text: reason, ttl: 4 });
  setScreen(state.screens, 'busted');
}

export function startNextMission(state) {
  if (state.missions.currentId) return false;
  const next = nextMissionId(state.missions.completed);
  if (!next) return false;
  const mission = startMission(state.missions, next);
  addHeat(state.wanted, mission.wantedOnStart || 0);
  if (mission.thugs && !state.missions.thugsSpawned) {
    state.thugs = spawnThugs(mission.thugs);
    state.missions.thugsSpawned = true;
  }
  return true;
}
// --- akhir index.js (baris revisi ditambahkan lewat edit terpisah) ---
// Revisi terekam: urutan update sengaja pemain → combat → misi → preman
// → polisi → wanted, supaya panas dari aksi frame ini langsung mengatur
// jumlah polisi di frame yang sama (bukan tertinggal satu frame).
export function gameSnapshot(state) {
  return {
    player: { x: state.player.x, z: state.player.z, heading: state.player.heading, health: state.player.health, money: state.player.money, inCar: state.player.inCar },
    wantedStars: state.wanted.stars,
    police: state.police.length,
    thugsAlive: state.thugs.filter((t) => t.alive).length,
    missionsDone: state.missions.completed.length,
    screen: state.screens.current,
    helicopter: state.helicopter,
  };
}
