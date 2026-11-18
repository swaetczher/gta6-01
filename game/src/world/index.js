// ARUNIKA BAY — perakit dunia: buildWorld(THREE, scene) (tulis ulang round 2).
// Kontrak (CONTRACT.md): kembalikan { scene, config, colliders, roads,
// vehicles, pedestrians, traffic, spawnPoints, update(dt, input) }.
// Loop sinkron mesh mobil driven HANYA ada di update() sini, satu tempat.
import { CONFIG, SPAWN } from './config.js';
import { buildCity } from './city.js';
import { buildLighting, updateLighting } from './lighting.js';
import { buildRoadGraph, spawnTraffic, updateTraffic } from './traffic.js';
import { spawnPedestrians, updatePedestrians } from './pedestrians.js';
import { buildParkedVehicles, spinWheels } from './vehicles.js';
import { makeCollision } from './collision.js';
import { renderMinimap } from './minimap.js';

export function buildWorld(THREE, scene) {
  const city = buildCity(THREE, scene);
  const lighting = buildLighting(THREE, scene);
  const roads = buildRoadGraph();
  const vehicles = buildParkedVehicles(THREE, scene);
  const traffic = spawnTraffic(THREE, scene, roads);
  const pedestrians = spawnPedestrians(THREE, scene);
  const collision = makeCollision(city.colliders);
  const colliders = city.colliders;

  const world = {
    scene,
    config: CONFIG,
    colliders,
    collision,
    roads,
    vehicles,
    pedestrians,
    traffic,
    landmarks: city.landmarks,
    lighting,
    spawnPoints: {
      player: { ...SPAWN.player },
      kancil: { ...SPAWN.kancil },
    },
    elapsed: 0,
    // Majukan traffic, pejalan kaki, sinkron mesh mobil driven, minimap.
    update(dt, input) {
      const step = Math.min(dt, 0.05);
      world.elapsed += step;
      updateTraffic(traffic, roads, step);
      updatePedestrians(pedestrians, step, world.elapsed);
      updateLighting(lighting, step, world.elapsed);
      // Sinkron mesh mobil driven — SATU-SATUNYA tempat sinkron ini.
      for (const car of vehicles) {
        if (!car.driven) continue;
        car.mesh.position.set(car.x, 0, car.z);
        car.mesh.rotation.y = car.heading - Math.PI / 2;
        spinWheels(car.mesh, (car.speed || 0) * step);
      }
      // Minimap 2D bila canvas #minimap ada di halaman.
      if (typeof document !== 'undefined') {
        const canvas = document.getElementById('minimap');
        if (canvas) {
          const focus = (input && input.minimapFocus) || null;
          renderMinimap(canvas, world, focus);
        }
      }
    },
  };
  return world;
}

// Utilitas dunia untuk gameplay (lewat objek world, tanpa import silang):
// - worldPosOf(vehicle): posisi mesh saat ini
// - nearestVehicle(world, x, z, maxDist): mobil parkir terdekat
// - districtAtPoint(world, x, z): nama distrik dari config
export function worldPosOf(vehicle) {
  if (!vehicle) return null;
  if (vehicle.mesh && vehicle.mesh.position) {
    return { x: vehicle.mesh.position.x, z: vehicle.mesh.position.z };
  }
  return { x: vehicle.x || 0, z: vehicle.z || 0 };
}

export function nearestVehicle(world, x, z, maxDist = 4) {
  let best = null;
  let bestD = maxDist;
  for (const v of world.vehicles || []) {
    const d = Math.hypot(v.x - x, v.z - z);
    if (d < bestD) {
      bestD = d;
      best = v;
    }
  }
  return best;
}

export function districtAtPoint(world, x, z) {
  const districts = (world.config && world.config.DISTRICTS) || [];
  for (const d of districts) {
    if (x >= d.x0 && x <= d.x1 && z >= d.z0 && z <= d.z1) return d.name;
  }
  return 'Arunika Bay';
}
