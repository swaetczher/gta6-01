// ARUNIKA BAY — graf jalan + lalu lintas 14 mobil (tulis ulang round 2).
// Graf: simpul di tiap persimpangan avenue x street, sisi antar simpul
// bertetangga. Mobil memilih sisi berikutnya di tiap simpul secara acak.
import { AVENUES, STREETS, TRAFFIC_COUNT } from './config.js';
import { makeCarMesh, spinWheels } from './vehicles.js';

export function buildRoadGraph() {
  const nodes = [];
  const index = new Map();
  for (const x of AVENUES) {
    for (const z of STREETS) {
      index.set(`${x},${z}`, nodes.length);
      nodes.push({ x, z });
    }
  }
  const edges = [];
  const addEdge = (ax, az, bx, bz) => {
    const a = index.get(`${ax},${az}`);
    const b = index.get(`${bx},${bz}`);
    if (a === undefined || b === undefined) return;
    edges.push({ a, b });
  };
  for (let i = 0; i < AVENUES.length - 1; i++) {
    for (const z of STREETS) addEdge(AVENUES[i], z, AVENUES[i + 1], z);
  }
  for (let i = 0; i < STREETS.length - 1; i++) {
    for (const x of AVENUES) addEdge(x, STREETS[i], x, STREETS[i + 1]);
  }
  // Daftar sisi keluar per simpul (dua arah).
  const adjacency = nodes.map(() => []);
  for (let e = 0; e < edges.length; e++) {
    adjacency[edges[e].a].push(e);
    adjacency[edges[e].b].push(e);
  }
  return { nodes, edges, adjacency };
}

// Sisi tetangga acak dari sebuah simpul, jangan langsung putar balik.
export function pickNextEdge(graph, nodeIdx, cameFromEdge) {
  const options = graph.adjacency[nodeIdx].filter((e) => e !== cameFromEdge);
  const pool = options.length > 0 ? options : graph.adjacency[nodeIdx];
  if (pool.length === 0) return -1;
  return pool[Math.floor(Math.random() * pool.length)];
}

const TRAFFIC_COLORS = [0xe8b820, 0xc23a2e, 0x2e6ac2, 0x3a8a4a, 0xd8d2c8, 0x8a8f96, 0x6a3a8a];
const TRAFFIC_TYPES = ['sedan', 'sedan', 'sedan', 'taxi', 'truck', 'sedan', 'sedan'];

// Lahirkan 14 mobil di sisi graf yang tersebar, kecepatan 6–11 m/dtk.
export function spawnTraffic(THREE, scene, roads) {
  const traffic = [];
  for (let i = 0; i < TRAFFIC_COUNT; i++) {
    const edgeIdx = (i * 3 + 1) % roads.edges.length;
    const edge = roads.edges[edgeIdx];
    const from = roads.nodes[edge.a];
    const to = roads.nodes[edge.b];
    const t = (i % 5) / 5;
    const x = from.x + (to.x - from.x) * t;
    const z = from.z + (to.z - from.z) * t;
    const color = TRAFFIC_COLORS[i % TRAFFIC_COLORS.length];
    const type = TRAFFIC_TYPES[i % TRAFFIC_TYPES.length];
    const mesh = makeCarMesh(THREE, color, type);
    mesh.position.set(x, 0, z);
    scene.add(mesh);
    traffic.push({
      mesh,
      x,
      z,
      heading: 0,
      speed: 6 + (i % 6),
      type,
      locked: false,
      label: type === 'taxi' ? 'Taksi' : 'Mobil lalu lintas',
      driven: false,
      edge: edgeIdx,
      from: edge.a,
      to: edge.b,
      progress: t,
    });
  }
  // Heading awal dari arah sisi masing-masing.
  for (const car of traffic) updateCarHeading(car, roads);
  return traffic;
}

// Arah hadap dari arah gerak: heading = atan2(-dz, dx) (rumus kontrak).
export function updateCarHeading(car, roads) {
  const from = roads.nodes[car.from];
  const to = roads.nodes[car.to];
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  car.heading = Math.atan2(-dz, dx);
  car.mesh.rotation.y = car.heading - Math.PI / 2;
}

// Majukan semua mobil traffic sepanjang sisinya; di simpul pilih sisi baru.
export function updateTraffic(traffic, roads, dt) {
  for (const car of traffic) {
    const from = roads.nodes[car.from];
    const to = roads.nodes[car.to];
    const len = Math.hypot(to.x - from.x, to.z - from.z) || 1;
    car.progress += (car.speed * dt) / len;
    if (car.progress >= 1) {
      const arrived = car.to;
      const next = pickNextEdge(roads, arrived, car.edge);
      if (next < 0) {
        car.progress = 0;
        continue;
      }
      const e = roads.edges[next];
      car.edge = next;
      car.from = e.a === arrived ? e.a : e.b;
      car.to = e.a === arrived ? e.b : e.a;
      car.progress = 0;
      updateCarHeading(car, roads);
    }
    const a = roads.nodes[car.from];
    const b = roads.nodes[car.to];
    car.x = a.x + (b.x - a.x) * car.progress;
    car.z = a.z + (b.z - a.z) * car.progress;
    car.mesh.position.set(car.x, 0, car.z);
    spinWheels(car.mesh, car.speed * dt);
  }
}
