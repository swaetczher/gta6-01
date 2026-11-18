// player.js — Bara Kelana, tokoh utama ARUNIKA BAY.
//
// Bara berjalan kaki (oranye), bisa lari, dan bisa mengemudi mobil. Mobil
// yang terkunci (mis. Kancil M2 curian) dicuri dengan menahan tombol aksi
// (E) di dekatnya sampai `stealProgress` penuh — lalu mobil terbuka, Bara
// masuk, dan panas buronan naik.
//
// Modul ini membaca `input` dari main.js lewat banyak alias tombol, supaya
// tidak rapuh kalau main.js menulis input dengan nama lain: boolean
// `up/down/left/right` (atau `forward/back`, `w/a/s/d`), kode `KeyW` /
// `ArrowUp` / ..., atau `input.keys` sebagai Set/objek berisi kode tombol.
// Semua alias dicek di `keyDown()` — satu tempat, bukan di tiap gerakan.

export const PLAYER_HEALTH_MAX = 100;
export const PLAYER_MONEY_START = 50;

// Kecepatan (meter/detik).
export const PLAYER_SPEED_WALK = 6;
export const PLAYER_SPEED_RUN = 10;
export const PLAYER_SPEED_CAR = 26;
export const PLAYER_SPEED_CAR_REVERSE = 8;

// Putaran (radian/detik) dan akselerasi mobil.
export const PLAYER_TURN_RATE = 2.6;
export const PLAYER_CAR_TURN_RATE = 1.9;
export const PLAYER_CAR_ACCEL = 18;

// Jarak interaksi dengan mobil (meter) dan waktu mencuri (detik).
export const PLAYER_ENTER_RANGE = 3.2;
export const PLAYER_STEAL_TIME = 2.5;

// Radius tubuh Bara untuk tabrakan (meter).
export const PLAYER_RADIUS = 0.55;

/** Daftar nama alias untuk satu tombol, dicek berurutan oleh keyDown. */
const KEY_ALIASES = {
  up: ['up', 'forward', 'w', 'KeyW', 'ArrowUp'],
  down: ['down', 'back', 's', 'KeyS', 'ArrowDown'],
  left: ['left', 'a', 'KeyA', 'ArrowLeft'],
  right: ['right', 'd', 'KeyD', 'ArrowRight'],
  run: ['run', 'Shift', 'ShiftLeft', 'ShiftRight'],
  action: ['action', 'e', 'KeyE'],
  attack: ['attack', 'Space', ' ', 'mouse'],
  pause: ['pause', 'Escape', 'KeyP', 'p'],
};

/**
 * Apakah tombol `name` sedang ditekan di objek `input`.
 * Mendukung: properti boolean langsung, `input.keys` sebagai Set, atau
 * `input.keys` sebagai objek `{KeyW: true}`.
 */
export function keyDown(input, name) {
  if (!input) return false;
  const aliases = KEY_ALIASES[name] || [name];
  for (const alias of aliases) {
    if (input[alias] === true) return true;
  }
  const keys = input.keys;
  if (keys) {
    for (const alias of aliases) {
      if (typeof keys.has === 'function' && keys.has(alias)) return true;
      if (keys[alias] === true) return true;
    }
  }
  return false;
}

/**
 * Bangun mesh Bara: badan kotak oranye + kepala. Dibuat dari primitif
 * THREE saja (tanpa aset luar).
 */
export function buildPlayerMesh(THREE) {
  const group = new THREE.Group();
  const orange = new THREE.MeshLambertMaterial({ color: 0xea580c });
  const skin = new THREE.MeshLambertMaterial({ color: 0xd9a066 });
  const dark = new THREE.MeshLambertMaterial({ color: 0x1f2937 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.95, 0.36), orange);
  body.position.y = 0.95;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.42), skin);
  head.position.y = 1.66;
  const hair = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.16, 0.46), dark);
  hair.position.y = 1.9;
  const legs = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.32), dark);
  legs.position.y = 0.25;
  group.add(body);
  group.add(head);
  group.add(hair);
  group.add(legs);
  return group;
}

/** Jarak datar (XZ) antara dua titik. */
function flatDistance(ax, az, bx, bz) {
  const dx = ax - bx;
  const dz = az - bz;
  return Math.sqrt(dx * dx + dz * dz);
}

