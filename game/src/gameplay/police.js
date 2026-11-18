// police.js — Polisi Pelabuhan Arunika ("Polair Arunika").
// Jumlah petugas mengikuti bintang: 1★=2, 2★=3, 3★=5, 4★=7, 5★=9.
// State: patrol (ronda) → chase (kejar) → search (cari, pemain hilang)
// → arrest (tangkap bila cukup lama menempel pemain).
export const POLICE_PER_STAR = { 1: 2, 2: 3, 3: 5, 4: 7, 5: 9 };
export const ARREST_DISTANCE = 2.2;
export const ARREST_SECONDS = 1.6;
export const SIGHT_RANGE = 34;
export const SIGHT_RANGE_CAR = 46;

export function policeCountForStars(stars) {
  if (stars <= 0) return 0;
  return POLICE_PER_STAR[Math.min(5, stars)] || 2;
}

export function createPoliceUnit(id, x, z, inCar) {
  return {
    id,
    x,
    z,
    heading: 0,
    speed: inCar ? 12 : 4.6,
    inCar: !!inCar,
    state: 'patrol', // patrol | chase | search | arrest
    arrestTimer: 0,
    searchTimer: 0,
    patrolTarget: null,
    alive: true,
  };
}

// Sesuaikan jumlah polisi aktif dengan bintang saat ini. Spawn di sekitar
// pemain (radius 26–40 m) di titik yang bisa dilalui.
export function syncPolice(police, stars, player, world, rng) {
  const want = policeCountForStars(stars);
  while (police.length < want) {
    const spot = findSpawnSpot(player, world, rng);
    const inCar = stars >= 2 && police.filter((p) => p.inCar).length < Math.ceil(want / 2);
    police.push(createPoliceUnit(`polisi-${police.length + 1}-${Date.now() % 100000}`, spot.x, spot.z, inCar));
  }
  while (police.length > want) police.pop();
  return police;
}

function findSpawnSpot(player, world, rng) {
  const rand = rng || Math.random;
  for (let i = 0; i < 12; i++) {
    const a = rand() * Math.PI * 2;
    const r = 26 + rand() * 14;
    const x = player.x + Math.sin(a) * r;
    const z = player.z + Math.cos(a) * r;
    if (world.isWalkable(x, z)) return { x, z };
  }
  return { x: player.x + 28, z: player.z };
}

export function policeSeesPlayer(unit, player) {
  const range = unit.inCar ? SIGHT_RANGE_CAR : SIGHT_RANGE;
  return Math.hypot(player.x - unit.x, player.z - unit.z) <= range;
}

export function updatePolice(police, player, dt, world, events) {
  let anySees = false;
  let busted = false;
  for (const unit of police) {
    if (!unit.alive) continue;
    const dist = Math.hypot(player.x - unit.x, player.z - unit.z);
    const sees = policeSeesPlayer(unit, player);
    if (sees) anySees = true;
    if (unit.state === 'patrol') {
      if (sees) unit.state = 'chase';
      else patrolStep(unit, dt, world);
    }
    if (unit.state === 'chase') {
      if (!sees) {
        unit.state = 'search';
        unit.searchTimer = 8;
      } else {
        chaseStep(unit, player, dt, world);
      }
    }
    if (unit.state === 'search') {
      unit.searchTimer -= dt;
      patrolStep(unit, dt, world);
      if (sees) unit.state = 'chase';
      else if (unit.searchTimer <= 0) unit.state = 'patrol';
    }
    const d2 = Math.hypot(player.x - unit.x, player.z - unit.z);
    if (d2 < ARREST_DISTANCE) {
      unit.arrestTimer += dt;
      unit.state = 'arrest';
      if (unit.arrestTimer >= ARREST_SECONDS) busted = true;
    } else {
      unit.arrestTimer = 0;
      if (unit.state === 'arrest') unit.state = 'chase';
    }
  }
  if (busted && events) events.push({ type: 'busted' });
  return { anySees, busted };
}

function patrolStep(unit, dt, world) {
  if (!unit.patrolTarget || Math.hypot(unit.patrolTarget.x - unit.x, unit.patrolTarget.z - unit.z) < 2) {
    unit.patrolTarget = {
      x: unit.x + (Math.random() - 0.5) * 40,
      z: unit.z + (Math.random() - 0.5) * 40,
    };
  }
  moveToward(unit, unit.patrolTarget.x, unit.patrolTarget.z, unit.speed * 0.45, dt, world);
}

function chaseStep(unit, player, dt, world) {
  const speed = unit.inCar ? 13.5 : 5.4;
  moveToward(unit, player.x, player.z, speed, dt, world);
}

function moveToward(unit, tx, tz, speed, dt, world) {
  const dx = tx - unit.x;
  const dz = tz - unit.z;
  const len = Math.hypot(dx, dz);
  if (len < 0.01) return;
  unit.heading = Math.atan2(dx, dz);
  const nx = unit.x + (dx / len) * speed * dt;
  const nz = unit.z + (dz / len) * speed * dt;
  const solved = world.resolveCircle(nx, nz, 0.5);
  unit.x = solved.x;
  unit.z = solved.z;
}

// Helikopter Polair muncul di wanted 4★ ke atas (hanya penanda + bayangan
// di layar; tidak menangkap sendiri, tapi membuat pemain selalu terlihat).
export function helicopterActive(stars) {
  return stars >= 4;
}
// --- akhir police.js (baris revisi ditambahkan lewat edit terpisah) ---
// Revisi terekam: polisi mobil hanya separuh dari regu (sisanya jalan
// kaki) supaya kejar-kejaran M4 tetap bisa dilewati di gang sempit Pasar
// Terapung — mobil patroli tidak masuk kanal.
export function policeSummary(police) {
  const cars = police.filter((p) => p.inCar).length;
  return { total: police.length, cars, foot: police.length - cars };
}
