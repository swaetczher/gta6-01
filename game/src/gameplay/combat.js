// combat.js — Tarung ARUNIKA BAY.
//
// Dua senjata Bara:
//   fists  — "Tinju": jarak dekat (2,2 m), damage 10, tanpa peluru.
//   pistol — "Pistol Rakitan": jarak 26 m, damage 25, magasin 12/48.
//
// Musuh juga menyerang balik: preman memukul dari dekat (diatur
// enemies.js), dan — begitu Bara bersenjata api — musuh menembak dari jauh
// dengan jeda 1,6 detik per tembakan. Modul ini memegang senjata aktif,
// amunisi, dan penyelesaian serangan; targetnya berupa data biasa supaya
// tes Node bisa memanggilnya tanpa renderer.

export const WEAPON_FISTS = 'fists';
export const WEAPON_PISTOL = 'pistol';
export const WEAPONS = [WEAPON_FISTS, WEAPON_PISTOL];

// Nama yang tampil di HUD.
export const WEAPON_LABELS = {
  [WEAPON_FISTS]: 'Tinju',
  [WEAPON_PISTOL]: 'Pistol Rakitan',
};

// Jangkauan (meter), damage, dan jeda antar serangan (detik).
export const WEAPON_STATS = {
  [WEAPON_FISTS]: { range: 2.2, damage: 10, cooldown: 0.45, ammoPerShot: 0 },
  [WEAPON_PISTOL]: { range: 26, damage: 25, cooldown: 0.35, ammoPerShot: 1 },
};

// Magasin pistol: 12 peluru terisi, 48 cadangan.
export const PISTOL_MAG_SIZE = 12;
export const PISTOL_RESERVE_START = 48;

// Musuh menembak Bara tiap 1,6 detik bila dalam jarak tembak.
export const ENEMY_SHOOT_COOLDOWN = 1.6;
export const ENEMY_SHOOT_RANGE = 22;
export const ENEMY_SHOOT_DAMAGE = 6;

// Bara kebal sesaat setelah kena hit (detik) supaya tidak langsung mati.
export const PLAYER_HURT_IFRAMES = 0.6;

/** Jarak datar (XZ) antara dua titik. */
function flatDistance(ax, az, bx, bz) {
  const dx = ax - bx;
  const dz = az - bz;
  return Math.sqrt(dx * dx + dz * dz);
}

/** Apakah `name` senjata yang dikenal. */
export function isWeapon(name) {
  return WEAPONS.includes(name);
}

/** Label HUD untuk senjata. */
export function weaponLabel(name) {
  return WEAPON_LABELS[name] || WEAPON_LABELS[WEAPON_FISTS];
}

/**
 * Manajer tarung.
 *
 * @param {object} opts
 * @param {(event:object)=>void} [opts.onEvent] dipanggil saat senjata
 *   berganti, tembakan kosong, musuh tumbang, atau Bara tertembak
 * @param {(damage:number)=>void} [opts.onPlayerDamage] dipanggil saat Bara
 *   kena damage dari tembakan musuh
 * @param {()=>{x:number,z:number}} [opts.getPlayerPos] posisi Bara
 */
