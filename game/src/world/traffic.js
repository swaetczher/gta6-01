// traffic.js — Lalu lintas ARUNIKA BAY: 14 mobil warga yang berputar di
// graf jalan kota. Arah gerak memakai rumus kontrak atan2(-dz, dx).
// Tiap mobil menempuh satu ruas, lalu memilih ruas lanjutan yang tersambung
// di ujungnya — jadi tidak pernah keluar jalan.

import { TRAFFIC_COUNT, TRAFFIC_SPEED_MIN, TRAFFIC_SPEED_MAX, CITY_SEED, mulberry32 } from './config.js';
import { makeCarMesh, CAR_COLORS, spinWheels } from './vehicles.js';

// Ujung ruas yang tersambung dengan titik (x, z): ruas lain yang punya
// ujung di titik yang sama (persimpangan).
function nextSegments(roads, segIndex, atEnd) {
  const seg = roads.segments[segIndex];
  const px = atEnd ? seg.bx : seg.ax;
  const pz = atEnd ? seg.bz : seg.az;
  const out = [];
  for (let i = 0; i < roads.segments.length; i++) {
    if (i === segIndex) continue;
    const s = roads.segments[i];
    if ((s.ax === px && s.az === pz) || (s.bx === px && s.bz === pz)) out.push(i);
  }
  return out;
}

// Bangun armada traffic. Mengembalikan { list, update, freeze }.
export function createTraffic(THREE, scene, roads) {
  const rand = mulberry32(CITY_SEED + 77);
  const list = [];
  for (let i = 0; i < TRAFFIC_COUNT; i++) {
    const segIndex = i % roads.segments.length;
    const seg = roads.segments[segIndex];
    const forward = rand() > 0.5;
    const color = CAR_COLORS[(i + 2) % CAR_COLORS.length];
    const { group, wheels } = makeCarMesh(THREE, color, 'sedan');
    scene.add(group);
    const speed = TRAFFIC_SPEED_MIN + rand() * (TRAFFIC_SPEED_MAX - TRAFFIC_SPEED_MIN);
    const car = {
      mesh: group,
      wheels,
      segIndex,
      forward,
      t: rand(),
      speed,
      x: 0,
      z: 0,
      heading: 0,
      type: 'traffic',
      locked: false,
      label: `Lalu lintas ${i + 1}`,
      driven: false,
    };
    placeOnSegment(car, roads);
    list.push(car);
  }

  function placeOnSegment(car, roadsRef) {
    const seg = roadsRef.segments[car.segIndex];
    const ax = car.forward ? seg.ax : seg.bx;
    const az = car.forward ? seg.az : seg.bz;
    const bx = car.forward ? seg.bx : seg.ax;
    const bz = car.forward ? seg.bz : seg.az;
    const dx = bx - ax;
    const dz = bz - az;
    const len = Math.sqrt(dx * dx + dz * dz) || 1;
    car.x = ax + dx * car.t;
    car.z = az + dz * car.t;
    // Rumus arah kontrak: heading dari arah gerak (dx, dz).
    car.heading = Math.atan2(-dz, dx);
    car.mesh.position.set(car.x, 0, car.z);
    car.mesh.rotation.y = car.heading - Math.PI / 2;
    car._segLen = len;
  }

  function update(dt) {
    for (const car of list) {
      const seg = roads.segments[car.segIndex];
      const len = car._segLen || 200;
      car.t += (car.speed * dt) / len;
      if (car.t >= 1) {
        // Sampai ujung ruas: pilih ruas lanjutan di persimpangan.
        const old = roads.segments[car.segIndex];
        const px = car.forward ? old.bx : old.ax;
        const pz = car.forward ? old.bz : old.az;
        const candidates = nextSegments(roads, car.segIndex, car.forward);
        if (candidates.length > 0) {
          car.segIndex = candidates[Math.floor(rand() * candidates.length)];
          const ns = roads.segments[car.segIndex];
          // Masuk ruas baru dari ujung yang menempel di persimpangan:
          // menempel di ax -> maju (forward), menempel di bx -> mundur.
          car.forward = ns.ax === px && ns.az === pz;
          car.t = 0;
        } else {
          car.forward = !car.forward;
          car.t = 0;
        }
      }
      placeOnSegment(car, roads);
      spinWheels(car, dt);
    }
  }

  return { list, update, placeOnSegment };
}

// ---- Tambahan: bekukan + cari mobil traffic (revisi ke-2) ----

// Ambil mobil traffic ke-i (dipakai staging shot jalan kaki: mobil biru).
export function trafficCarAt(traffic, i) {
  return traffic.list[i % traffic.list.length];
}

// Pindahkan satu mobil traffic ke titik diam (untuk staging shot).
// Mobil diparkir di luar ruas: t dibekukan dengan menaruhnya di ruas
// pendek buatan — cara paling aman: set posisi manual + speed 0.
export function parkTrafficCar(car, x, z, heading) {
  car.speed = 0;
  car.x = x;
  car.z = z;
  car.heading = heading;
  car.mesh.position.set(x, 0, z);
  car.mesh.rotation.y = heading - Math.PI / 2;
}
