// vehicles.js — Model kendaraan prosedural orisinal ARUNIKA BAY.
// Enam tipe: Kancil (sedan), Banteng (pikap), Lentera Cab (taksi),
// Polair Arunika (polisi pelabuhan), Angkot Fajar (minibus),
// Truk Dermaga (truk kontainer). Semua dari Box/Cylinder — tanpa aset
// eksternal, tanpa merek nyata. Satu pabrik `buildVehicleMesh` dipakai
// traffic, parkir, dan mobil yang dikemudikan pemain (konsisten).

import { VEHICLE_TYPES } from './config.js';

function material(THREE, color, opts = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.35, ...opts });
}

// Dimensi tiap tipe (panjang x lebar x tinggi badan, meter).
const DIMENSIONS = {
  kancil: { len: 4.2, wid: 1.9, bodyH: 0.75, cabH: 0.6, cabLen: 2.1, wheels: 4 },
  banteng: { len: 4.8, wid: 2.0, bodyH: 0.8, cabH: 0.65, cabLen: 2.2, wheels: 4 },
  lentera: { len: 4.2, wid: 1.9, bodyH: 0.75, cabH: 0.6, cabLen: 2.1, wheels: 4 },
  polair: { len: 4.5, wid: 2.0, bodyH: 0.8, cabH: 0.65, cabLen: 2.3, wheels: 4 },
  angkot: { len: 5.2, wid: 2.1, bodyH: 1.5, cabH: 0.9, cabLen: 3.4, wheels: 4 },
  truk: { len: 7.5, wid: 2.4, bodyH: 1.1, cabH: 0.9, cabLen: 1.8, wheels: 6 },
};

export function vehicleSpec(typeId) {
  const spec = VEHICLE_TYPES.find((v) => v.id === typeId);
  if (!spec) throw new Error(`Tipe kendaraan tidak dikenal: ${typeId}`);
  return spec;
}

