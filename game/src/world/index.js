// index.js — Pintu masuk modul dunia ARUNIKA BAY.
// `createWorld(THREE, scene)` membangun seluruh kota dan mengembalikan
// objek dunia yang dipakai Gameplay (lihat world-api.md di folder job).
// Kontrak yang dijamin:
// - bounds +-110 m; colliders gedung (AABB); cars (parkir + traffic);
// - landmarks; playerSpawn; hospital + policeStation;
// - resolveCircle(pos, radius); isWalkable(x, z);
// - setDrivenCar(car); update(dt, state) — traffic, pejalan kaki,
//   lampu lalu lintas, kamera, dan animasi dunia.

import {
  WORLD_HALF,
  ROAD_SPACING,
  DISTRICTS,
  LANDMARKS,
  MISSION_POINTS,
  PLAYER_SPAWN,
  HOSPITAL_POS,
  POLICE_POS,
  POLICE_SPAWN,
  clampToWorld,
  districtAt,
} from './config.js';
import { buildCity } from './city.js';
import { buildSky, buildLighting, buildStreetLights, buildLighthouseLight } from './lighting.js';
import { buildParkedCars, spinWheels } from './vehicles.js';
import { spawnTraffic, updateTraffic, buildTrafficLights, updateTrafficLights } from './traffic.js';
import { spawnPedestrians, updatePedestrians } from './pedestrians.js';
import { resolveCircle as resolveCircleFn, isWalkable as isWalkableFn } from './collision.js';
import { updateCamera, snapCamera } from './camera.js';
import { getMinimapData } from './minimap.js';

