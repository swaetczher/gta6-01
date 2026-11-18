// player.js — Bara Kelana: jalan kaki, lari, nyetir, dan mencuri mobil.
// Gerakan membaca banyak alias tombol supaya main.js bebas memakai bentuk
// input apa pun: boolean up/down/left/right, forward/back, w/a/s/d,
// kode KeyW/ArrowUp, atau input.keys sebagai Set maupun objek biasa.
// Mencuri mobil butuh menahan tombol aksi (E) selama 2,5 detik di dekat
// mobil terkunci; begitu selesai, mobil itu jadi milik Bara.

export const WALK_SPEED = 5;
export const RUN_SPEED = 8;
export const CAR_TOP_SPEED = 26;
export const CAR_ACCEL = 14;
export const STEAL_TIME = 2.5;
export const STEAL_RANGE = 3.2;

function hasKey(input, names) {
  if (!input) return false;
  if (input.keys instanceof Set) {
    return names.some((n) => input.keys.has(n));
  }
  if (input.keys && typeof input.keys === 'object') {
    return names.some((n) => input.keys[n]);
  }
  return names.some((n) => Boolean(input[n]));
}

// Baca tombol dari input dengan semua alias yang dikenal.
export function keyDown(input, action) {
  switch (action) {
    case 'up': return hasKey(input, ['up', 'forward', 'w', 'KeyW', 'ArrowUp']);
    case 'down': return hasKey(input, ['down', 'back', 's', 'KeyS', 'ArrowDown']);
    case 'left': return hasKey(input, ['left', 'a', 'KeyA', 'ArrowLeft']);
    case 'right': return hasKey(input, ['right', 'd', 'KeyD', 'ArrowRight']);
    case 'run': return hasKey(input, ['run', 'Shift', 'ShiftLeft', 'ShiftRight']);
    case 'action': return hasKey(input, ['action', 'e', 'KeyE']);
    case 'attack': return hasKey(input, ['attack', ' ', 'Space', 'mouse']);
    case 'pause': return hasKey(input, ['pause', 'Escape', 'KeyP', 'p']);
    default: return false;
  }
}

