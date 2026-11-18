// ARUNIKA BAY — 28 pejalan kaki di trotoar (tulis ulang round 2).
// Tiap pejalan kaki berjalan mondar-mandir di satu ruas trotoar, dengan
// goyangan langkah (bob) dan arah hadap mengikuti arah jalan.
import { PEDESTRIAN_COUNT, AVENUES, STREETS, mulberry32 } from './config.js';

const SHIRT_COLORS = [0x3f8a4a, 0xc23a2e, 0x2e6ac2, 0xe8b820, 0x8a4a9a, 0xd8d2c8, 0x3a8a8a];
const SKIN_COLORS = [0xc89878, 0x8a5a3a, 0xe8b898, 0x6a4028];

// Satu pejalan kaki: badan + kepala + topi kerucut opsional (khas Lentera).
export function makePedestrianMesh(THREE, shirtColor, withConeHat = false) {
  const group = new THREE.Group();
  const shirt = new THREE.MeshStandardMaterial({ color: shirtColor, roughness: 0.9 });
  const skin = new THREE.MeshStandardMaterial({
    color: SKIN_COLORS[Math.floor(Math.random() * SKIN_COLORS.length)], roughness: 0.8,
  });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.32, 0.95, 8), shirt);
  body.position.y = 0.85;
  body.castShadow = true;
  group.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 8), skin);
  head.position.y = 1.55;
  head.castShadow = true;
  group.add(head);
  if (withConeHat) {
    const hat = new THREE.Mesh(
      new THREE.ConeGeometry(0.42, 0.5, 12),
      new THREE.MeshStandardMaterial({ color: 0xd8b858, roughness: 0.7 }),
    );
    hat.position.y = 1.85;
    hat.castShadow = true;
    group.add(hat);
    group.userData.coneHat = true;
  }
  const legMat = new THREE.MeshStandardMaterial({ color: 0x2e2a33, roughness: 1 });
  for (const sx of [-0.12, 0.12]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.5, 6), legMat);
    leg.position.set(sx, 0.25, 0);
    group.add(leg);
  }
  group.userData.shirtColor = shirtColor;
  return group;
}

// Lahirkan 28 pejalan kaki di ruas trotoar acak (deterministik seed 11).
// Pejalan kaki #0 memakai topi kerucut + baju hijau — dipakai shot foot.
export function spawnPedestrians(THREE, scene) {
  const rng = mulberry32(11);
  const peds = [];
  for (let i = 0; i < PEDESTRIAN_COUNT; i++) {
    const horizontal = rng() > 0.5;
    const road = horizontal
      ? STREETS[Math.floor(rng() * STREETS.length)]
      : AVENUES[Math.floor(rng() * AVENUES.length)];
    const along = -100 + rng() * 200;
    const side = (rng() > 0.5 ? 1 : -1) * (6.5 + rng() * 2);
    const x = horizontal ? along : road + side;
    const z = horizontal ? road + side : along;
    const coneHat = i === 0;
    const shirt = coneHat ? 0x3f8a4a : SHIRT_COLORS[Math.floor(rng() * SHIRT_COLORS.length)];
    const mesh = makePedestrianMesh(THREE, shirt, coneHat);
    mesh.position.set(x, 0, z);
    scene.add(mesh);
    peds.push({
      mesh,
      x,
      z,
      heading: rng() * Math.PI * 2,
      speed: 0.9 + rng() * 0.9,
      phase: rng() * Math.PI * 2,
      horizontal,
      road,
      side,
      along,
      dir: rng() > 0.5 ? 1 : -1,
      coneHat,
    });
  }
  return peds;
}

// Majukan pejalan kaki di ruasnya; berbalik di ujung jalan (-110 / 110).
export function updatePedestrians(peds, dt, t) {
  for (const p of peds) {
    p.along += p.dir * p.speed * dt;
    if (p.along > 110) {
      p.along = 110;
      p.dir = -1;
    } else if (p.along < -110) {
      p.along = -110;
      p.dir = 1;
    }
    if (p.horizontal) {
      p.x = p.along;
      p.z = p.road + p.side;
      p.heading = p.dir > 0 ? 0 : Math.PI;
    } else {
      p.x = p.road + p.side;
      p.z = p.along;
      p.heading = p.dir > 0 ? -Math.PI / 2 : Math.PI / 2;
    }
    p.mesh.position.set(p.x, Math.abs(Math.sin(t * 6 + p.phase)) * 0.06, p.z);
    p.mesh.rotation.y = p.heading;
  }
}

// Pejalan kaki bertopi kerucut (dipakai staging shot foot).
export function findConeHatPedestrian(peds) {
  return peds.find((p) => p.coneHat) || peds[0] || null;
}
