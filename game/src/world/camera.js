// ARUNIKA BAY — kamera kejar third-person (tulis ulang round 2).
// Kamera mengikuti dari belakang target (pemain/mobil) dengan yaw + pitch
// yang bisa diatur; transisi dihaluskan dengan lerp supaya tidak patah.
import { WORLD } from './config.js';

export function createCamera(THREE, aspect = 16 / 9) {
  const camera = new THREE.PerspectiveCamera(62, aspect, 0.1, 600);
  camera.position.set(8, 6, 18);
  camera.lookAt(0, 1, 0);
  return camera;
}

// Rig kejar: simpan yaw/pitch, hitung posisi kamera dari target tiap frame.
export function createChaseCamera(THREE, aspect = 16 / 9) {
  const camera = createCamera(THREE, aspect);
  const rig = {
    camera,
    yaw: Math.PI,
    pitch: 0.32,
    distance: 11,
    height: 4.2,
    target: { x: 0, y: 1.2, z: 0 },
    // Langsung lompat ke belakang target (dipakai staging shot).
    snap(x, z, yaw, pitch = 0.32, distance = 11) {
      rig.yaw = yaw;
      rig.pitch = pitch;
      rig.distance = distance;
      rig.target.x = x;
      rig.target.y = 1.2;
      rig.target.z = z;
      rig.apply();
    },
    // Hitung posisi kamera dari yaw/pitch/jarak saat ini.
    apply() {
      const cp = Math.cos(rig.pitch);
      const sp = Math.sin(rig.pitch);
      const ox = -Math.sin(rig.yaw) * cp * rig.distance;
      const oz = -Math.cos(rig.yaw) * cp * rig.distance;
      camera.position.set(
        rig.target.x + ox,
        rig.target.y + sp * rig.distance + rig.height * 0.4,
        rig.target.z + oz,
      );
      camera.lookAt(rig.target.x, rig.target.y, rig.target.z);
    },
  };
  return rig;
}

// Ikuti target dengan smoothing: posisi target di-lerp, lalu apply().
// yawTarget: arah hadap target (radian, 0 = menghadap -z). dt detik.
export function followTarget(rig, x, z, yawTarget, dt, height = 1.2) {
  const k = 1 - Math.exp(-dt * 7);
  rig.target.x += (x - rig.target.x) * k;
  rig.target.y += (height - rig.target.y) * k;
  rig.target.z += (z - rig.target.z) * k;
  let dy = yawTarget - rig.yaw;
  while (dy > Math.PI) dy -= Math.PI * 2;
  while (dy < -Math.PI) dy += Math.PI * 2;
  rig.yaw += dy * (1 - Math.exp(-dt * 5));
  rig.apply();
}

// Kamera sinematik diam untuk layar vista: tarik agak jauh + naik.
export function vistaPose(rig, x, z, yaw, pitch = 0.25) {
  rig.yaw = yaw;
  rig.pitch = pitch;
  rig.distance = 16;
  rig.target.x = x;
  rig.target.y = 2.2;
  rig.target.z = z;
  rig.apply();
}

// Jaga kamera tetap di dalam batas kota (jangan sampai di bawah tanah).
export function clampCamera(rig) {
  const c = rig.camera.position;
  if (c.y < 0.6) c.y = 0.6;
  const h = WORLD.half + 60;
  c.x = Math.max(-h, Math.min(h, c.x));
  c.z = Math.max(-h, Math.min(h, c.z));
}
