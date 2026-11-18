// police.js — Polisi Arunika Bay: patroli, kejar, cari, tangkap.
// Satu petugas adalah satu baris data (posisi, arah, status, timer) plus
// satu boneka kotak sederhana di scene bila THREE tersedia. Tanpa THREE
// (misalnya saat tes Node) logika geraknya tetap jalan penuh.

export const POLICE_STATES = ['patrol', 'chase', 'search', 'arrest'];
export const ARREST_DISTANCE = 1.6;
export const CHASE_SPEED = 7.5;
export const PATROL_SPEED = 2.2;
export const SEARCH_SPEED = 1.4;

// Kecepatan tiap status, meter per detik.
const SPEED_BY_STATE = {
  patrol: PATROL_SPEED,
  chase: CHASE_SPEED,
  search: SEARCH_SPEED,
  arrest: 0,
};

function isState(value) {
  return POLICE_STATES.includes(value);
}

// Buat satu petugas polisi di titik (x, z) dengan status awal.
export function createPolice(opts = {}) {
  const THREE = opts.THREE || null;
  const scene = opts.scene || null;
  const getPlayer = typeof opts.getPlayer === 'function' ? opts.getPlayer : () => null;
  const onArrest = typeof opts.onArrest === 'function' ? opts.onArrest : null;
  const onStateChange = typeof opts.onStateChange === 'function' ? opts.onStateChange : null;
  const officers = [];
  let nextId = 1;

  // Boneka polisi: badan biru + kepala. Sengaja sederhana supaya murah.
  function buildMesh() {
    if (!THREE || !scene) return null;
    const group = new THREE.Group();
    const bodyMat = new THREE.MeshLambertMaterial({ color: 0x1d4ed8 });
    const skinMat = new THREE.MeshLambertMaterial({ color: 0xe8b88a });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.62, 1.05, 0.36), bodyMat);
    body.position.y = 0.95;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8), skinMat);
    head.position.y = 1.72;
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 0.5), bodyMat);
    cap.position.y = 1.95;
    group.add(body);
    group.add(head);
    group.add(cap);
    scene.add(group);
    return group;
  }

  function placeMesh(officer) {
    if (!officer.mesh) return;
    officer.mesh.position.set(officer.x, 0, officer.z);
    officer.mesh.rotation.y = officer.heading;
  }

  const api = {
    officers,
    get count() { return officers.length; },

    spawnOfficer(x, z, state = 'patrol') {
      const safe = isState(state) ? state : 'patrol';
      const officer = {
        id: nextId++,
        x: Number(x) || 0,
        z: Number(z) || 0,
        heading: Math.random() * Math.PI * 2,
        state: safe,
        speed: SPEED_BY_STATE[safe],
        searchTimer: 0,
        wanderTimer: 0,
        mesh: null,
      };
      officer.mesh = buildMesh();
      placeMesh(officer);
      officers.push(officer);
      return officer;
    },

    setAllState(state) {
      const safe = isState(state) ? state : 'patrol';
      for (const officer of officers) {
        if (officer.state !== safe) {
          officer.state = safe;
          officer.speed = SPEED_BY_STATE[safe];
          officer.searchTimer = 0;
          if (onStateChange) onStateChange(officer, safe);
        }
      }
      return officers.length;
    },

    // Jarak petugas terdekat ke pemain (meter). Tanpa pemain: tak hingga.
    nearestDistance() {
      const p = getPlayer();
      if (!p || officers.length === 0) return Infinity;
      let best = Infinity;
      for (const o of officers) best = Math.min(best, Math.hypot(p.x - o.x, p.z - o.z));
      return best;
    },

    // Hitung petugas per status — dipakai HUD dan logika wanted.
    countByState() {
      const counts = { patrol: 0, chase: 0, search: 0, arrest: 0 };
      for (const o of officers) counts[o.state] = (counts[o.state] || 0) + 1;
      return counts;
    },

    removeAll() {
      for (const o of officers) {
        if (o.mesh && scene) scene.remove(o.mesh);
      }
      officers.length = 0;
      return 0;
    },

    // Maju satu frame: gerakkan tiap petugas sesuai statusnya.
    update(dt) {
      const p = getPlayer();
      const step = Math.max(0, dt);
      for (const o of officers) {
        if (o.state === 'arrest') {
          placeMesh(o);
          continue;
        }
        if (o.state === 'chase' && p) {
          const dx = p.x - o.x;
          const dz = p.z - o.z;
          const dist = Math.hypot(dx, dz) || 1;
          o.heading = Math.atan2(dx, dz);
          const move = Math.min(dist, o.speed * step);
          o.x += (dx / dist) * move;
          o.z += (dz / dist) * move;
          const after = Math.hypot(p.x - o.x, p.z - o.z);
          if (after <= ARREST_DISTANCE) {
            o.state = 'arrest';
            o.speed = 0;
            if (onArrest) onArrest(o);
          }
        } else if (o.state === 'search') {
          o.searchTimer += step;
          o.heading += step * 1.4;
          if (o.searchTimer > 8) {
            o.state = 'patrol';
            o.speed = SPEED_BY_STATE.patrol;
            o.searchTimer = 0;
          }
        } else {
          // Patroli: jalan lurus, belok acak tiap beberapa detik.
          o.wanderTimer += step;
          if (o.wanderTimer > 4) {
            o.wanderTimer = 0;
            o.heading += (Math.random() - 0.5) * 2.2;
          }
          o.x += Math.sin(o.heading) * o.speed * step;
          o.z += Math.cos(o.heading) * o.speed * step;
        }
        placeMesh(o);
      }
      return officers.length;
    },
  };

  return api;
}