export function createCombat(opts = {}) {
  const emit = typeof opts.onEvent === 'function' ? opts.onEvent : null;
  const hurtPlayer = typeof opts.onPlayerDamage === 'function' ? opts.onPlayerDamage : null;
  const getPlayerPos =
    typeof opts.getPlayerPos === 'function' ? opts.getPlayerPos : () => ({ x: 0, z: 0 });

  let weapon = WEAPON_FISTS;
  let ammo = 0;
  let reserveAmmo = 0;
  let cooldownTimer = 0;
  let hurtTimer = 0;
  let defeated = 0;

  const api = {
    /** Senjata aktif: 'fists' | 'pistol'. */
    get weapon() {
      return weapon;
    },
    /** Peluru di magasin (0 untuk tinju). */
    get ammo() {
      return ammo;
    },
    /** Peluru cadangan pistol. */
    get reserveAmmo() {
      return reserveAmmo;
    },
    /** Label HUD senjata aktif. */
    get weaponLabel() {
      return weaponLabel(weapon);
    },
    /** Jumlah musuh yang ditumbangkan lewat combat ini. */
    get defeated() {
      return defeated;
    },
    /** Apakah Bara sedang dalam jeda kebal sesaat. */
    get isInvulnerable() {
      return hurtTimer > 0;
    },

    /** Ganti senjata. Pistol butuh amunisi — bila kosong, tetap tinju. */
    setWeapon(name) {
      if (!isWeapon(name)) return weapon;
      if (name === WEAPON_PISTOL && ammo <= 0 && reserveAmmo <= 0) {
        return weapon;
      }
      if (name !== weapon) {
        weapon = name;
        if (emit) emit({ type: 'weapon-change', weapon });
      }
      return weapon;
    },

    /** Isi ulang pistol dari cadangan (maksimal 12). */
    reload() {
      if (weapon !== WEAPON_PISTOL) return false;
      if (ammo >= PISTOL_MAG_SIZE || reserveAmmo <= 0) return false;
      const need = PISTOL_MAG_SIZE - ammo;
      const take = Math.min(need, reserveAmmo);
      ammo += take;
      reserveAmmo -= take;
      if (emit) emit({ type: 'reload', ammo, reserveAmmo });
      return true;
    },

    /** Tambah amunisi pistol (mis. dari peti / hadiah misi). */
    addAmmo(amount) {
      const n = Math.max(0, Math.floor(amount) || 0);
      if (n <= 0) return reserveAmmo;
      reserveAmmo += n;
      if (weapon === WEAPON_FISTS && ammo <= 0) {
        // Begitu punya peluru, pistol bisa dipakai.
        ammo = Math.min(PISTOL_MAG_SIZE, reserveAmmo);
        reserveAmmo -= ammo;
        weapon = WEAPON_PISTOL;
        if (emit) emit({ type: 'weapon-change', weapon });
      }
      return reserveAmmo;
    },

    /** Beri pistol rakitan ke Bara (hadiah awal M3). */
    givePistol() {
      ammo = PISTOL_MAG_SIZE;
      reserveAmmo = PISTOL_RESERVE_START;
      weapon = WEAPON_PISTOL;
      if (emit) emit({ type: 'weapon-change', weapon });
      return weapon;
    },

    /**
     * Serang dari posisi Bara ke arah `targets` (musuh/polisi berupa
     * `{x, z, alive}` beserta `damage(target, n)` bila tersedia).
     * @param {{x:number,z:number}} from posisi Bara
     * @param {Array} targets daftar target yang bisa diserang
     * @param {(target:object, damage:number)=>boolean} damageFn cara memberi damage
     * @returns {object|null} target yang kena, atau null
     */
    attack(from, targets, damageFn) {
      if (cooldownTimer > 0) return null;
      const stats = WEAPON_STATS[weapon];
      if (weapon === WEAPON_PISTOL) {
        if (ammo <= 0) {
          if (emit) emit({ type: 'dry-fire', weapon });
          this.reload();
          cooldownTimer = stats.cooldown;
          return null;
        }
        ammo -= stats.ammoPerShot;
      }
      cooldownTimer = stats.cooldown;
      const fx = from ? from.x || 0 : 0;
      const fz = from ? from.z || 0 : 0;
      let best = null;
      let bestDist = Infinity;
      for (const target of targets || []) {
        if (target && target.alive === false) continue;
        const d = flatDistance(fx, fz, target.x || 0, target.z || 0);
        if (d <= stats.range && d < bestDist) {
          bestDist = d;
          best = target;
        }
      }
      if (!best) return null;
      const apply = typeof damageFn === 'function' ? damageFn : null;
      const down = apply ? apply(best, stats.damage) : false;
      if (down) {
        defeated++;
        if (emit) emit({ type: 'target-down', weapon, defeated });
      } else if (emit) {
        emit({ type: 'hit', weapon, damage: stats.damage });
      }
      return best;
    },

    /** Bara kena damage langsung (pukulan / tembakan) — hormati iframes. */
    damagePlayer(amount) {
      if (hurtTimer > 0) return false;
      const n = Number(amount) || 0;
      if (n <= 0) return false;
      hurtTimer = PLAYER_HURT_IFRAMES;
      if (hurtPlayer) hurtPlayer(n);
      if (emit) emit({ type: 'player-hurt', damage: n });
      return true;
    },

    /**
     * Musuh yang hidup menembak Bara tiap 1,6 detik bila dalam jarak.
     * @param {Array} enemies daftar musuh `{x, z, alive, shootTimer}`
     */
    enemyFire(dt, enemies) {
      const step = Math.max(0, dt || 0);
      const pos = getPlayerPos();
      for (const enemy of enemies || []) {
        if (!enemy || !enemy.alive) continue;
        enemy.shootTimer = Math.max(0, (enemy.shootTimer || 0) - step);
        const d = flatDistance(enemy.x || 0, enemy.z || 0, pos.x || 0, pos.z || 0);
        if (d <= ENEMY_SHOOT_RANGE && enemy.shootTimer <= 0) {
          enemy.shootTimer = ENEMY_SHOOT_COOLDOWN;
          if (emit) emit({ type: 'enemy-shot', kind: enemy.kind || 'grunt' });
          this.damagePlayer(ENEMY_SHOOT_DAMAGE);
        }
      }
    },

    /** Majukan semua timer satu frame. */
    update(dt) {
      const step = Math.max(0, dt || 0);
      cooldownTimer = Math.max(0, cooldownTimer - step);
      hurtTimer = Math.max(0, hurtTimer - step);
    },

    /** Cuplikan untuk save game. */
    snapshot() {
      return { weapon, ammo, reserveAmmo, defeated };
    },

    /** Pulihkan dari save game. */
    restore(data) {
      if (!data) return;
      if (isWeapon(data.weapon)) weapon = data.weapon;
      if (typeof data.ammo === 'number') ammo = Math.max(0, Math.floor(data.ammo));
      if (typeof data.reserveAmmo === 'number') {
        reserveAmmo = Math.max(0, Math.floor(data.reserveAmmo));
      }
      if (typeof data.defeated === 'number') defeated = Math.max(0, Math.floor(data.defeated));
    },
  };
  return api;
}
