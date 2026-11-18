// index.js — Orkestrator gameplay ARUNIKA BAY.
//
// `createGameplay(ctx)` merakit semua modul gameplay menjadi satu game yang
// jalan: pemain, polisi, preman, tarung, misi, wanted, HUD, layar, dan save.
// Kontrak (lihat CONTRACT.md):
//   ctx = { THREE, scene, world, input, onEvent }
//   kembali { update(dt), state, missions, player, police, wanted, hud }
//   (+ enemies, combat, save, screens, adapter sebagai tambahan untuk
//   staging shot di main.js — A memakainya untuk melahirkan preman/polisi
//   dan menyetel HUD di mode ?shot=).
//
// `state.screen` adalah satu-satunya sumber layar: menulisnya (mis.
// `state.screen = 'playing'` dari main.js saat mode vista) otomatis
// menyinkronkan modul screens + visibilitas #menu-screen.
//
// Alur layar: start -> (tombol mulai) -> playing -> (Esc/P) paused ->
// playing; playing -> (nyawa 0 / tertangkap) busted; playing -> (5 misi
// selesai) complete. Autosave tiap 15 detik saat bermain + tiap misi
// selesai. Muat save lama otomatis saat game dibuat.

import { createWorldAdapter, districtAt, WAREHOUSE_SPOT, HIDEOUT_SPOT } from './world-adapter.js';
import { createPlayer, keyDown, PLAYER_MONEY_START } from './player.js';
import { createPolice } from './police.js';
import { createWanted, HEAT_FOR_STEAL, HEAT_FOR_KILL } from './wanted.js';
import { createEnemies } from './enemies.js';
import { createCombat } from './combat.js';
import { createMissions } from './missions.js';
import { createHud } from './hud.js';
import { createScreens, SCREENS } from './screens.js';
import { createSave } from './save.js';

/** Jeda autosave (detik) saat bermain. */
export const AUTOSAVE_INTERVAL = 15;

// Jarak pemicu syarat misi (meter).
export const MISSION_NEAR_KANCIL = 6;
export const MISSION_NEAR_WAREHOUSE = 5;
export const MISSION_NEAR_HIDEOUT = 8;

// M4: berapa detik bertahan dengan bintang >= 3 sebelum langkah 1 selesai.
export const M4_SURVIVE_SECONDS = 5;

/** Apakah `name` layar yang sah (re-ekspor untuk main.js). */
export function isGameScreen(name) {
  return SCREENS.includes(name);
}

/**
 * Rakit game dari konteks main.js.
 *
 * @param {object} ctx
 * @param {object} ctx.THREE pustaka three.js
 * @param {object} ctx.scene scene three.js
 * @param {object} ctx.world hasil `buildWorld(THREE, scene)`
 * @param {object} ctx.input objek tombol dari main.js
 * @param {(event:object)=>void} [ctx.onEvent] dipanggil untuk kejadian
 *   penting game (`mission-step`, `mission-complete`, `car-stolen`,
 *   `busted`, `complete`, `wanted-change`)
 */
