// vehicles.js — Mobil kota ARUNIKA BAY: pabrik mesh mobil + parkir.
// Kancil M2 curian (oranye, terkunci) adalah mobil pertama Bara.
// Mesh parkir memakai rotasi rotation.y = rotY - PI/2 (kontrak).

import { PALETTE, PARKED_COUNT, PARKED_LOCKED, PARKING_SPOTS, KANCIL } from './config.js';

// Warna mobil warga (dipakai parkir + traffic).
export const CAR_COLORS = [0x2a6fd8, 0xd83a2a, 0xe8e4d8, 0x3f8a4a, 0x8a8a92, 0x2a2a30, 0xc8a83a];

// Rakit satu mobil: bodi + kabin + 4 roda + lampu depan.
// Mengembalikan { group, wheels } — wheels dipakai world/index untuk putar.
export function makeCarMesh(THREE, color, type = 'sedan') {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x1c2733 });
  const isKancil = type === 'kancil';
  const bodyLen = isKancil ? 3.4 : 4.2;
  const bodyWid = 1.9;
  const bodyH = 0.75;

  const body = new THREE.Mesh(new THREE.BoxGeometry(bodyLen, bodyH, bodyWid), bodyMat);
  body.position.y = 0.62;
  group.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(bodyLen * 0.52, 0.62, bodyWid - 0.25), darkMat);
  cabin.position.set(isKancil ? -0.1 : -0.2, 1.28, 0);
  group.add(cabin);
  // Lampu depan (depan = +x lokal).
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xfff2b8 });
  for (const s of [-0.6, 0.6]) {
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.22, 0.3), lampMat);
    lamp.position.set(bodyLen / 2 + 0.02, 0.66, s);
    group.add(lamp);
  }
  // Roda: silinder diputar supaya sumbunya melintang (sumbu z lokal).
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.3, 12);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x14141a });
  const wheels = [];
  for (const [wx, wz] of [
    [bodyLen / 2 - 0.7, bodyWid / 2],
    [bodyLen / 2 - 0.7, -bodyWid / 2],
    [-bodyLen / 2 + 0.7, bodyWid / 2],
    [-bodyLen / 2 + 0.7, -bodyWid / 2],
  ]) {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.x = Math.PI / 2;
    wheel.position.set(wx, 0.36, wz);
    group.add(wheel);
    wheels.push(wheel);
  }
  return { group, wheels };
}

// Bangun 10 mobil parkir (5 terkunci) + Kancil M2 di petak parkir barat.
export function buildVehicles(THREE, scene) {
  const vehicles = [];
  const usedSpots = PARKING_SPOTS.slice(0, PARKED_COUNT);
  for (let i = 0; i < usedSpots.length; i++) {
    const spot = usedSpots[i];
    const isKancilSpot = i === 4; // petak ke-5 = Kancil (-88, 44)
    const color = isKancilSpot ? PALETTE.kancilOrange : CAR_COLORS[i % CAR_COLORS.length];
    const type = isKancilSpot ? 'kancil' : 'sedan';
    const { group, wheels } = makeCarMesh(THREE, color, type);
    const rotY = isKancilSpot ? KANCIL.rotY : Math.PI / 2;
    group.position.set(spot.x, 0, spot.z);
    group.rotation.y = rotY - Math.PI / 2;
    scene.add(group);
    vehicles.push({
      mesh: group,
      wheels,
      x: spot.x,
      z: spot.z,
      heading: rotY,
      speed: 0,
      type,
      locked: isKancilSpot ? true : i < PARKED_LOCKED,
      label: isKancilSpot ? KANCIL.label : `Mobil warga ${i + 1}`,
      driven: false,
    });
  }
  return vehicles;
}

// Cari Kancil M2 di daftar kendaraan (dipakai main.js staging cover).
export function findKancil(vehicles) {
  return vehicles.find((v) => v.type === 'kancil');
}

// Mobil warga terdekat yang terkunci dari titik (x, z).
export function nearestLockedVehicle(vehicles, x, z) {
  let best = null;
  let bestD = Infinity;
  for (const v of vehicles) {
    if (!v.locked || v.driven) continue;
    const dx = v.x - x;
    const dz = v.z - z;
    const d = dx * dx + dz * dz;
    if (d < bestD) {
      bestD = d;
      best = v;
    }
  }
  return best;
}

// ---- Tambahan: helper warna + putar roda (revisi ke-2) ----

// Ganti warna cat mobil (dipakai staging: mobil biru di shot jalan kaki).
export function recolorCar(vehicle, colorHex) {
  vehicle.mesh.traverse((child) => {
    if (child.material && child.material.color && child.isMesh) {
      // Hanya bodi yang dicat ulang: kenali dari ukuran kotak bodi.
      if (child.geometry && child.geometry.parameters && child.geometry.parameters.width >= 3) {
        child.material = child.material.clone();
        child.material.color.setHex(colorHex);
      }
    }
  });
}

// Putar roda sesuai jarak tempuh (dipanggil world/index tiap frame).
export function spinWheels(vehicle, dt) {
  if (!vehicle.wheels || !vehicle.speed) return;
  const angle = (vehicle.speed * dt) / 0.36;
  for (const w of vehicle.wheels) {
    w.rotation.z -= angle;
  }
}

// Pindahkan kendaraan (logika + mesh) ke posisi baru.
export function placeVehicle(vehicle, x, z, heading) {
  vehicle.x = x;
  vehicle.z = z;
  vehicle.heading = heading;
  vehicle.mesh.position.set(x, 0, z);
  vehicle.mesh.rotation.y = heading - Math.PI / 2;
}
