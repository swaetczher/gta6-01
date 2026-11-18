// enemies.js — Preman "Ombak Hitam" dan Rangga Samudra.
//
// Musuh di ARUNIKA BAY adalah anak buah Rangga Samudra yang menjaga gudang
// kontainer, markas, dan jalanan Dermaga. Ada dua jenis:
//   grunt — preman biasa (nyawa 30), mengejar dan memukul dari dekat.
//   boss  — Rangga Samudra sendiri (nyawa 150), lebih cepat dan lebih kuat.
//
// Musuh disimpan sebagai data (x, z, health, alive, state) + mesh THREE
// sederhana (kotak merah gelap). Menembak diatur combat.js — di sini hanya
// gerak, nyawa, dan hitungan yang masih hidup.

export const ENEMY_KIND_GRUNT = 'grunt';
export const ENEMY_KIND_BOSS = 'boss';

// Nyawa awal per jenis.
export const ENEMY_HEALTH_GRUNT = 30;
export const ENEMY_HEALTH_BOSS = 150;

// Kecepatan (meter/detik) dan jangkauan.
export const ENEMY_SPEED_GRUNT = 3.2;
export const ENEMY_SPEED_BOSS = 4.2;
export const ENEMY_AGGRO_RANGE = 18;
export const ENEMY_ATTACK_RANGE = 1.9;
export const ENEMY_ATTACK_DAMAGE = 8;
export const ENEMY_ATTACK_COOLDOWN = 1.2;

// Jarak lepas: musuh berhenti mengejar dan kembali ke titik jaga.
export const ENEMY_LEASH_RANGE = 34;

/** Nyawa awal untuk jenis musuh tertentu. */
export function healthForKind(kind) {
  return kind === ENEMY_KIND_BOSS ? ENEMY_HEALTH_BOSS : ENEMY_HEALTH_GRUNT;
}

/** Kecepatan untuk jenis musuh tertentu. */
export function speedForKind(kind) {
  return kind === ENEMY_KIND_BOSS ? ENEMY_SPEED_BOSS : ENEMY_SPEED_GRUNT;
}

/** Jarak datar (XZ) antara dua titik. */
function flatDistance(ax, az, bx, bz) {
  const dx = ax - bx;
  const dz = az - bz;
  return Math.sqrt(dx * dx + dz * dz);
}

/**
 * Bangun mesh musuh: badan kotak merah gelap + kepala. Bos diberi badan
 * lebih besar dan warna lebih pekat supaya terbaca dari jauh.
 */
export function buildEnemyMesh(THREE, kind) {
  const group = new THREE.Group();
  const isBoss = kind === ENEMY_KIND_BOSS;
  const cloth = new THREE.MeshLambertMaterial({
    color: isBoss ? 0x7f1d1d : 0x991b1b,
  });
  const skin = new THREE.MeshLambertMaterial({ color: 0xc98a5a });
  const scale = isBoss ? 1.25 : 1;
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.66, 1.0, 0.38), cloth);
  body.position.y = 0.98;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.44, 0.44), skin);
  head.position.y = 1.72;
  const legs = new THREE.Mesh(
    new THREE.BoxGeometry(0.52, 0.52, 0.34),
    new THREE.MeshLambertMaterial({ color: 0x1f2937 }),
  );
  legs.position.y = 0.26;
  group.add(body);
  group.add(head);
  group.add(legs);
  group.scale.setScalar(scale);
  return group;
}

/**
 * Manajer musuh. `THREE` dan `scene` boleh null di tes logika.
 *
 * @param {object} THREE pustaka three.js (atau stub di tes)
 * @param {object|null} scene scene three.js (atau null di tes)
 * @param {(event:object)=>void} [onEvent] dipanggil saat musuh tumbang / menyerang
 */
