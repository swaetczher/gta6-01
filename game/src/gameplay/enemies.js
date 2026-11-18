// enemies.js — Preman "Ombak Hitam" dan bosnya, Rangga Samudra.
// Preman menjaga satu titik (pos jaga). Bila Bara mendekat, mereka
// mengejar dan memukul; bila Bara menjauh, mereka kembali ke posnya.
// Bos Rangga lebih kuat, lebih cepat, dan tidak pernah kabur.

export const ENEMY_KINDS = {
  grunt: { hp: 30, speed: 3.1, damage: 8, range: 1.5, color: 0xb91c1c },
  bruiser: { hp: 55, speed: 2.6, damage: 12, range: 1.6, color: 0x7c2d12 },
  boss: { hp: 150, speed: 3.8, damage: 16, range: 1.8, color: 0x4c1d95 },
};
export const AGGRO_RANGE = 18;
export const ENEMY_HIT_COOLDOWN = 1.6;

export function createEnemies(opts = {}) {
  const THREE = opts.THREE || null;
  const scene = opts.scene || null;
  const getPlayer = typeof opts.getPlayer === 'function' ? opts.getPlayer : () => null;
  const onHitPlayer = typeof opts.onHitPlayer === 'function' ? opts.onHitPlayer : null;
  const onEnemyDown = typeof opts.onEnemyDown === 'function' ? opts.onEnemyDown : null;
  const list = [];
  let nextId = 1;

  // Boneka preman: badan warna geng + kepala. Bos memakai warna ungu.
  function buildMesh(kind) {
    if (!THREE || !scene) return null;
    const def = ENEMY_KINDS[kind] || ENEMY_KINDS.grunt;
    const group = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.66, 1.1, 0.38),
      new THREE.MeshLambertMaterial({ color: def.color }),
    );
    body.position.y = 0.98;
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.27, 10, 8),
      new THREE.MeshLambertMaterial({ color: 0xd9a066 }),
    );
    head.position.y = 1.76;
    group.add(body);
    group.add(head);
    scene.add(group);
    return group;
  }

  function placeMesh(enemy) {
    if (!enemy.mesh) return;
    enemy.mesh.position.set(enemy.x, 0, enemy.z);
    enemy.mesh.rotation.y = enemy.heading;
  }

  function distanceToPlayer(enemy) {
    const p = getPlayer();
    if (!p) return Infinity;
    const dx = p.x - enemy.x;
    const dz = p.z - enemy.z;
    return Math.hypot(dx, dz);
  }

  const api = {
    list,
    get aliveCount() { return list.filter((e) => e.hp > 0).length; },

    // Lahirkan satu musuh di (x, z). opts: kind, hp, name, guardX/guardZ.
    spawn(x, z, opts2 = {}) {
      const kind = ENEMY_KINDS[opts2.kind] ? opts2.kind : 'grunt';
      const def = ENEMY_KINDS[kind];
      const enemy = {
        id: nextId++,
        kind,
        name: opts2.name || (kind === 'boss' ? 'Rangga Samudra' : 'Preman Ombak Hitam'),
        x: Number(x) || 0,
        z: Number(z) || 0,
        guardX: opts2.guardX ?? (Number(x) || 0),
        guardZ: opts2.guardZ ?? (Number(z) || 0),
        heading: Math.random() * Math.PI * 2,
        hp: opts2.hp ?? def.hp,
        maxHp: opts2.hp ?? def.hp,
        speed: opts2.speed ?? def.speed,
        damage: opts2.damage ?? def.damage,
        range: opts2.range ?? def.range,
        hitTimer: 0,
        state: 'guard',
        mesh: null,
      };
      enemy.mesh = buildMesh(kind);
      placeMesh(enemy);
      list.push(enemy);
      return enemy;
    },

    // Lahirkan n penjaga melingkar di sekitar (x, z) — dipakai staging heist.
    spawnGuards(x, z, count = 3) {
      const made = [];
      const n = Math.max(1, Math.min(8, Math.round(count) || 3));
      for (let i = 0; i < n; i++) {
        const angle = (i / n) * Math.PI * 2;
        const gx = x + Math.cos(angle) * 6;
        const gz = z + Math.sin(angle) * 6;
        made.push(api.spawn(gx, gz, { kind: 'grunt', guardX: gx, guardZ: gz }));
      }
      return made;
    },

    // Lahirkan bos Rangga Samudra di (x, z).
    spawnBoss(x, z) {
      return api.spawn(x, z, { kind: 'boss', name: 'Rangga Samudra' });
    },

    // Lukai satu musuh. Kembalikan true bila musuh itu tumbang karenanya.
    damage(enemy, amount) {
      if (!enemy || enemy.hp <= 0) return false;
      enemy.hp = Math.max(0, enemy.hp - Math.max(0, Number(amount) || 0));
      if (enemy.hp === 0) {
        if (onEnemyDown) onEnemyDown(enemy);
        if (enemy.mesh && scene) scene.remove(enemy.mesh);
        enemy.mesh = null;
      }
      return enemy.hp === 0;
    },

    // Musuh hidup terdekat dari satu titik (dipakai combat jarak dekat).
    nearestAlive(x, z, maxDist = Infinity) {
      let best = null;
      let bestDist = maxDist;
      for (const e of list) {
        if (e.hp <= 0) continue;
        const d = Math.hypot(e.x - x, e.z - z);
        if (d < bestDist) {
          bestDist = d;
          best = e;
        }
      }
      return best;
    },

    removeAll() {
      for (const e of list) {
        if (e.mesh && scene) scene.remove(e.mesh);
      }
      list.length = 0;
      return 0;
    },

    // Maju satu frame: kejar pemain bila dekat, pukul bila sampai,
    // kembali ke pos jaga bila pemain menjauh.
    update(dt) {
      const step = Math.max(0, dt);
      const p = getPlayer();
      for (const e of list) {
        if (e.hp <= 0) continue;
        e.hitTimer = Math.max(0, e.hitTimer - step);
        const dist = distanceToPlayer(e);
        if (p && dist <= AGGRO_RANGE) {
          e.state = 'chase';
          const dx = p.x - e.x;
          const dz = p.z - e.z;
          const len = Math.hypot(dx, dz) || 1;
          e.heading = Math.atan2(dx, dz);
          if (dist > e.range) {
            e.x += (dx / len) * e.speed * step;
            e.z += (dz / len) * e.speed * step;
          } else if (e.hitTimer <= 0) {
            e.hitTimer = ENEMY_HIT_COOLDOWN;
            if (onHitPlayer) onHitPlayer(e.damage, e);
          }
        } else {
          // Kembali ke pos jaga, pelan-pelan.
          e.state = 'guard';
          const dx = e.guardX - e.x;
          const dz = e.guardZ - e.z;
          const len = Math.hypot(dx, dz);
          if (len > 0.4) {
            e.heading = Math.atan2(dx, dz);
            e.x += (dx / len) * e.speed * 0.55 * step;
            e.z += (dz / len) * e.speed * 0.55 * step;
          }
        }
        placeMesh(e);
      }
      return list.length;
    },
  };

  return api;
}
