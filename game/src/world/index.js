// world/index.js — Perakit dunia ARUNIKA BAY.
// buildWorld(THREE, scene) mengembalikan objek dunia sesuai kontrak:
// scene, config, colliders, roads, vehicles, pedestrians, traffic,
// spawnPoints, update(dt, input). Loop sinkron mesh mobil yang dikemudikan
// WAJIB di sini, satu tempat — bukan tersebar di modul lain.

import * as config from './config.js';
import { buildLighting } from './lighting.js';
import { buildCity } from './city.js';
import { buildVehicles } from './vehicles.js';
import { createTraffic } from './traffic.js';
import { buildPedestrians } from './pedestrians.js';
import { createCollision } from './collision.js';

export function buildWorld(THREE, scene) {
  const lighting = buildLighting(THREE, scene);
  const city = buildCity(THREE, scene);
  const vehicles = buildVehicles(THREE, scene);
  const traffic = createTraffic(THREE, scene, city.roads);
  const pedestrians = buildPedestrians(THREE, scene);
  const collision = createCollision(city.colliders);

  let frozen = false;

  // Majukan dunia satu langkah. Saat frozen (staging shot), lalu lintas
  // dan pejalan kaki diam — tapi sinkron mesh mobil yang dikemudikan
  // tetap jalan supaya Kancil mengikuti data gameplay.
  function update(dt, input) {
    void input;
    if (!frozen) {
      traffic.update(dt);
      pedestrians.update(dt);
    }
    // SATU-SATUNYA tempat sinkron mesh mobil driven (kontrak).
    for (const v of vehicles) {
      if (!v.driven) continue;
      v.mesh.position.set(v.x, 0, v.z);
      v.mesh.rotation.y = v.heading - Math.PI / 2;
      if (v.wheels && v.speed) {
        const angle = (v.speed * dt) / 0.36;
        for (const w of v.wheels) w.rotation.z -= angle;
      }
    }
  }

  function setFrozen(value) {
    frozen = !!value;
  }

  function isFrozen() {
    return frozen;
  }

  return {
    scene,
    config,
    lighting,
    city,
    colliders: city.colliders,
    collision,
    roads: city.roads,
    vehicles,
    pedestrians: pedestrians.list,
    pedestriansApi: pedestrians,
    traffic: traffic.list,
    trafficApi: traffic,
    spawnPoints: {
      player: { x: config.SPAWN_POINTS.player.x, z: config.SPAWN_POINTS.player.z, yaw: config.SPAWN_POINTS.player.yaw },
      kancil: { x: config.SPAWN_POINTS.kancil.x, z: config.SPAWN_POINTS.kancil.z },
    },
    update,
    setFrozen,
    isFrozen,
  };
}

// ---- Tambahan: utilitas dunia untuk gameplay + tes (revisi ke-2) ----

// Ekspor ulang nama-nama penting supaya modul lain cukup import dari sini.
export { config };
export { buildLighting, SUN_RADIUS, SUN_POSITION } from './lighting.js';
export { buildCity, buildRoadGraph } from './city.js';
export { buildVehicles, findKancil } from './vehicles.js';
export { createTraffic } from './traffic.js';
export { buildPedestrians } from './pedestrians.js';
export { createCollision, hitsAny, dist2D } from './collision.js';
export { districtAt } from './config.js';