export function createWorld(THREE, scene, options = {}) {
  const seed = options.seed ?? 20261118;

  // 1) Langit + pencahayaan fajar.
  const sky = buildSky(THREE, scene);
  const lighting = buildLighting(THREE, scene);

  // 2) Kota prosedural (gedung, jalan, plaza, kanal, mercusuar, ...).
  const city = buildCity(THREE, scene, seed);
  const street = buildStreetLights(THREE, scene, city.lamps);
  const lighthouse = buildLighthouseLight(THREE, scene);

  // 3) Kendaraan: 10 parkir + belasan traffic AI.
  const parkedCars = buildParkedCars(THREE, scene);
  const traffic = spawnTraffic(THREE, scene);
  const trafficLightRigs = buildTrafficLights(THREE, scene);

  // 4) Pejalan kaki.
  const pedestrians = spawnPedestrians(THREE, scene);

  // Sinar mercusuar: cari cone beam di grup kota, putar pelan tiap frame.
  let lighthouseBeam = null;
  city.group.traverse((obj) => {
    if (obj.geometry && obj.geometry.type === 'ConeGeometry') lighthouseBeam = obj;
  });

  // Semua mobil hidup dalam satu daftar (kontrak Gameplay).
  const cars = [...parkedCars, ...traffic.cars];
  let drivenCar = null;
  let time = 0;

  const world = {
    THREE,
    scene,
    seed,
    // Batas dunia.
    bounds: { half: WORLD_HALF, minX: -WORLD_HALF, maxX: WORLD_HALF, minZ: -WORLD_HALF, maxZ: WORLD_HALF },
    roadSpacing: ROAD_SPACING,
    districts: DISTRICTS,
    landmarks: LANDMARKS,
    missionPoints: MISSION_POINTS,
    // Spawn + titik penting.
    playerSpawn: { ...PLAYER_SPAWN },
    hospital: { ...HOSPITAL_POS },
    policeStation: { ...POLICE_POS },
    policeSpawn: { ...POLICE_SPAWN },
    // Geometri + collider.
    buildings: city.buildings,
    colliders: city.colliders,
    lamps: city.lamps,
    trees: city.trees,
    boats: city.boats,
    // Sistem hidup.
    cars,
    parkedCars,
    trafficCars: traffic.cars,
    traffic,
    pedestrians,
    trafficLightRigs,
    lighting,
    sky,
    lightInventory: [...street.lightInventory, lighthouse.inventory],
    time: 0,
    drivenCar: null,

    // --- Kontrak tabrakan ---
    // Selesaikan tabrakan lingkaran terhadap gedung + batas dunia.
    resolveCircle(pos, radius) {
      return resolveCircleFn(pos, radius, this.colliders, WORLD_HALF);
    },
    // Apakah titik bisa dilalui pejalan kaki / pemain.
    isWalkable(x, z) {
      return isWalkableFn(x, z, this.colliders, WORLD_HALF);
    },
    clampToWorld(x, z) {
      return clampToWorld(x, z);
    },
    districtAt(x, z) {
      return districtAt(x, z);
    },

    // --- Kontrak kendaraan ---
    // Tandai mobil sedang dikemudikan pemain (traffic berhenti
    // menggerakkannya; kamera beralih ke mode drive). Panggil dengan
    // null saat pemain keluar mobil.
    setDrivenCar(car) {
      if (drivenCar) drivenCar.driven = false;
      drivenCar = car || null;
      if (drivenCar) drivenCar.driven = true;
      this.drivenCar = drivenCar;
      return drivenCar;
    },
    getDrivenCar() {
      return drivenCar;
    },

    // --- Kontrak minimap ---
    getMinimapData(player = null, missionTarget = null) {
      return getMinimapData(this, player, missionTarget);
    },

    // --- Kontrak kamera ---
    updateCamera(camera, opts) {
      return updateCamera(camera, { ...opts, colliders: this.colliders });
    },
    snapCamera(camera, opts) {
      return snapCamera(camera, { ...opts, colliders: this.colliders });
    },

    // --- Update per frame ---
    // `state`: { player {x,z,heading}, camera, cameraMode, drivingCar }
    // - player: dipakai pejalan kaki untuk menghindar.
    // - camera + cameraMode ('foot' | 'drive' | 'vista'): kamera digerakkan
    //   di sini bila camera diberikan; bila tidak, Gameplay yang memanggil
    //   world.updateCamera sendiri.
    // - drivingCar: mobil yang dikemudikan (untuk kamera drive).
    update(dt, state = {}) {
      const step = Math.max(0, Math.min(0.05, dt || 0.016));
      time += step;
      this.time = time;
      updateTraffic(traffic, step, time);
      // Sinkron mesh mobil yang dikemudikan (Repair-2): updateTraffic
      // melewati mobil driven (`if (car.driven) continue`), dan main.js
      // hanya menyinkron mesh mobil dunia stub — jadi DUNIA yang harus
      // menggerakkan mesh mobil driven tiap frame dari car.x/z/heading.
      // Kunci pada flag car.driven (bukan variabel drivenCar internal):
      // staging cover main.js menandai car.driven = true langsung tanpa
      // setDrivenCar. Putaran memakai konvensi yang sama dengan traffic
      // (Repair): badan sumbu-X, rotation.y = heading - PI/2, supaya mesh
      // menghadap arah maju logika (sin h, cos h).
      for (const car of cars) {
        if (!car.driven || !car.mesh) continue;
        car.mesh.position.set(car.x, 0, car.z);
        car.mesh.rotation.y = car.heading - Math.PI / 2;
        spinWheels(car.mesh, (car.speed || 0) * step);
      }
      updateTrafficLights(trafficLightRigs, time);
      updatePedestrians(pedestrians, step, state.player || null, this.colliders);
      // Sinar mercusuar berputar pelan (beam mesh di grup kota).
      if (lighthouseBeam) lighthouseBeam.rotation.y = time * 0.25;
      if (state.camera) {
        const mode = state.cameraMode || (state.drivingCar ? 'drive' : 'foot');
        this.updateCamera(state.camera, {
          mode,
          target: state.player || this.playerSpawn,
          car: state.drivingCar || null,
          dt: step,
        });
      }
      return this;
    },
  };

  return world;
}

// Re-ekspor util yang sering dipakai Gameplay dari satu pintu.
export { WORLD_HALF, ROAD_SPACING, DISTRICTS, LANDMARKS, MISSION_POINTS, PLAYER_SPAWN };
export { resolveCircleFn as resolveCircle, isWalkableFn as isWalkable };
export { getMinimapData } from './minimap.js';
export { buildVehicleMesh, vehicleSpec } from './vehicles.js';
export { updateCamera, snapCamera } from './camera.js';
