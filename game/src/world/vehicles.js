// ARUNIKA BAY — mobil: bangun mesh + 10 spot parkir incl. Kancil M2 (round 2).
// Arah hadap mesh: depan mobil menghadap -z lokal, sehingga putaran dunia
// memakai rumus kontrak: mesh.rotation.y = heading - PI/2.
import { PALETTE, KANCIL_SPOT } from './config.js';

const PARKED_COLORS = [0xc23a2e, 0x2e6ac2, 0xe8b820, 0x3a8a4a, 0x8a8f96, 0xd8d2c8, 0x6a3a8a, 0x2a9a8a, 0xb0563a];

// Satu mobil sederhana: bodi + kabin + 4 roda + lampu depan.
export function makeCarMesh(THREE, color, type = 'sedan') {
  const group = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.45 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x1a2a3a, roughness: 0.15, metalness: 0.6 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x1a1a1e, roughness: 0.9 });
  const bodyH = type === 'truck' ? 1.5 : 0.85;
  const bodyL = type === 'truck' ? 5.4 : 4.2;
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.9, bodyH, bodyL), paint);
  body.position.y = 0.65;
  body.castShadow = true;
  group.add(body);
  if (type !== 'truck') {
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.75, 2.1), glass);
    cabin.position.set(0, 1.4, 0.25);
    cabin.castShadow = true;
    group.add(cabin);
  } else {
    const bed = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.5, 2.6), dark);
    bed.position.set(0, 1.5, 0.9);
    group.add(bed);
  }
  // Lampu depan (depan = -z) + belakang.
  const lampMat = new THREE.MeshStandardMaterial({
    color: 0xfff2b8, emissive: 0xffe98a, emissiveIntensity: 0.9,
  });
  for (const sx of [-0.6, 0.6]) {
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.22, 0.1), lampMat);
    head.position.set(sx, 0.7, -bodyL / 2 - 0.03);
    group.add(head);
    const tail = new THREE.Mesh(
      new THREE.BoxGeometry(0.34, 0.2, 0.1),
      new THREE.MeshStandardMaterial({ color: 0xa01818, emissive: 0x881010, emissiveIntensity: 0.6 }),
    );
    tail.position.set(sx, 0.7, bodyL / 2 + 0.03);
    group.add(tail);
  }
  // Roda: silinder diputar 90 derajat, disimpan di userData untuk spinWheels.
  const wheels = [];
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.3, 12);
  for (const [wx, wz] of [[-0.95, -1.35], [0.95, -1.35], [-0.95, 1.35], [0.95, 1.35]]) {
    const wheel = new THREE.Mesh(wheelGeo, dark);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(wx, 0.36, wz);
    wheel.castShadow = true;
    group.add(wheel);
    wheels.push(wheel);
  }
  group.userData.wheels = wheels;
  group.userData.type = type;
  return group;
}

// Putar roda sesuai jarak tempuh (meter) — dipanggil world.update.
export function spinWheels(mesh, distance) {
  const wheels = mesh.userData.wheels || [];
  const angle = distance / 0.36;
  for (const w of wheels) w.rotation.x += angle;
}

// 10 spot parkir di tepi jalan — 5 terkunci (salah satunya Kancil M2).
// heading = arah hadap mobil; mesh diputar rotY - PI/2 sesuai kontrak.
const PARKED_SPOTS = [
  { ...KANCIL_SPOT },
  { x: 44, z: -36, rotY: 0, type: 'sedan', locked: true, label: 'Sedan biru' },
  { x: -36, z: 84, rotY: Math.PI, type: 'sedan', locked: false, label: 'Sedan merah' },
  { x: 84, z: 6, rotY: Math.PI / 2, type: 'truck', locked: true, label: 'Truk hijau' },
  { x: -84, z: -76, rotY: -Math.PI / 2, type: 'sedan', locked: false, label: 'Sedan kuning' },
  { x: 36, z: 84, rotY: 0, type: 'sedan', locked: true, label: 'Sedan putih' },
  { x: -44, z: -4, rotY: Math.PI, type: 'taxi', locked: false, label: 'Taksi kuning' },
  { x: 76, z: -44, rotY: Math.PI / 2, type: 'sedan', locked: false, label: 'Sedan ungu' },
  { x: -4, z: -84, rotY: 0, type: 'sedan', locked: true, label: 'Sedan abu-abu' },
  { x: 4, z: 36, rotY: -Math.PI / 2, type: 'sedan', locked: false, label: 'Sedan teal' },
];

export function buildParkedVehicles(THREE, scene) {
  const vehicles = [];
  for (let i = 0; i < PARKED_SPOTS.length; i++) {
    const spot = PARKED_SPOTS[i];
    const color = spot.type === 'kancil' ? 0xc23a2e : PARKED_COLORS[i % PARKED_COLORS.length];
    const mesh = makeCarMesh(THREE, color, spot.type);
    mesh.position.set(spot.x, 0, spot.z);
    mesh.rotation.y = spot.rotY - Math.PI / 2;
    scene.add(mesh);
    vehicles.push({
      mesh,
      x: spot.x,
      z: spot.z,
      heading: spot.rotY,
      speed: 0,
      type: spot.type,
      locked: spot.locked,
      label: spot.label,
      driven: false,
    });
  }
  return vehicles;
}

// Cari mobil parkir terdekat dari titik (dipakai pemain saat menahan E).
export function nearestParkedVehicle(vehicles, x, z, maxDist = 4) {
  let best = null;
  let bestD = maxDist;
  for (const v of vehicles) {
    const d = Math.hypot(v.x - x, v.z - z);
    if (d < bestD) {
      bestD = d;
      best = v;
    }
  }
  return best;
}

// Kancil M2 curian — dicari gameplay saat misi M2 dimulai.
export function findKancil(vehicles) {
  return vehicles.find((v) => v.type === 'kancil') || null;
}
