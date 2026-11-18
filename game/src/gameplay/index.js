// index.js — Perakit gameplay ARUNIKA BAY.
// createGameplay(ctx) menerima { THREE, scene, world, input, onEvent }
// dan mengembalikan semua yang dibutuhkan main.js: update(dt) per frame,
// state layar/uang/nyawa, dan modul-modul (missions, player, police,
// wanted, hud, enemies, combat, save, screens, adapter).
// Modul gameplay TIDAK mengimpor apa pun dari folder world.

import { createPlayer } from './player.js';
import { createPolice } from './police.js';
import { createWanted } from './wanted.js';
import { createMissions } from './missions.js';
import { createCombat } from './combat.js';
import { createEnemies } from './enemies.js';
import { createHud } from './hud.js';
import { createScreens } from './screens.js';
import { createSave } from './save.js';
import { createAdapter } from './world-adapter.js';

export const AUTOSAVE_INTERVAL = 15;
export const START_MONEY = 50;

export function createGameplay(ctx = {}) {
  const THREE = ctx.THREE || null;
  const scene = ctx.scene || null;
  const world = ctx.world || {};
  const input = ctx.input || {};
  const onEvent = typeof ctx.onEvent === 'function' ? ctx.onEvent : null;

  function emit(type, payload) {
    if (onEvent) onEvent({ type, ...(payload || {}) });
  }

  const adapter = createAdapter(world);
  const save = createSave();
  const hud = createHud();
  const screens = createScreens({
    onChange: (next) => { state.screen = next; },
  });

  const state = {
    screen: 'start',
    money: START_MONEY,
    health: 100,
    weapon: 'fists',
    ammo: Infinity,
    reserveAmmo: 48,
    objective: '',
    dialog: '',
    district: 'Alun-Alun Arunika',
    time: 0,
  };

  const player = createPlayer({
    adapter,
    input,
    start: adapter.spawnPlayer(),
    onEvent: (event) => {
      if (event.type === 'car-stolen') {
        wanted.addHeat(25);
        emit('car-stolen', event);
      }
    },
  });

  const wanted = createWanted({
    onChange: ({ heat, stars }) => emit('wanted-change', { heat, stars }),
  });

  const police = createPolice({
    THREE,
    scene,
    getPlayer: () => player,
    onArrest: () => api.busted(),
  });

  const enemies = createEnemies({
    THREE,
    scene,
    getPlayer: () => player,
    onHitPlayer: (damage) => combat.hurtPlayer(damage),
    onEnemyDown: (enemy) => {
      wanted.addHeat(4);
      emit('enemy-down', { enemy });
    },
  });

  const combat = createCombat({
    getPlayer: () => player,
    enemies,
    onEvent: (event) => emit(event.type, event),
    onPlayerHurt: (_damage, health) => {
      if (health <= 0) api.busted();
    },
  });

  const missions = createMissions({
    onEvent: (event) => {
      if (event.type === 'mission-complete') {
        state.money += event.reward;
        hud.setMoney(state.money);
      }
      if (event.type === 'complete') {
        api.complete();
      }
      emit(event.type, event);
    },
  });

  state.objective = missions.objectiveText();

  // Muat simpanan lama bila ada — tanpa menimpa bila datanya kosong.
  function loadSave() {
    const data = save.load();
    if (!data) return false;
    state.money = data.money ?? START_MONEY;
    player.health = data.health ?? 100;
    player.setPosition(data.x ?? 0, data.z ?? 0, data.yaw ?? 0);
    missions.restore({ current: data.mission ?? 0, step: data.step ?? 0, done: data.missionsDone });
    wanted.setHeat(data.wantedHeat ?? 0);
    state.objective = missions.objectiveText();
    return true;
  }

  function snapshot() {
    return {
      money: state.money,
      health: player.health,
      mission: missions.current,
      step: missions.step,
      missionsDone: missions.snapshot().done,
      wantedHeat: wanted.heat,
      x: player.x,
      z: player.z,
      yaw: player.yaw,
    };
  }

  let autosaveTimer = 0;

  const api = {
    state,
    missions,
    player,
    police,
    wanted,
    hud,
    enemies,
    combat,
    save,
    screens,
    adapter,
    get autosaveTimer() { return autosaveTimer; },

    start() {
      screens.start();
      state.screen = 'playing';
      hud.setMoney(state.money);
      hud.setHealth(player.health);
      hud.setWanted(wanted.stars);
      hud.setObjective(missions.objectiveText());
      hud.setWeapon(combat.weaponName, combat.ammo, combat.reserve);
      return state.screen;
    },

    pause() {
      screens.pause();
      state.screen = screens.screen;
      return state.screen;
    },

    resume() {
      screens.resume();
      state.screen = screens.screen;
      return state.screen;
    },

    busted() {
      if (state.screen === 'busted') return state.screen;
      screens.busted();
      state.screen = 'busted';
      hud.setDialog('Bara tertangkap polisi. Arunika Bay masih menunggu fajar.');
      save.save(snapshot());
      emit('busted', { money: state.money });
      return state.screen;
    },

    complete() {
      if (state.screen === 'complete') return state.screen;
      screens.complete();
      state.screen = 'complete';
      hud.showBanner('FAJAR TERBIT — ARUNIKA BAY');
      hud.showToast('Semua misi selesai — Arunika Bay bebas!');
      save.save(snapshot());
      emit('complete', { money: state.money });
      return state.screen;
    },

    // Maju satu frame permainan.
    update(dt) {
      const step = Math.max(0, dt);
      state.time += step;
      if (state.screen !== 'playing') return state;
      player.update(step);
      police.update(step);
      enemies.update(step);
      combat.update(step, input);
      const trouble = police.countByState().chase > 0;
      wanted.update(step, trouble);
      state.health = player.health;
      state.weapon = combat.weapon;
      state.ammo = combat.ammo;
      state.reserveAmmo = combat.reserve;
      state.objective = missions.objectiveText();
      state.district = adapter.districtAt(player.x, player.z);
      hud.setWanted(wanted.stars);
      hud.setMoney(state.money);
      hud.setHealth(state.health);
      hud.setWeapon(combat.weaponName, combat.ammo, combat.reserve);
      hud.setObjective(state.objective);
      hud.setDistrict(state.district);
      hud.drawMinimap({
        playerX: player.x,
        playerZ: player.z,
        police: police.officers,
        enemies: enemies.list.filter((e) => e.hp > 0),
        vehicles: adapter.vehicles,
      });
      autosaveTimer += step;
      if (autosaveTimer >= AUTOSAVE_INTERVAL) {
        autosaveTimer = 0;
        save.save(snapshot());
      }
      if (player.health <= 0) api.busted();
      return state;
    },

    snapshot,
    loadSave,

    // Pulihkan state dari snapshot simpanan (dipakai loadSave dan tes).
    restoreSnapshot(data) {
      if (!data || typeof data !== 'object') return false;
      state.money = data.money ?? START_MONEY;
      player.health = data.health ?? 100;
      player.setPosition(data.x ?? 0, data.z ?? 0, data.yaw ?? 0);
      missions.restore({ current: data.mission ?? 0, step: data.step ?? 0, done: data.missionsDone });
      wanted.setHeat(data.wantedHeat ?? 0);
      state.objective = missions.objectiveText();
      return true;
    },
  };

  loadSave();
  return api;
}
