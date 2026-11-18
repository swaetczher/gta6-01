// traffic.js — Mobil AI di graf jalan ARUNIKA BAY.
// Belasan mobil mengikuti graf jalan 5x5, lajur kanan, menjaga jarak
// dari mobil di depan, dan BERHENTI di lampu merah. Lampu lalu lintas
// di 4 persimpangan pusat bersiklus hijau/merah bergantian per arah.
// Deterministik: seed yang sama -> lalu lintas yang sama (screenshot).

import {
  ROAD_AXES,
  ROAD_WIDTH,
  TRAFFIC_COUNT,
  TRAFFIC_LIGHT_NODES,
  TRAFFIC_LIGHT_CYCLE,
} from './config.js';
import { buildVehicleMesh, spinWheels, vehicleSpec } from './vehicles.js';

// Graf jalan: simpul di tiap persimpangan (x, z), sisi ke 4 tetangga.
export function buildRoadGraph() {
  const nodes = [];
  const index = new Map();
  for (const x of ROAD_AXES) {
    for (const z of ROAD_AXES) {
      index.set(`${x},${z}`, nodes.length);
      nodes.push({ x, z, neighbors: [] });
    }
  }
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    for (const [dx, dz] of [[44, 0], [-44, 0], [0, 44], [0, -44]]) {
      const j = index.get(`${n.x + dx},${n.z + dz}`);
      if (j !== undefined) n.neighbors.push(j);
    }
  }
  return { nodes, index };
}

// Offset lajur kanan: di Indonesia kendaraan di lajur kiri jalan? —
// Brief desain menetapkan LAJUR KANAN untuk game ini (disepakati dengan
// Gameplay): mobil berjalan di sisi kanan arah jalannya.
function rightLaneOffset(dx, dz, lane = 2.4) {
  // Arah (dx,dz) ternormalisasi; kanan = putar -90 derajat.
  return { x: -dz * lane, z: dx * lane };
}

// Status lampu di simpul (x, z) untuk arah datang (dx, dz):
// hijau bila fase mengizinkan arah itu. Siklus 12 dtk: 6 dtk arah
// utara-selatan hijau, 6 dtk arah timur-barat hijau.
export function lightStateAt(nodeX, nodeZ, dx, dz, time) {
  const isLightNode = TRAFFIC_LIGHT_NODES.some((n) => n.x === nodeX && n.z === nodeZ);
  if (!isLightNode) return 'green';
  const phase = Math.floor(time / (TRAFFIC_LIGHT_CYCLE / 2)) % 2;
  const ns = dx === 0; // bergerak utara-selatan
  const greenNS = phase === 0;
  return ns === greenNS ? 'green' : 'red';
}

// Buat mobil traffic awal di ruas jalan acak (bukan di persimpangan).
export function spawnTraffic(THREE, scene, count = TRAFFIC_COUNT, seed = 77) {
  let s = seed >>> 0;
  const rand = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
  const graph = buildRoadGraph();
  const types = ['kancil', 'banteng', 'lentera', 'angkot', 'kancil', 'banteng'];
  const cars = [];
  for (let i = 0; i < count; i++) {
    const type = types[Math.floor(rand() * types.length)];
    const mesh = buildVehicleMesh(THREE, type);
    // Pilih ruas: simpul awal + tetangga acak.
    const from = Math.floor(rand() * graph.nodes.length);
    const node = graph.nodes[from];
    const to = node.neighbors[Math.floor(rand() * node.neighbors.length)];
    const target = graph.nodes[to];
    const dx = Math.sign(target.x - node.x);
    const dz = Math.sign(target.z - node.z);
    const along = rand() * 30 + 4; // meter dari simpul awal
    const off = rightLaneOffset(dx, dz);
    const x = node.x + dx * along + off.x;
    const z = node.z + dz * along + off.z;
    mesh.position.set(x, 0, z);
    // Badan mobil panjang di sumbu X lokal (vehicles.js: BoxGeometry
    // len,bodyH,wid; lampu depan di +X). rotation.y = t memetakan +X ke
    // (cos t, 0, -sin t), jadi arah gerak (dx,dz) butuh t = atan2(-dz,dx).
    // Rumus lama atan2(dx,dz) menghadapkan badan tegak lurus arah jalan
    // (mobil tampak melaju menyamping) — itu bug yang diperbaiki di sini.
    mesh.rotation.y = Math.atan2(-dz, dx);
    scene.add(mesh);
    cars.push({
      mesh,
      type,
      name: vehicleSpec(type).name,
      parked: false,
      locked: false,
      driven: false,
      from,
      to,
      along,
      x,
      z,
      heading: Math.atan2(dx, dz),
      speed: 7 + rand() * 4,
      cruise: 8 + rand() * 4,
      stopped: false,
    });
  }
  return { cars, graph };
}

// Jumlah mobil traffic yang sedang berhenti (lampu merah / antrean).
// Dipakai HUD Gameplay untuk statistik kota + debug screenshot.
export function countStoppedCars(traffic) {
  return traffic.cars.filter((c) => c.stopped).length;
}

// Jarak ke mobil terdekat di depan (searah jalur yang sama, < 25 m).
function carAhead(car, cars) {
  let best = Infinity;
  for (const other of cars) {
    if (other === car || other.driven) continue;
    const dx = other.x - car.x;
    const dz = other.z - car.z;
    const dist = Math.hypot(dx, dz);
    if (dist > 25 || dist < 0.01) continue;
    // Hanya yang berada di depan (searah heading).
    const fx = Math.sin(car.heading);
    const fz = Math.cos(car.heading);
    const dot = (dx * fx + dz * fz) / dist;
    if (dot > 0.85 && dist < best) best = dist;
  }
  return best;
}

