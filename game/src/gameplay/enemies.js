// enemies.js — Preman sindikat "Ombak Hitam" (anak buah Rangga Samudra).
// Mengejar pemain bila dekat, memukul bila menempel, bisa dikalahkan
// dengan tinju atau pistol. Dipakai di M3 (gudang) dan M5 (markas).
export const THUG_SPEED = 3.9;
export const THUG_PUNCH_RANGE = 1.7;
export const THUG_PUNCH_DAMAGE = 9;
export const THUG_PUNCH_COOLDOWN = 1.1;
export const THUG_AGGRO_RANGE = 26;

export function createThug(id, x, z, health) {
  return {
    id,
    x,
    z,
    heading: 0,
    health: typeof health === 'number' ? health : 60,
    alive: true,
    state: 'guard', // guard | chase | attack
    punchCooldown: 0,
    shootCooldown: 0,
    armed: false, // preman bersenjata api hanya di M5
  };
}

export function spawnThugs(defs) {
  return (defs || []).map((d, i) => {
    const thug = createThug(d.id || `preman-${i + 1}`, d.x, d.z, d.health || 60);
    thug.boss = !!d.boss;
    thug.armed = !!d.armed;
    return thug;
  });
}

export function updateThugs(thugs, player, dt, world, events) {
  for (const thug of thugs) {
    if (!thug.alive) continue;
    if (thug.punchCooldown > 0) thug.punchCooldown -= dt;
    const dist = Math.hypot(player.x - thug.x, player.z - thug.z);
    if (thug.state === 'guard' && dist < THUG_AGGRO_RANGE) thug.state = 'chase';
    if (thug.state === 'chase') {
      if (dist > THUG_PUNCH_RANGE) {
        const dx = player.x - thug.x;
        const dz = player.z - thug.z;
        const len = Math.hypot(dx, dz) || 1;
        thug.heading = Math.atan2(dx, dz);
        const nx = thug.x + (dx / len) * THUG_SPEED * dt;
        const nz = thug.z + (dz / len) * THUG_SPEED * dt;
        const solved = world.resolveCircle(nx, nz, 0.45);
        thug.x = solved.x;
        thug.z = solved.z;
      } else {
        thug.state = 'attack';
      }
    }
    if (thug.state === 'attack') {
      if (dist > THUG_PUNCH_RANGE + 0.4) {
        thug.state = 'chase';
      } else if (thug.punchCooldown <= 0) {
        thug.punchCooldown = THUG_PUNCH_COOLDOWN;
        player.health = Math.max(0, player.health - THUG_PUNCH_DAMAGE);
        if (events) events.push({ type: 'playerHit', from: thug.id, damage: THUG_PUNCH_DAMAGE });
      }
    }
  }
  return thugs;
}

export function thugsAlive(thugs) {
  return thugs.filter((t) => t.alive).length;
}

export function allThugsDefeated(thugs) {
  return thugs.length > 0 && thugs.every((t) => !t.alive);
}
// --- akhir enemies.js (baris revisi ditambahkan lewat edit terpisah) ---
// Revisi terekam: preman penjaga tidak mengejar sampai ke ujung kota —
// bila pemain lari lebih dari 40 m, preman kembali ke posisi jaga supaya
// M3 tidak berubah jadi kejar-kejaran tanpa akhir di luar gudang.
export function thugLeashCheck(thug, homeX, homeZ) {
  if (Math.hypot(thug.x - homeX, thug.z - homeZ) > 40) {
    thug.state = 'guard';
    return true;
  }
  return false;
}
