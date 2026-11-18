// combat.js — Combat Arunika Bay: tinju jarak dekat + pistol.
// Logika murni: hit detection memakai jarak + kerucut arah hadap pemain.
// Senjata, magazin, reload, dan damage semuanya data di WEAPONS.
export const WEAPONS = {
  fists: {
    name: 'Tinju',
    kind: 'melee',
    range: 1.8,
    damage: 15,
    arc: 1.1, // radian setengah-kerucut di depan pemain
    cooldown: 0.45,
    mag: Infinity,
  },
  pistol: {
    name: 'Pistol Rakitan',
    kind: 'gun',
    range: 42,
    damage: 34,
    arc: 0.16,
    cooldown: 0.28,
    mag: 12,
    reloadSeconds: 1.4,
  },
};

export function createCombat() {
  return {
    weapon: 'fists',
    ammo: 12,
    ammoReserve: 48,
    cooldown: 0,
    reloading: 0, // detik tersisa, 0 = tidak reload
  };
}

export function switchWeapon(combat, name) {
  if (!WEAPONS[name]) return false;
  if (combat.reloading > 0) return false;
  combat.weapon = name;
  return true;
}

export function startReload(combat) {
  const w = WEAPONS[combat.weapon];
  if (w.kind !== 'gun' || combat.reloading > 0) return false;
  if (combat.ammo >= w.mag || combat.ammoReserve <= 0) return false;
  combat.reloading = w.reloadSeconds;
  return true;
}

export function updateCombat(combat, dt) {
  if (combat.cooldown > 0) combat.cooldown -= dt;
  if (combat.reloading > 0) {
    combat.reloading -= dt;
    if (combat.reloading <= 0) {
      combat.reloading = 0;
      const w = WEAPONS[combat.weapon];
      const need = w.mag - combat.ammo;
      const take = Math.min(need, combat.ammoReserve);
      combat.ammo += take;
      combat.ammoReserve -= take;
    }
  }
}

// Sudut antara arah hadap dan arah ke target, 0..PI.
export function angleToTarget(px, pz, heading, tx, tz) {
  const want = Math.atan2(tx - px, tz - pz);
  let d = want - heading;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return Math.abs(d);
}

// Serang: kembalikan daftar target yang kena (dengan damage).
// targets: [{ id, x, z, health, alive }]. Tinju butuh dekat + di depan;
// pistol butuh dalam jarak + nyaris segaris dengan arah hadap.
export function attack(combat, px, pz, heading, targets) {
  const w = WEAPONS[combat.weapon];
  if (combat.cooldown > 0 || combat.reloading > 0) return [];
  if (w.kind === 'gun' && combat.ammo <= 0) {
    startReload(combat);
    return [];
  }
  combat.cooldown = w.cooldown;
  if (w.kind === 'gun') combat.ammo -= 1;
  const hits = [];
  for (const t of targets) {
    if (!t || t.alive === false || t.health <= 0) continue;
    const dist = Math.hypot(t.x - px, t.z - pz);
    if (dist > w.range) continue;
    if (angleToTarget(px, pz, heading, t.x, t.z) > w.arc) continue;
    t.health -= w.damage;
    if (t.health <= 0) {
      t.health = 0;
      t.alive = false;
    }
    hits.push({ id: t.id, damage: w.damage, killed: t.health <= 0 });
  }
  return hits;
}

// Tembakan musuh ke pemain: musuh menembak bila dalam jarak + menghadap pemain.
export function enemyShootAt(enemy, player, dt, state) {
  enemy.shootCooldown = (enemy.shootCooldown || 0) - dt;
  if (enemy.shootCooldown > 0) return false;
  const dist = Math.hypot(player.x - enemy.x, player.z - enemy.z);
  if (dist > 30) return false;
  enemy.shootCooldown = 1.6;
  player.health = Math.max(0, player.health - 8);
  if (state && state.events) state.events.push({ type: 'playerShot', from: enemy.id });
  return true;
}
// --- akhir combat.js (baris revisi ditambahkan lewat edit terpisah) ---
// Revisi terekam: pistol otomatis mulai reload saat magazin habis, jadi
// pemain yang menahan tembak tidak terjebak tanpa peluru di tengah M3.
// Tinju tetap bisa dipakai kapan pun — senjata darurat Bara Kelana.
export function weaponLabel(combat) {
  const w = WEAPONS[combat.weapon];
  if (w.kind !== 'gun') return w.name;
  return combat.reloading > 0 ? `${w.name} — ISI ULANG...` : `${w.name} ${combat.ammo}/${combat.ammoReserve}`;
}