// Bangun mesh mobil untuk `typeId`. Mengembalikan THREE.Group dengan
// userData { typeId, name, kind, topSpeed, accel, wheelMeshes, lightBar }.
// Roda disimpan terpisah supaya Gameplay bisa memutarnya saat mengemudi.
export function buildVehicleMesh(THREE, typeId, colorOverride = null) {
  const spec = vehicleSpec(typeId);
  const dim = DIMENSIONS[typeId];
  const color = colorOverride ?? spec.color;
  const group = new THREE.Group();
  group.name = `Kendaraan-${spec.name}`;

  const bodyMat = material(THREE, color);
  const glassMat = material(THREE, 0x1a2733, { roughness: 0.15, metalness: 0.6 });
  const darkMat = material(THREE, 0x1a1a1c, { roughness: 0.9 });
  const chromeMat = material(THREE, 0xc8ccd2, { roughness: 0.25, metalness: 0.8 });

  // Badan utama.
  const body = new THREE.Mesh(new THREE.BoxGeometry(dim.len, dim.bodyH, dim.wid), bodyMat);
  body.position.y = 0.55 + dim.bodyH / 2;
  body.castShadow = true;
  group.add(body);

  // Kabin + kaca.
  const cab = new THREE.Mesh(new THREE.BoxGeometry(dim.cabLen, dim.cabH, dim.wid - 0.25), glassMat);
  cab.position.set(typeId === 'truk' ? dim.len / 2 - 1.1 : -0.2, 0.55 + dim.bodyH + dim.cabH / 2, 0);
  cab.castShadow = true;
  group.add(cab);

  // Bak pikap / kontainer truk / atap taksi.
  if (typeId === 'banteng') {
    const bed = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.35, dim.wid - 0.3), darkMat);
    bed.position.set(-dim.len / 2 + 1.1, 0.55 + dim.bodyH + 0.17, 0);
    group.add(bed);
  }
  if (typeId === 'truk') {
    const boxCargo = new THREE.Mesh(
      new THREE.BoxGeometry(4.4, 2.2, dim.wid - 0.1),
      material(THREE, 0xc0392b, { metalness: 0.3 }),
    );
    boxCargo.position.set(-dim.len / 2 + 2.4, 0.55 + 1.1 + 0.4, 0);
    boxCargo.castShadow = true;
    group.add(boxCargo);
  }
  if (typeId === 'lentera') {
    // Papan "TAKSI" di atap + garis kuning khas Lentera Cab.
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.28, 0.5), material(THREE, 0x111111));
    sign.position.set(-0.2, 0.55 + dim.bodyH + dim.cabH + 0.14, 0);
    group.add(sign);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(dim.len - 0.4, 0.18, dim.wid + 0.02), material(THREE, 0x111111));
    stripe.position.set(0, 0.85, 0);
    group.add(stripe);
  }
  if (typeId === 'polair') {
    // Light bar polisi: biru + merah, emissive (menyala saat kejar-kejaran).
    const barBase = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.16, 0.6), darkMat);
    barBase.position.set(-0.2, 0.55 + dim.bodyH + dim.cabH + 0.08, 0);
    group.add(barBase);
    const blue = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.2, 0.55),
      material(THREE, 0x2244ff, { emissive: 0x2244ff, emissiveIntensity: 2 }),
    );
    blue.position.set(-0.45, 0.55 + dim.bodyH + dim.cabH + 0.22, 0);
    group.add(blue);
    const red = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.2, 0.55),
      material(THREE, 0xff2222, { emissive: 0xff2222, emissiveIntensity: 2 }),
    );
    red.position.set(0.05, 0.55 + dim.bodyH + dim.cabH + 0.22, 0);
    group.add(red);
    group.userData.lightBar = { blue, red };
    // Tulisan "POLAIR" disimulasikan strip putih di pintu.
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(dim.len - 0.6, 0.3, dim.wid + 0.02), material(THREE, 0xf2f2f2));
    stripe.position.set(0, 0.95, 0);
    group.add(stripe);
  }
  if (typeId === 'angkot') {
    // Garis trayek hijau + jendela samping banyak.
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(dim.len - 0.4, 0.25, dim.wid + 0.02), material(THREE, 0x2fa36b));
    stripe.position.set(0, 1.1, 0);
    group.add(stripe);
  }

  // Lampu depan (emissive kuning) + belakang (emissive merah).
  const headMat = material(THREE, 0xffe9a8, { emissive: 0xffe9a8, emissiveIntensity: 1.2 });
  const tailMat = material(THREE, 0xcc2222, { emissive: 0xcc2222, emissiveIntensity: 0.8 });
  for (const side of [-1, 1]) {
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.22, 0.4), headMat);
    head.position.set(dim.len / 2 + 0.02, 0.85, side * (dim.wid / 2 - 0.45));
    group.add(head);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.22, 0.4), tailMat);
    tail.position.set(-dim.len / 2 - 0.02, 0.85, side * (dim.wid / 2 - 0.45));
    group.add(tail);
  }

  // Roda: silinder diputar 90 derajat, disimpan untuk animasi putaran.
  const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 12);
  const wheels = [];
  const wheelX = typeId === 'truk'
    ? [dim.len / 2 - 1.1, -0.4, -dim.len / 2 + 1.0]
    : [dim.len / 2 - 1.0, -dim.len / 2 + 1.0];
  for (const wx of wheelX) {
    for (const side of [-1, 1]) {
      const wheel = new THREE.Mesh(wheelGeo, darkMat);
      wheel.rotation.x = Math.PI / 2;
      wheel.position.set(wx, 0.38, side * (dim.wid / 2 - 0.05));
      wheel.castShadow = true;
      group.add(wheel);
      wheels.push(wheel);
    }
  }
  // Pelek tipis supaya roda tidak polos.
  const hubMat = chromeMat;

  group.userData = {
    typeId: spec.id,
    name: spec.name,
    kind: spec.kind,
    topSpeed: spec.topSpeed,
    accel: spec.accel,
    length: dim.len,
    width: dim.wid,
    wheels,
    hubMat,
    lightBar: group.userData.lightBar || null,
  };
  return group;
}

