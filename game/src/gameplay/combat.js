// combat.js — Tinju dan Pistol Rakitan Bara Kelana.
// Tinju gratis, jarak dekat, tanpa amunisi. Pistol Rakitan menembak
// jauh, memakai peluru magasin 12/48, dan butuh isi ulang. Modul ini
// juga mengatur tembakan balasan preman (tiap 1,6 detik) dan masa
// kebal singkat Bara setelah kena pukul (0,6 detik).

export const WEAPONS = {
  fists: { name: 'Tinju', range: 2.3, damage: 12, rate: 0.45, ammo: Infinity },
  pistol: { name: 'Pistol Rakitan', range: 26, damage: 25, rate: 0.28, ammo: 12 },
};
export const PISTOL_MAG = 12;
export const PISTOL_RESERVE_START = 48;
export const IFRAMES = 0.6;
export const ENEMY_SHOOT_COOLDOWN = 1.6;
export const ENEMY_SHOOT_RANGE = 30;
export const RELOAD_TIME = 1.2;

export function createCombat(opts = {}) {
  const getPlayer = typeof opts.getPlayer === 'function' ? opts.getPlayer : () => null;
  const enemies = opts.enemies || null;
  const onEvent = typeof opts.onEvent === 'function' ? opts.onEvent : null;
  const onPlayerHurt = typeof opts.onPlayerHurt === 'function' ? opts.onPlayerHurt : null;
  const onEnemyDown = typeof opts.onEnemyDown === 'function' ? opts.onEnemyDown : null;
  let weapon = 'fists';
  let ammo = PISTOL_MAG;
  let reserve = PISTOL_RESERVE_START;
  let attackTimer = 0;
  let reloadTimer = 0;
  let invulnerableTimer = 0;
  let enemyShootTimer = 0;

  function emit(type, payload) {
    if (onEvent) onEvent({ type, ...payload });
  }

  const api = {
    get weapon() { return weapon; },
    get weaponName() { return WEAPONS[weapon].name; },
    get ammo() { return weapon === 'pistol' ? ammo : Infinity; },
    get reserve() { return reserve; },
    get reloading() { return reloadTimer > 0; },
    get invulnerable() { return invulnerableTimer > 0; },

    setWeapon(next) {
      if (!WEAPONS[next]) return weapon;
      weapon = next;
      reloadTimer = 0;
      attackTimer = 0;
      return weapon;
    },

    // Lukai Bara, tapi hormati masa kebal. Kembalikan true bila luka masuk.
    hurtPlayer(amount) {
      if (invulnerableTimer > 0) return false;
      const player = getPlayer();
      if (!player) return false;
      invulnerableTimer = IFRAMES;
      const dmg = Math.max(1, Math.round(amount));
      player.health = Math.max(0, (player.health ?? 100) - dmg);
      if (onPlayerHurt) onPlayerHurt(dmg, player.health);
      emit('player-hurt', { damage: dmg, health: player.health });
      return true;
    },

    // Isi ulang magasin pistol dari cadangan. Kembalikan true bila mulai isi.
    startReload() {
      if (weapon !== 'pistol' || reloadTimer > 0) return false;
      if (ammo >= PISTOL_MAG || reserve <= 0) return false;
      reloadTimer = RELOAD_TIME;
      emit('reload-start', {});
      return true;
    },

    // Satu serangan ke arah depan Bara. Kembalikan musuh yang kena, atau null.
    attack() {
      if (attackTimer > 0 || reloadTimer > 0) return null;
      const player = getPlayer();
      if (!player || !enemies) return null;
      const def = WEAPONS[weapon];
      if (weapon === 'pistol' && ammo <= 0) {
        api.startReload();
        return null;
      }
      attackTimer = def.rate;
      if (weapon === 'pistol') ammo -= 1;

      if (weapon === 'pistol' && ammo <= 0) api.startReload();
      if (weapon === 'pistol') emit('shot-fired', { ammo, reserve });
      // Cari musuh hidup terdekat di dalam jangkauan senjata.
      const target = enemies.nearestAlive(player.x, player.z, def.range);
      if (!target) return null;
      const down = enemies.damage(target, def.damage);
      emit('hit', { enemy: target, damage: def.damage, down });
      if (down && onEnemyDown) onEnemyDown(target);
      return target;
    },

    // Tembakan balasan: preman menembak tiap 1,6 detik bila Bara dekat.
    enemyFire(dt) {
      if (!enemies) return;
      enemyShootTimer -= Math.max(0, dt);
      if (enemyShootTimer > 0) return;
      enemyShootTimer = ENEMY_SHOOT_COOLDOWN;
      const player = getPlayer();
      if (!player) return;
      const shooter = enemies.nearestAlive(player.x, player.z, ENEMY_SHOOT_RANGE);
      if (!shooter) return;
      emit('enemy-shot', { enemy: shooter });
      api.hurtPlayer(6);
    },

    // Maju satu frame: timer serangan, isi ulang, masa kebal, tembakan musuh.
    update(dt, input) {
      const step = Math.max(0, dt);
      attackTimer = Math.max(0, attackTimer - step);
      invulnerableTimer = Math.max(0, invulnerableTimer - step);
      if (reloadTimer > 0) {
        reloadTimer -= step;
        if (reloadTimer <= 0) {
          reloadTimer = 0;
          const need = PISTOL_MAG - ammo;
          const take = Math.min(need, reserve);
          ammo += take;
          reserve -= take;
          emit('reload-done', { ammo, reserve });
        }
      }
      if (input && keyDownCombat(input)) {
        api.attack();
      }
      api.enemyFire(step);
      return { weapon, ammo, reserve };
    },
  };

  return api;
}

// Tombol serang: spasi, klik, atau boolean attack — alias yang sama
// dengan yang dipakai player.js, ditulis ulang di sini supaya combat
// tidak bergantung pada modul pemain.
function keyDownCombat(input) {
  if (!input) return false;
  if (input.keys instanceof Set) {
    return input.keys.has('attack') || input.keys.has('Space') || input.keys.has(' ');
  }
  if (input.keys && typeof input.keys === 'object') {
    return Boolean(input.keys.attack || input.keys.Space || input.keys[' ']);
  }
  return Boolean(input.attack || input.Space || input[' ']);
}