export function createGameplay(ctx) {
  const THREE = ctx.THREE;
  const scene = ctx.scene;
  const world = ctx.world || {};
  const input = ctx.input || {};
  const emitExternal = typeof ctx.onEvent === 'function' ? ctx.onEvent : null;

  const adapter = createWorldAdapter(world);
  const hud = createHud();
  const save = createSave();

  // --- State game (satu sumber kebenaran untuk HUD + main.js). ---
  const state = {
    money: PLAYER_MONEY_START,
    health: 100,
    weapon: 'fists',
    ammo: 0,
    reserveAmmo: 0,
    wantedStars: 0,
    objective: '',
    dialog: '',
    district: 'Distrik Niaga',
    time: 0,
  };

  // Layar: properti state.screen menyinkronkan modul screens.
  let screenValue = 'start';
  const screens = createScreens({
    onStart: () => {
      screenValue = 'playing';
    },
    onResume: () => {
      screenValue = 'playing';
    },
    onRestart: () => {
      screenValue = 'playing';
    },
  });
  Object.defineProperty(state, 'screen', {
    enumerable: true,
    get() {
      return screenValue;
    },
    set(value) {
      if (!SCREENS.includes(value)) return;
      screenValue = value;
      screens.setScreen(value);
    },
  });

  /** Kirim kejadian ke luar (main.js) — tanpa pernah melempar. */
  function emit(event) {
    if (!emitExternal) return;
    try {
      emitExternal(event);
    } catch (_err) {
      // Pendengar main.js tidak boleh mematikan game.
    }
  }

  // --- Sub-sistem. ---
  const wanted = createWanted(0, (stars) => {
    state.wantedStars = stars;
    emit({ type: 'wanted-change', stars });
  });

  const police = createPolice(THREE, scene, (event) => {
    if (event && event.type === 'arrested') setBusted('Tertangkap polisi.');
  });

  const enemies = createEnemies(THREE, scene, (event) => {
    if (event && event.type === 'enemy-down') {
      wanted.addHeat(HEAT_FOR_KILL);
      emit(event);
    }
  });

  const player = createPlayer(THREE, scene, world, input, (event) => {
    if (!event) return;
    if (event.type === 'car-stolen') {
      wanted.addHeat(HEAT_FOR_STEAL);
      stolenKancil = true;
      emit(event);
    } else {
      emit(event);
    }
  });

  const combat = createCombat({
    onEvent: (event) => emit(event),
    onPlayerDamage: (damage) => player.damage(damage),
    getPlayerPos: () => ({ x: player.x, z: player.z }),
  });

  const missions = createMissions((event) => {
    if (!event) return;
    if (event.type === 'mission-complete') {
      state.money += event.reward || 0;
      if (event.mission === 'M3') combat.givePistol();
      autosave();
      if (missions.isComplete) setComplete();
    }
    emit(event);
  });

  // --- Pelacak progres misi (bendera + baseline hitungan). ---
  let stolenKancil = false;
  let defeatedBaseline = 0;
  let m4SurviveTimer = 0;
  let m4Entered = false;
  let m3GuardsSpawned = false;
  let m5GruntsSpawned = false;
  let m5BossSpawned = false;
  let bossRef = null;
  let lastMissionIndex = 0;
  let autosaveTimer = 0;
  let prevPause = false;
  let prevAttack = false;

  /** Pindah layar + spanduk layar akhir. */
  function setScreen(name) {
    state.screen = name;
  }

  function setBusted(reason) {
    if (state.screen !== 'playing') return;
    setScreen('busted');
    hud.showBanner('TERTANGKAP!');
    hud.showToast(reason || 'Bara Kelana tertangkap.');
    emit({ type: 'busted', reason: reason || '' });
    autosave();
  }

  function setComplete() {
    if (state.screen === 'complete') return;
    setScreen('complete');
    hud.showBanner('FAJAR TERBIT — ARUNIKA BAY');
    hud.showToast('Semua misi selesai — Arunika Bay bebas!');
    emit({ type: 'complete', money: state.money });
    autosave();
  }

  /** Simpan progres saat ini (diam bila gagal). */
  function autosave() {
    save.save(
      save.collect({
        money: state.money,
        player: player.snapshot(),
        missions: missions.snapshot(),
        wanted: wanted.snapshot(),
        combat: combat.snapshot(),
      }),
    );
  }

  /** Dipanggil sekali saat memasuki misi baru (efek samping per misi). */
  function enterMission(index) {
    if (index === 3 && !m4Entered) {
      // M4: polisi langsung memburu — panas naik ke 3 bintang.
      m4Entered = true;
      m4SurviveTimer = 0;
      wanted.setHeat(70);
      const near = adapter.findVehicleNear(player.x, player.z, 40);
      if (near) {
        police.spawnOfficer(player.x + 8, player.z + 6, 'chase');
        police.spawnOfficer(player.x - 8, player.z - 6, 'chase');
      } else {
        police.spawnOfficer(player.x + 8, player.z + 6, 'chase');
        police.spawnOfficer(player.x - 8, player.z - 6, 'chase');
      }
      state.dialog = 'Empat mobil polisi dan helikopter! Lewat kanal Pasar Terapung!';
    }
    if (index === 2 && !m3GuardsSpawned) {
      // M3: begitu sampai Dermaga, 3 preman menjaga gudang.
      m3GuardsSpawned = true;
      enemies.spawnGuards(WAREHOUSE_SPOT.x, WAREHOUSE_SPOT.z, 3);
      combat.givePistol();
    }
  }

  /** Cek syarat langkah misi aktif dari posisi + kejadian game. */
  function checkMissions(dt) {
    const mission = missions.current;
    if (!mission) return;
    if (missions.currentIndex !== lastMissionIndex) {
      lastMissionIndex = missions.currentIndex;
      state.dialog = missions.introText();
      enterMission(missions.currentIndex);
    }
    const step = missions.step;
    const district = state.district;

    if (mission.id === 'M1') {
      if (step === 0 && district === 'Alun-Alun Arunika') missions.advanceStep();
      else if (step === 1 && district === 'Kampung Lentera') missions.advanceStep();
      else if (step === 2 && district === 'Dermaga Arunika') missions.advanceStep();
      else if (step === 3 && district === 'Alun-Alun Arunika') missions.advanceStep();
    } else if (mission.id === 'M2') {
      if (step === 0) {
        const kancil = adapter.kancil();
        const dx = player.x - (kancil.x || 0);
        const dz = player.z - (kancil.z || 0);
        if (Math.sqrt(dx * dx + dz * dz) < MISSION_NEAR_KANCIL) missions.advanceStep();
      } else if (step === 1 && stolenKancil) {
        missions.advanceStep();
      } else if (step === 2 && player.inCar && district === 'Kampung Lentera') {
        missions.advanceStep();
      } else if (step === 3 && !player.inCar && district === 'Kampung Lentera' && stolenKancil) {
        missions.advanceStep();
      }
    } else if (mission.id === 'M3') {
      if (step === 0 && district === 'Dermaga Arunika') {
        enterMission(2);
        missions.advanceStep();
      } else if (step === 1 && enemies.defeatedCount() - defeatedBaseline >= 3) {
        defeatedBaseline = enemies.defeatedCount();
        missions.advanceStep();
      } else if (step === 2) {
        const dx = player.x - WAREHOUSE_SPOT.x;
        const dz = player.z - WAREHOUSE_SPOT.z;
        if (Math.sqrt(dx * dx + dz * dz) < MISSION_NEAR_WAREHOUSE) missions.advanceStep();
      } else if (step === 3) {
        const dx = player.x - WAREHOUSE_SPOT.x;
        const dz = player.z - WAREHOUSE_SPOT.z;
        if (
          Math.sqrt(dx * dx + dz * dz) < MISSION_NEAR_WAREHOUSE &&
          keyDown(input, 'action')
        ) {
          missions.advanceStep();
        }
      }
    } else if (mission.id === 'M4') {
      if (step === 0) {
        if (wanted.stars >= 3) {
          m4SurviveTimer += dt;
          if (m4SurviveTimer >= M4_SURVIVE_SECONDS) missions.advanceStep();
        }
      } else if (step === 1 && district === 'Pasar Terapung') {
        missions.advanceStep();
      } else if (step === 2 && wanted.stars <= 2) {
        missions.advanceStep();
      } else if (step === 3 && district === 'Alun-Alun Arunika' && wanted.stars === 0) {
        missions.advanceStep();
      }
    } else if (mission.id === 'M5') {
      if (step === 0) {
        const dx = player.x - HIDEOUT_SPOT.x;
        const dz = player.z - HIDEOUT_SPOT.z;
        if (Math.sqrt(dx * dx + dz * dz) < MISSION_NEAR_HIDEOUT) {
          if (!m5GruntsSpawned) {
            m5GruntsSpawned = true;
            defeatedBaseline = enemies.defeatedCount();
            enemies.spawnGuards(HIDEOUT_SPOT.x, HIDEOUT_SPOT.z, 4);
          }
          missions.advanceStep();
        }
      } else if (step === 1 && enemies.defeatedCount() - defeatedBaseline >= 4) {
        defeatedBaseline = enemies.defeatedCount();
        if (!m5BossSpawned) {
          m5BossSpawned = true;
          bossRef = enemies.spawnBoss(HIDEOUT_SPOT.x + 4, HIDEOUT_SPOT.z);
        }
        missions.advanceStep();
      } else if (step === 2 && bossRef && !bossRef.alive) {
        missions.advanceStep();
      } else if (step === 3) {
        const dx = player.x - HIDEOUT_SPOT.x;
        const dz = player.z - HIDEOUT_SPOT.z;
        if (
          Math.sqrt(dx * dx + dz * dz) < MISSION_NEAR_HIDEOUT &&
          keyDown(input, 'action')
        ) {
          missions.advanceStep();
        }
      }
    }
  }

  /** Pulihkan progres dari save lama (bila ada). */
  function restoreSave() {
    const data = save.load();
    if (!data) return false;
    if (typeof data.money === 'number') state.money = Math.max(0, Math.floor(data.money));
    if (data.player) player.restore(data.player);
    if (data.missions) missions.restore(data.missions);
    if (data.wanted) wanted.restore(data.wanted);
    if (data.combat) combat.restore(data.combat);
    lastMissionIndex = missions.currentIndex;
    state.dialog = missions.introText();
    return true;
  }

  /** Satu frame game. */
  function update(dt) {
    const step = Math.max(0, dt || 0);
    state.time += step;

    // Jeda (Esc/P) — deteksi tepi tombol, bukan level.
    const pauseNow = keyDown(input, 'pause');
    if (pauseNow && !prevPause) {
      if (state.screen === 'playing' || state.screen === 'paused') {
        screens.togglePause();
        screenValue = screens.screen;
      }
    }
    prevPause = pauseNow;

    if (state.screen !== 'playing') {
      hud.update({
        money: state.money,
        health: player.health,
        weapon: combat.weaponLabel,
        ammo: combat.ammo,
        reserveAmmo: combat.reserveAmmo,
        wantedStars: wanted.stars,
        objective: missions.objectiveText(),
        dialog: state.dialog,
        district: state.district,
      });
      return;
    }

    // Serang (Space/klik) — deteksi tepi tombol.
    const attackNow = keyDown(input, 'attack');
    if (attackNow && !prevAttack) {
      combat.attack({ x: player.x, z: player.z }, enemies.list, (target, damage) =>
        enemies.damage(target, damage),
      );
    }
    prevAttack = attackNow;

    player.update(step);
    enemies.update(step, { x: player.x, z: player.z }, (damage) => player.damage(damage));
    combat.update(step);
    combat.enemyFire(step, enemies.list);
    const arrest = police.update(step, { x: player.x, z: player.z }, wanted.stars);
    wanted.decay(step);

    // Sinkron state dari sub-sistem.
    state.health = player.health;
    state.weapon = combat.weaponLabel;
    state.ammo = combat.ammo;
    state.reserveAmmo = combat.reserveAmmo;
    state.wantedStars = wanted.stars;
    state.district = districtAt(player.x, player.z);
    state.objective = missions.objectiveText();

    checkMissions(step);

    // Bara kehabisan nyawa -> tertangkap.
    if (player.health <= 0) {
      setBusted('Bara Kelana kehabisan nyawa.');
    } else if (arrest === 'arrest') {
      setBusted('Tertangkap polisi.');
    }

    // Autosave berkala saat bermain.
    autosaveTimer += step;
    if (autosaveTimer >= AUTOSAVE_INTERVAL) {
      autosaveTimer = 0;
      autosave();
    }

    hud.update({
      money: state.money,
      health: state.health,
      weapon: state.weapon,
      ammo: state.ammo,
      reserveAmmo: state.reserveAmmo,
      wantedStars: state.wantedStars,
      objective: state.objective,
      dialog: state.dialog,
      district: state.district,
    });
    hud.drawMinimap(adapter, player, police, enemies);
  }

  // --- Mulai: ikat tombol, muat save, tulis HUD awal. ---
  screens.bind();
  restoreSave();
  state.objective = missions.objectiveText();
  state.dialog = missions.introText();
  state.district = districtAt(player.x, player.z);
  hud.update({
    money: state.money,
    health: player.health,
    weapon: combat.weaponLabel,
    ammo: combat.ammo,
    reserveAmmo: combat.reserveAmmo,
    wantedStars: wanted.stars,
    objective: state.objective,
    dialog: state.dialog,
    district: state.district,
  });

  return {
    update,
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
  };
}