export function createPlayer(opts = {}) {
  const adapter = opts.adapter || null;
  const input = opts.input || {};
  const onEvent = typeof opts.onEvent === 'function' ? opts.onEvent : null;
  const start = opts.start || { x: 0, z: 0, yaw: 0 };
  const player = {
    x: Number(start.x) || 0,
    z: Number(start.z) || 0,
    yaw: Number(start.yaw) || 0,
    speed: 0,
    health: 100,
    inCar: false,
    car: null,
    stealProgress: 0,
    stealTarget: null,
    moving: false,
  };

  function emit(type, payload) {
    if (onEvent) onEvent({ type, ...payload });
  }

  // Coba geser ke (nx, nz); tabrakan menghalangi per sumbu, bukan total.
  function tryMove(nx, nz) {
    if (!adapter || typeof adapter.hitsCollider !== 'function') {
      player.x = nx;
      player.z = nz;
      return;
    }
    if (!adapter.hitsCollider(nx, player.z)) player.x = nx;
    if (!adapter.hitsCollider(player.x, nz)) player.z = nz;
  }

  function updateOnFoot(dt) {
    const forward = (keyDown(input, 'up') ? 1 : 0) - (keyDown(input, 'down') ? 1 : 0);
    const strafe = (keyDown(input, 'right') ? 1 : 0) - (keyDown(input, 'left') ? 1 : 0);
    const running = keyDown(input, 'run');
    const speed = running ? RUN_SPEED : WALK_SPEED;
    player.moving = forward !== 0 || strafe !== 0;
    if (!player.moving) {
      player.speed = 0;
      return;
    }
    const len = Math.hypot(forward, strafe) || 1;
    const fx = Math.sin(player.yaw);
    const fz = Math.cos(player.yaw);
    const rx = Math.cos(player.yaw);
    const rz = -Math.sin(player.yaw);
    const mx = ((fx * forward) / len + (rx * strafe) / len) * speed * dt;
    const mz = ((fz * forward) / len + (rz * strafe) / len) * speed * dt;
    player.speed = speed;
    tryMove(player.x + mx, player.z + mz);
    if (forward !== 0 || strafe !== 0) {
      player.yaw = Math.atan2(mx, mz);
    }
  }

  function updateSteal(dt) {
    if (player.inCar) {
      player.stealProgress = 0;
      player.stealTarget = null;
      return;
    }
    const holding = keyDown(input, 'action');
    const target = adapter && typeof adapter.nearestLockedVehicle === 'function'
      ? adapter.nearestLockedVehicle(player.x, player.z, STEAL_RANGE)
      : null;
    if (!holding || !target) {
      player.stealProgress = 0;
      player.stealTarget = null;
      return;
    }
    player.stealTarget = target;
    player.stealProgress += dt / STEAL_TIME;
    if (player.stealProgress >= 1) {
      player.stealProgress = 0;
      player.stealTarget = null;
      api.enterCar(target);
      emit('car-stolen', { car: target });
    }
  }

  function updateInCar(dt) {
    if (!player.car) {
      player.inCar = false;
      player.speed = 0;
      return;
    }
    const throttle = (keyDown(input, 'up') ? 1 : 0) - (keyDown(input, 'down') ? 0.55 : 0);
    const steer = (keyDown(input, 'left') ? 1 : 0) - (keyDown(input, 'right') ? 1 : 0);
    const target = throttle > 0 ? CAR_TOP_SPEED : throttle < 0 ? -8 : 0;
    player.speed += Math.max(-CAR_ACCEL * dt, Math.min(CAR_ACCEL * dt, target - player.speed));
    if (Math.abs(player.speed) > 0.2) {
      player.yaw += steer * 1.7 * dt * (player.speed >= 0 ? 1 : -1);
    }
    const nx = player.x + Math.sin(player.yaw) * player.speed * dt;
    const nz = player.z + Math.cos(player.yaw) * player.speed * dt;
    tryMove(nx, nz);
    player.moving = Math.abs(player.speed) > 0.5;
    player.car.x = player.x;
    player.car.z = player.z;
    player.car.heading = player.yaw;
  }

  const api = {
    ...player,
    get x() { return player.x; },
    get z() { return player.z; },
    get yaw() { return player.yaw; },
    get speed() { return player.speed; },
    get health() { return player.health; },
    get inCar() { return player.inCar; },
    get car() { return player.car; },
    get stealProgress() { return player.stealProgress; },
    get stealTarget() { return player.stealTarget; },
    get moving() { return player.moving; },
    set health(v) { player.health = Math.max(0, Math.min(100, Number(v) || 0)); },

    setPosition(x, z, yaw) {
      player.x = Number(x) || 0;
      player.z = Number(z) || 0;
      if (typeof yaw === 'number') player.yaw = yaw;
      player.speed = 0;
      return player;
    },

    // Naik ke mobil (sudah dicuri atau terbuka). Mobil jadi driven.
    enterCar(car) {
      if (!car) return false;
      player.car = car;
      player.inCar = true;
      player.stealProgress = 0;
      player.stealTarget = null;
      car.locked = false;
      car.driven = true;
      player.x = car.x;
      player.z = car.z;
      player.yaw = car.heading ?? player.yaw;
      return true;
    },

    // Turun dari mobil di samping pintu kiri.
    exitCar() {
      if (!player.inCar || !player.car) return false;
      const car = player.car;
      car.driven = false;
      player.x = car.x + Math.cos(player.yaw) * 1.6;
      player.z = car.z - Math.sin(player.yaw) * 1.6;
      player.car = null;
      player.inCar = false;
      player.speed = 0;
      return true;
    },

    damage(amount) {
      player.health = Math.max(0, player.health - Math.max(0, Number(amount) || 0));
      return player.health;
    },

    heal(amount) {
      player.health = Math.min(100, player.health + Math.max(0, Number(amount) || 0));
      return player.health;
    },

    // Maju satu frame: jalan kaki atau nyetir, lalu proses mencuri.
    update(dt) {
      const step = Math.max(0, dt);
      if (player.inCar) updateInCar(step);
      else updateOnFoot(step);
      updateSteal(step);
      return player;
    },
  };

  // Samakan field langsung di objek api supaya tes dan main.js bisa
  // membaca/menulis player.x seperti properti biasa.
  return new Proxy(api, {
    get(target, prop) {
      if (prop in player && !(prop in target)) return player[prop];
      return Reflect.get(target, prop);
    },
    set(target, prop, value) {
      if (prop in player) {
        player[prop] = value;
        return true;
      }
      return Reflect.set(target, prop, value);
    },
  });
}
