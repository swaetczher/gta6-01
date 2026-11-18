// player.js — Kontrol Bara Kelana di Arunika Bay: jalan kaki dan mengemudi.
// Modul logika murni (tanpa three.js): posisi di bidang datar y = 0,
// tabrakan diselesaikan lewat world.resolveCircle. Renderer di main.js
// hanya membaca state yang dihasilkan di sini.
export const WALK_SPEED = 4;
export const RUN_SPEED = 7.5;
export const JUMP_SPEED = 6.5;
export const GRAVITY = 18;
export const CAR_ACCEL = 14;
export const CAR_BRAKE = 26;
export const CAR_MAX_SPEED = 26;
export const CAR_REVERSE_MAX = 8;
export const STEAL_HOLD_SECONDS = 2;

export function createPlayer(spawn) {
  return {
    x: spawn ? spawn.x : 0,
    z: spawn ? spawn.z : 51,
    y: 0,
    vy: 0,
    heading: spawn && typeof spawn.heading === 'number' ? spawn.heading : Math.PI,
    onGround: true,
    health: 100,
    money: 50,
    weapon: 'fists',
    ammo: 12,
    ammoReserve: 48,
    inCar: null, // id mobil yang sedang dikemudikan, atau null
    stealProgress: 0, // 0..1, tahan E di dekat mobil terkunci
    stealTarget: null,
    moving: false,
    running: false,
  };
}

// Input: { forward, back, left, right, run, jump, enter, enterHeld, dt }
// world: adaptor dunia (resolveCircle, isWalkable, cars, setCarDriven)
export function updatePlayer(player, input, dt, world, events) {
  player.moving = false;
  player.running = false;
  if (player.inCar) {
    updateDriving(player, input, dt, world, events);
    return player;
  }
  const speed = input.run ? RUN_SPEED : WALK_SPEED;
  // Gerak relatif arah hadap (kamera third-person): maju = (sin h, cos h),
  // kanan = (cos h, -sin h). Heading adalah yaw kamera dan TIDAK diubah
  // oleh gerakan — main.js memutar mesh karakter ke arah kecepatan.
  const fwd = (input.forward ? 1 : 0) - (input.back ? 1 : 0);
  const strafe = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  const len = Math.hypot(fwd, strafe);
  if (len > 0) {
    player.moving = true;
    player.running = !!input.run;
    const sin = Math.sin(player.heading);
    const cos = Math.cos(player.heading);
    const dx = (fwd * sin + strafe * cos) / len;
    const dz = (fwd * cos - strafe * sin) / len;
    const nx = player.x + dx * speed * dt;
    const nz = player.z + dz * speed * dt;
    const solved = world.resolveCircle(nx, nz, 0.45);
    player.x = solved.x;
    player.z = solved.z;
  }
  if (input.jump && player.onGround) {
    player.vy = JUMP_SPEED;
    player.onGround = false;
  }
  if (!player.onGround) {
    player.vy -= GRAVITY * dt;
    player.y += player.vy * dt;
    if (player.y <= 0) {
      player.y = 0;
      player.vy = 0;
      player.onGround = true;
    }
  }
  updateSteal(player, input, dt, world, events);
  // Masuk mobil terbuka (tidak terkunci) dengan sekali tekan E.
  if (input.enter && !player.inCar) {
    const car = nearestEnterableCar(player, world);
    if (car) enterCar(player, car, world);
  }
  return player;
}

function updateDriving(player, input, dt, world, events) {
  const car = world.cars.find((c) => c.id === player.inCar);
  if (!car) {
    player.inCar = null;
    return;
  }
  if (input.enter) {
    exitCar(player, world);
    return;
  }
  if (input.forward) car.speed = Math.min(car.speed + CAR_ACCEL * dt, CAR_MAX_SPEED);
  else if (input.back) {
    car.speed = car.speed > 0.5
      ? Math.max(car.speed - CAR_BRAKE * dt, 0)
      : Math.max(car.speed - CAR_ACCEL * 0.6 * dt, -CAR_REVERSE_MAX);
  } else {
    car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 6 * dt);
    if (Math.abs(car.speed) < 0.05) car.speed = 0;
  }
  const steer = (input.left ? 1 : 0) - (input.right ? 1 : 0);
  const dir = car.speed >= 0 ? 1 : -1;
  car.heading += steer * 1.9 * dir * dt * Math.min(1, Math.abs(car.speed) / 6 + 0.25);
  const nx = car.x + Math.sin(car.heading) * car.speed * dt;
  const nz = car.z + Math.cos(car.heading) * car.speed * dt;
  const solved = world.resolveCircle(nx, nz, 1.4);
  if (Math.abs(solved.x - nx) > 0.01 || Math.abs(solved.z - nz) > 0.01) {
    car.speed *= 0.25; // menabrak gedung: kecepatan runtuh
    if (events) events.push({ type: 'crash', carId: car.id });
  }
  car.x = solved.x;
  car.z = solved.z;
  player.x = car.x;
  player.z = car.z;
  player.heading = car.heading;
  player.moving = Math.abs(car.speed) > 0.5;
}

// Curi mobil: berdiri dekat mobil terkunci + tahan E selama 2 detik.
export function updateSteal(player, input, dt, world, events) {
  const near = world.cars.find(
    (c) => c.locked && !c.driven && Math.hypot(c.x - player.x, c.z - player.z) < 3.2,
  );
  player.stealTarget = near ? near.id : null;
  if (near && input.enterHeld) {
    player.stealProgress += dt / STEAL_HOLD_SECONDS;
    if (player.stealProgress >= 1) {
      near.locked = false;
      near.stolen = true;
      player.stealProgress = 0;
      if (events) events.push({ type: 'carStolen', carId: near.id, heat: 25 });
      enterCar(player, near, world);
    }
  } else {
    player.stealProgress = 0;
  }
  if (near && input.enter && !near.locked) enterCar(player, near, world);
}

export function enterCar(player, car, world) {
  player.inCar = car.id;
  car.driven = true;
  car.speed = 0;
  if (world.setCarDriven) world.setCarDriven(car.id, true);
}

export function exitCar(player, world) {
  const car = world.cars.find((c) => c.id === player.inCar);
  if (car) {
    car.driven = false;
    if (world.setCarDriven) world.setCarDriven(car.id, false);
  }
  player.inCar = null;
  player.x += Math.sin(player.heading + Math.PI / 2) * 2;
  player.z += Math.cos(player.heading + Math.PI / 2) * 2;
  const solved = world.resolveCircle(player.x, player.z, 0.45);
  player.x = solved.x;
  player.z = solved.z;
}

// Cari mobil terdekat yang bisa dimasuki (tidak terkunci, radius 3 m).
export function nearestEnterableCar(player, world) {
  let best = null;
  let bestD = 3.2;
  for (const car of world.cars) {
    if (car.locked || car.driven) continue;
    const d = Math.hypot(car.x - player.x, car.z - player.z);
    if (d < bestD) {
      bestD = d;
      best = car;
    }
  }
  return best;
}
// --- akhir player.js (baris revisi ditambahkan lewat edit terpisah) ---
// Revisi terekam: Bara tidak bisa mencuri mobil yang sedang dikemudikan
// orang lain — stealTarget hanya mobil parkir (driven false). Kecepatan
// lari 7,5 m/s membuat M1 "Kurir Fajar" bisa selesai tanpa kendaraan.
export function canStealNow(player, world) {
  return !!player.stealTarget && !player.inCar;
}