export function createEnemies(THREE, scene, onEvent) {
  const list = [];
  const emit = typeof onEvent === 'function' ? onEvent : null;

  function syncMesh(enemy) {
    if (!enemy.mesh) return;
    enemy.mesh.position.set(enemy.x, 0, enemy.z);
    enemy.mesh.rotation.y = enemy.heading;
  }

  const api = {
    list,

    /** Lahirkan satu musuh di (x, z). `opts.kind` = 'grunt' | 'boss'. */
    spawn(x, z, opts = {}) {
      const kind = opts.kind === ENEMY_KIND_BOSS ? ENEMY_KIND_BOSS : ENEMY_KIND_GRUNT;
      const enemy = {
        kind,
        x: Number(x) || 0,
        z: Number(z) || 0,
        homeX: Number(x) || 0,
        homeZ: Number(z) || 0,
        heading: Math.random() * Math.PI * 2,
        health: opts.health || healthForKind(kind),
        maxHealth: opts.health || healthForKind(kind),
        alive: true,
        state: 'guard',
        attackTimer: 0,
        shootTimer: 0,
        mesh: null,
      };
      if (THREE && scene) {
        enemy.mesh = buildEnemyMesh(THREE, kind);
        scene.add(enemy.mesh);
      }
      syncMesh(enemy);
      list.push(enemy);
      return enemy;
    },

    /** Lahirkan Rangga Samudra (bos) di (x, z). */
    spawnBoss(x, z) {
      return this.spawn(x, z, { kind: ENEMY_KIND_BOSS });
    },

    /** Lahirkan `count` preman penjaga di sekitar (x, z). */
    spawnGuards(x, z, count = 3) {
      const guards = [];
      for (let i = 0; i < count; i++) {
        const angle = (i / Math.max(1, count)) * Math.PI * 2;
        guards.push(
          this.spawn(x + Math.cos(angle) * 4, z + Math.sin(angle) * 4, {
            kind: ENEMY_KIND_GRUNT,
          }),
        );
      }
      return guards;
    },

    /** Jumlah musuh yang masih hidup. */
    aliveCount() {
      let n = 0;
      for (const enemy of list) if (enemy.alive) n++;
      return n;
    },

    /** Jumlah musuh yang sudah tumbang. */
    defeatedCount() {
      let n = 0;
      for (const enemy of list) if (!enemy.alive) n++;
      return n;
    },

    /** Beri damage ke satu musuh; kembalikan true bila musuh tumbang. */
    damage(enemy, amount) {
      if (!enemy || !enemy.alive) return false;
      enemy.health -= Number(amount) || 0;
      if (enemy.health <= 0) {
        enemy.health = 0;
        enemy.alive = false;
        enemy.state = 'down';
        if (enemy.mesh) enemy.mesh.visible = false;
        if (emit) emit({ type: 'enemy-down', kind: enemy.kind, x: enemy.x, z: enemy.z });
        return true;
      }
      return false;
    },

    /** Hapus semua musuh (dan mesh-nya dari scene bila ada). */
    clear() {
      for (const enemy of list) {
        if (enemy.mesh && scene && scene.remove) scene.remove(enemy.mesh);
      }
      list.length = 0;
    },

    /**
     * Majukan semua musuh satu frame: kejar Bara bila dekat, pukul bila
     * sudah dalam jangkauan, kembali ke titik jaga bila Bara jauh.
     * @param {number} dt detik sejak frame lalu
     * @param {{x:number,z:number}} playerPos posisi Bara
     * @param {(damage:number)=>void} [onPlayerHit] dipanggil saat Bara terpukul
     */
    update(dt, playerPos, onPlayerHit) {
      const step = Math.max(0, dt || 0);
      const px = playerPos ? playerPos.x || 0 : 0;
      const pz = playerPos ? playerPos.z || 0 : 0;
      for (const enemy of list) {
        if (!enemy.alive) continue;
        enemy.attackTimer = Math.max(0, enemy.attackTimer - step);
        enemy.shootTimer = Math.max(0, enemy.shootTimer - step);
        const distPlayer = flatDistance(enemy.x, enemy.z, px, pz);
        const distHome = flatDistance(enemy.x, enemy.z, enemy.homeX, enemy.homeZ);

        let targetX = enemy.homeX;
        let targetZ = enemy.homeZ;
        let speed = 0;
        if (distPlayer < ENEMY_AGGRO_RANGE && distHome < ENEMY_LEASH_RANGE) {
          enemy.state = 'chase';
          targetX = px;
          targetZ = pz;
          speed = speedForKind(enemy.kind);
          // Pukul Bara dari dekat (cooldown 1,2 dtk).
          if (distPlayer < ENEMY_ATTACK_RANGE && enemy.attackTimer <= 0) {
            enemy.attackTimer = ENEMY_ATTACK_COOLDOWN;
            enemy.state = 'attack';
            if (typeof onPlayerHit === 'function') {
              onPlayerHit(ENEMY_ATTACK_DAMAGE);
            }
            if (emit) emit({ type: 'enemy-attack', kind: enemy.kind });
          }
        } else {
          enemy.state = 'guard';
          if (distHome > 0.5) speed = speedForKind(enemy.kind) * 0.6;
        }

        const dx = targetX - enemy.x;
        const dz = targetZ - enemy.z;
        const len = Math.sqrt(dx * dx + dz * dz);
        if (speed > 0 && len > 0.001) {
          enemy.heading = Math.atan2(dx, dz);
          const move = Math.min(len, speed * step);
          enemy.x += (dx / len) * move;
          enemy.z += (dz / len) * move;
        }
        syncMesh(enemy);
      }
    },
  };
  return api;
}