// Majukan semua mobil traffic satu frame. `time` = waktu game (detik).
// Aturan: jaga jarak 9 m dari mobil depan; berhenti 10 m sebelum
// persimpangan bila lampu merah untuk arahnya; belok acak di simpul.
export function updateTraffic(traffic, dt, time) {
  const { cars, graph } = traffic;
  for (const car of cars) {
    if (car.driven) continue; // sedang dikemudikan pemain — Gameplay yang gerakkan
    const fromNode = graph.nodes[car.from];
    const toNode = graph.nodes[car.to];
    const dx = Math.sign(toNode.x - fromNode.x);
    const dz = Math.sign(toNode.z - fromNode.z);
    const edgeLen = Math.abs(toNode.x - fromNode.x) + Math.abs(toNode.z - fromNode.z);

    // Lampu merah: berhenti bila < 12 m dari simpul tujuan.
    const distToNode = edgeLen - car.along;
    let wantStop = false;
    if (distToNode < 12 && distToNode > 0) {
      const state = lightStateAt(toNode.x, toNode.z, dx, dz, time);
      if (state === 'red') wantStop = true;
    }
    // Jaga jarak: mobil depan < 9 m -> berhenti.
    const ahead = carAhead(car, cars);
    if (ahead < 9) wantStop = true;

    const targetSpeed = wantStop ? 0 : car.cruise;
    car.speed += Math.max(-14 * dt, Math.min(8 * dt, targetSpeed - car.speed));
    if (car.speed < 0.05) car.speed = 0;
    car.stopped = car.speed === 0 && wantStop;
    const moved = car.speed * dt;
    car.along += moved;

    if (car.along >= edgeLen) {
      // Sampai simpul: pilih tetangga berikutnya (bukan putar balik).
      const next = toNode.neighbors.filter((n) => n !== car.from);
      const pick = next[Math.floor(Math.random() * next.length)];
      car.from = car.to;
      car.to = pick;
      car.along = 0;
    }
    // Posisi + heading dari ruas saat ini (lajur kanan).
    const cur = graph.nodes[car.from];
    const nxt = graph.nodes[car.to];
    const ndx = Math.sign(nxt.x - cur.x);
    const ndz = Math.sign(nxt.z - cur.z);
    const off = rightLaneOffset(ndx, ndz);
    car.x = cur.x + ndx * car.along + off.x;
    car.z = cur.z + ndz * car.along + off.z;
    car.heading = Math.atan2(ndx, ndz);
    car.mesh.position.set(car.x, 0, car.z);
    // Putaran mesh dari heading: heading memakai konvensi gameplay
    // (maju = (sin h, cos h)) yang dipakai carAhead, kamera drive, dan
    // player.js — JANGAN diubah definisinya. Badan sumbu-X butuh
    // rotation.y = heading - PI/2, sama dengan atan2(-ndz, ndx).
    // Baris lama (rotation.y = car.heading) membuat mobil traffic
    // tampak menyamping, sama seperti bug di spawn di atas.
    car.mesh.rotation.y = car.heading - Math.PI / 2;
    spinWheels(car.mesh, moved);
  }
  return cars;
}

// Mesh lampu lalu lintas di 4 persimpangan pusat: tiang + 3 bola lampu
// (merah/kuning/hijau). Bola yang aktif emissive terang; yang mati redup.
// `updateTrafficLights` menyalakan bola yang benar tiap frame.
export function buildTrafficLights(THREE, scene) {
  const rigs = [];
  for (const node of TRAFFIC_LIGHT_NODES) {
    const group = new THREE.Group();
    group.name = `LampuLalin-${node.x}-${node.z}`;
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x2a2e33, roughness: 0.6, metalness: 0.5 });
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 5.4, 8), poleMat);
    pole.position.set(node.x + 7.5, 2.7, node.z + 7.5);
    pole.castShadow = true;
    group.add(pole);
    const boxMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1c, roughness: 0.7 });
    const boxMesh = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.9, 0.7), boxMat);
    boxMesh.position.set(node.x + 7.5, 5.6, node.z + 7.5);
    group.add(boxMesh);
    const mk = (color, y) => {
      const m = new THREE.Mesh(
        new THREE.SphereGeometry(0.24, 10, 8),
        new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.15 }),
      );
      m.position.set(node.x + 7.5, y, node.z + 7.5 + 0.36);
      group.add(m);
      return m;
    };
    const red = mk(0xff2222, 6.2);
    const yellow = mk(0xffcc22, 5.6);
    const green = mk(0x22cc44, 5.0);
    scene.add(group);
    rigs.push({ x: node.x, z: node.z, red, yellow, green });
  }
  return rigs;
}

// Nyalakan bola lampu yang sesuai fase waktu game.
export function updateTrafficLights(rigs, time) {
  const phase = Math.floor(time / (TRAFFIC_LIGHT_CYCLE / 2)) % 2;
  for (const rig of rigs) {
    // Fase 0: utara-selatan hijau; fase 1: timur-barat hijau.
    const nsGreen = phase === 0;
    rig.green.material.emissiveIntensity = nsGreen ? 2.2 : 0.15;
    rig.red.material.emissiveIntensity = nsGreen ? 0.15 : 2.2;
    rig.yellow.material.emissiveIntensity = 0.15;
  }
}