/** Jepit angka ke rentang. */
function clamp(value, min, max) {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

/**
 * Manajer pemain.
 *
 * @param {object} THREE pustaka three.js (atau stub di tes)
 * @param {object|null} scene scene three.js (atau null di tes)
 * @param {object} world objek dunia dari `buildWorld`: dipakai
 *   `world.spawnPoints.player`, `world.vehicles`, `world.colliders`
 * @param {object} input objek tombol dari main.js (lihat keyDown)
 * @param {(event:object)=>void} [onEvent] dipanggil saat mencuri / masuk /
 *   keluar mobil
 */
export function createPlayer(THREE, scene, world, input, onEvent) {
  const emit = typeof onEvent === 'function' ? onEvent : null;
  const spawn = (world && world.spawnPoints && world.spawnPoints.player) || { x: 0, z: 0, yaw: 0 };
  const vehicles = (world && world.vehicles) || [];
  const colliders = (world && world.colliders) || [];

  let x = Number(spawn.x) || 0;
  let z = Number(spawn.z) || 0;
  let yaw = Number(spawn.yaw) || 0;
  let speed = 0;
  let health = PLAYER_HEALTH_MAX;
  let inCar = false;
  let car = null;
  let stealProgress = 0;
  let stealing = null;

  let mesh = null;
  if (THREE && scene) {
    mesh = buildPlayerMesh(THREE);
    scene.add(mesh);
  }
  // Tepi tombol aksi (E): naik saat pertama ditekan. Dipakai masuk/keluar
  // mobil — supaya Bara tidak langsung masuk lagi di frame berikutnya
  // setelah keluar dengan E yang masih ditahan. Mencuri tetap memakai
  // level tombol (tahan E), bukan tepi.
  let prevAction = false;

  function syncMesh() {
    if (!mesh) return;
    if (inCar && car && car.mesh) {
      mesh.visible = false;
      return;
    }
    mesh.visible = true;
    mesh.position.set(x, 0, z);
    mesh.rotation.y = yaw;
  }

  /** Dorong Bara keluar dari collider lingkaran/kotak (satu sumbu per panggil). */
  function resolveColliders(nx, nz) {
    let px = nx;
    let pz = nz;
    for (const c of colliders) {
      if (!c) continue;
      if (typeof c.r === 'number') {
        const dx = px - c.x;
        const dz = pz - c.z;
        const d = Math.sqrt(dx * dx + dz * dz);
        const min = c.r + PLAYER_RADIUS;
        if (d < min && d > 0.0001) {
          px = c.x + (dx / d) * min;
          pz = c.z + (dz / d) * min;
        } else if (d <= 0.0001) {
          px = c.x + min;
        }
      } else if (typeof c.w === 'number' && typeof c.d === 'number') {
        const hw = c.w / 2 + PLAYER_RADIUS;
        const hd = c.d / 2 + PLAYER_RADIUS;
        const dx = px - c.x;
        const dz = pz - c.z;
        if (Math.abs(dx) < hw && Math.abs(dz) < hd) {
          if (hw - Math.abs(dx) < hd - Math.abs(dz)) {
            px = c.x + (dx >= 0 ? hw : -hw);
          } else {
            pz = c.z + (dz >= 0 ? hd : -hd);
          }
        }
      }
    }
    return { x: px, z: pz };
  }

  const api = {
    /** Posisi dan arah Bara saat ini. */
    get x() {
      return x;
    },
    get z() {
      return z;
    },
    get yaw() {
      return yaw;
    },
    /** Kecepatan saat ini (m/detik; negatif = mundur di mobil). */
    get speed() {
      return speed;
    },
    /** Nyawa Bara (0–100). */
    get health() {
      return health;
    },
    /** Apakah Bara sedang mengemudi. */
    get inCar() {
      return inCar;
    },
    /** Mobil yang sedang dikemudikan (atau null). */
    get car() {
      return car;
    },
    /** Progres mencuri 0–1 (1 = mobil terbuka). */
    get stealProgress() {
      return stealProgress;
    },
    /** Mobil yang sedang dicuri (atau null). */
    get stealing() {
      return stealing;
    },
    /** Mesh Bara (atau null di tes logika). */
    get mesh() {
      return mesh;
    },

    /** Pindahkan Bara (dipakai staging shot + respawn). */
    setPosition(nx, nz, nyaw) {
      const fixed = resolveColliders(Number(nx) || 0, Number(nz) || 0);
      x = fixed.x;
      z = fixed.z;
      if (typeof nyaw === 'number') yaw = nyaw;
      speed = 0;
      syncMesh();
    },

    /** Mobil terdekat dalam jangkauan interaksi, atau null. */
    nearestCar(range = PLAYER_ENTER_RANGE) {
      let best = null;
      let bestDist = Infinity;
      for (const vehicle of vehicles) {
        if (!vehicle) continue;
        const d = flatDistance(x, z, vehicle.x || 0, vehicle.z || 0);
        if (d < range && d < bestDist) {
          bestDist = d;
          best = vehicle;
        }
      }
      return best ? { vehicle: best, distance: bestDist } : null;
    },

    /** Masuk ke mobil (tanpa mencuri — mobil sudah terbuka). */
    enterCar(vehicle) {
      if (!vehicle) return false;
      car = vehicle;
      inCar = true;
      vehicle.driven = true;
      x = vehicle.x || 0;
      z = vehicle.z || 0;
      yaw = vehicle.heading || 0;
      speed = 0;
      stealProgress = 0;
      stealing = null;
      if (emit) emit({ type: 'enter-car', label: vehicle.label || vehicle.type || 'mobil' });
      syncMesh();
      return true;
    },

    /** Keluar dari mobil di posisi Bara saat ini. */
    exitCar() {
      if (!inCar || !car) return false;
      const left = car;
      left.driven = false;
      car = null;
      inCar = false;
      speed = 0;
      x = left.x + Math.cos(yaw) * 2;
      z = left.z + Math.sin(yaw) * 2;
      if (emit) emit({ type: 'exit-car', label: left.label || left.type || 'mobil' });
      syncMesh();
      return true;
    },

    /** Kurangi nyawa Bara; kembalikan nyawa sisa. */
    damage(amount) {
      health = clamp(health - (Number(amount) || 0), 0, PLAYER_HEALTH_MAX);
      return health;
    },

    /** Pulihkan nyawa Bara sampai penuh. */
    healFull() {
      health = PLAYER_HEALTH_MAX;
      return health;
    },

    /** Majukan Bara satu frame: jalan kaki atau mengemudi. */
    update(dt) {
      const step = Math.max(0, dt || 0);
      if (step === 0) return;

      if (inCar && car) {
        // --- Mengemudi: W/S gas/mundur, A/D belok searah laju. ---
        const throttle = keyDown(input, 'up') ? 1 : keyDown(input, 'down') ? -1 : 0;
        const steer = keyDown(input, 'left') ? 1 : keyDown(input, 'right') ? -1 : 0;
        if (throttle > 0) {
          speed = Math.min(PLAYER_SPEED_CAR, speed + PLAYER_CAR_ACCEL * step);
        } else if (throttle < 0) {
          speed = Math.max(-PLAYER_SPEED_CAR_REVERSE, speed - PLAYER_CAR_ACCEL * step);
        } else {
          speed *= Math.max(0, 1 - 2.2 * step);
          if (Math.abs(speed) < 0.05) speed = 0;
        }
        if (speed !== 0) {
          yaw += steer * PLAYER_CAR_TURN_RATE * step * (speed >= 0 ? 1 : -1);
        }
        x += Math.sin(yaw) * speed * step;
        z += Math.cos(yaw) * speed * step;
        car.x = x;
        car.z = z;
        car.heading = yaw;
        car.speed = speed;
        // Keluar mobil dengan tombol aksi sambil diam (tepi tombol).
        const actionNow = keyDown(input, 'action');
        const actionEdge = actionNow && !prevAction;
        prevAction = actionNow;
        if (actionEdge && Math.abs(speed) < 0.5) {
          this.exitCar();
        }
        syncMesh();
        return;
      }

      // --- Jalan kaki: W/S maju/mundur searah hadap, A/D putar badan. ---
      const running = keyDown(input, 'run');
      const walkSpeed = running ? PLAYER_SPEED_RUN : PLAYER_SPEED_WALK;
      if (keyDown(input, 'left')) yaw += PLAYER_TURN_RATE * step;
      if (keyDown(input, 'right')) yaw -= PLAYER_TURN_RATE * step;
      const forward = keyDown(input, 'up') ? 1 : keyDown(input, 'down') ? -1 : 0;
      speed = forward * walkSpeed;
      let nx = x + Math.sin(yaw) * speed * step;
      let nz = z + Math.cos(yaw) * speed * step;
      const fixed = resolveColliders(nx, nz);
      x = fixed.x;
      z = fixed.z;

      // --- Interaksi mobil: E di dekat mobil. ---
      // Mencuri memakai LEVEL tombol (tahan E); masuk mobil terbuka memakai
      // TEPI tombol (sekali tekan) supaya tidak masuk-keluar berulang.
      const actionNow = keyDown(input, 'action');
      const actionEdge = actionNow && !prevAction;
      prevAction = actionNow;
      const near = this.nearestCar();
      if (near && actionNow) {
        const vehicle = near.vehicle;
        if (vehicle.locked) {
          // Mencuri: tahan E sampai progres penuh.
          stealing = vehicle;
          stealProgress = clamp(stealProgress + step / PLAYER_STEAL_TIME, 0, 1);
          if (stealProgress >= 1) {
            vehicle.locked = false;
            if (emit) {
              emit({ type: 'car-stolen', label: vehicle.label || vehicle.type || 'mobil' });
            }
            this.enterCar(vehicle);
          }
        } else if (actionEdge) {
          this.enterCar(vehicle);
        }
      } else {
        // Lepas E sebelum selesai: progres mencuri menguap.
        if (stealing) stealProgress = Math.max(0, stealProgress - step * 0.8);
        if (stealProgress <= 0) stealing = null;
      }
      syncMesh();
    },

    /** Cuplikan untuk save game. */
    snapshot() {
      return {
        x,
        z,
        yaw,
        health,
        inCar,
        carLabel: car ? car.label || car.type || null : null,
      };
    },

    /** Pulihkan posisi + nyawa dari save game. */
    restore(data) {
      if (!data) return;
      if (typeof data.x === 'number' && typeof data.z === 'number') {
        this.setPosition(data.x, data.z, data.yaw);
      }
      if (typeof data.health === 'number') {
        health = clamp(data.health, 0, PLAYER_HEALTH_MAX);
      }
    },
  };
  syncMesh();
  return api;
}