// Kedipkan light bar polisi (biru/merah bergantian) — dipanggil tiap
// frame saat mobil polisi mengejar. `t` = waktu game (detik).
export function blinkLightBar(mesh, t) {
  const bar = mesh.userData.lightBar;
  if (!bar) return;
  const phase = Math.floor(t * 4) % 2 === 0;
  bar.blue.material.emissiveIntensity = phase ? 2.5 : 0.2;
  bar.red.material.emissiveIntensity = phase ? 0.2 : 2.5;
}

// Putar roda sesuai jarak tempuh (dipanggil tiap frame oleh traffic /
// Gameplay saat mengemudi). `distance` = meter sejak frame lalu.
export function spinWheels(mesh, distance) {
  const wheels = mesh.userData.wheels || [];
  const angle = distance / 0.38;
  for (const w of wheels) w.rotation.z -= angle;
}

// 10 mobil parkir di tempat yang masuk akal: parkiran Dermaga (M2),
// depan bengkel, sisi Distrik Niaga, dekat Pasar Terapung.
// `locked` = butuh aksi curi (Gameplay): 5 dari 10 terkunci —
// termasuk Kancil M2 di parkiran Dermaga (x -88, z 44), supaya misi M2
// "curi mobil (tahan E)" berfungsi dari data dunia, bukan cuma dari
// adaptor gameplay (world-adapter.js yang selama ini memaksanya).
// `rotY` = heading logika mobil itu (konvensi gameplay: maju =
// (sin h, cos h)). Putaran mesh-nya BUKAN rotY mentah: badan mobil
// panjang di sumbu-X (lampu depan di +X), jadi rotation.y = rotY - PI/2
// supaya mesh menghadap arah maju logika — sama seperti traffic
// (traffic.js, Repair). RotY mentah membuat mesh menghadap tegak lurus
// arah jalan dan melompat visual saat pemain masuk mobil.
export const PARKED_SPOTS = [
  { x: -88, z: 44, rotY: Math.PI / 2, type: 'kancil', locked: true, label: 'M2 — Kancil curian' },
  { x: -84, z: 44, rotY: Math.PI / 2, type: 'banteng', locked: true },
  { x: -88, z: 52, rotY: Math.PI / 2, type: 'lentera', locked: false },
  { x: -22, z: -58, rotY: 0, type: 'kancil', locked: false },
  { x: -14, z: -58, rotY: 0, type: 'angkot', locked: true },
  { x: 44, z: -52, rotY: 0, type: 'kancil', locked: false },
  { x: 52, z: -52, rotY: 0, type: 'banteng', locked: true },
  { x: 22, z: 30, rotY: Math.PI / 2, type: 'lentera', locked: false },
  { x: 66, z: 30, rotY: Math.PI / 2, type: 'kancil', locked: true },
  { x: -44, z: 74, rotY: 0, type: 'truk', locked: false },
];

// Bangun 10 mobil parkir ke scene. Mengembalikan daftar objek mobil hidup
// (dipakai world.cars): { mesh, type, parked, locked, driven, x, z, heading, speed }.
export function buildParkedCars(THREE, scene) {
  const cars = [];
  for (const spot of PARKED_SPOTS) {
    const mesh = buildVehicleMesh(THREE, spot.type);
    mesh.position.set(spot.x, 0, spot.z);
    // Putaran mesh = rotY - PI/2 (bukan rotY mentah): badan sumbu-X,
    // rotation.y = t memetakan +X ke (cos t, 0, -sin t), jadi mesh
    // menghadap arah maju logika (sin rotY, cos rotY). RotY mentah
    // menghadapkan mesh tegak lurus arah maju (mis. rotY PI/2 menghadap
    // -Z padahal logika bergerak +X) — lihat traffic.js (Repair).
    mesh.rotation.y = spot.rotY - Math.PI / 2;
    scene.add(mesh);
    cars.push({
      mesh,
      type: spot.type,
      name: vehicleSpec(spot.type).name,
      parked: true,
      locked: spot.locked,
      driven: false,
      x: spot.x,
      z: spot.z,
      heading: spot.rotY,
      speed: 0,
      label: spot.label || null,
    });
  }
  return cars;
}
