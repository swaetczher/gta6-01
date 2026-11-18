// police.js — Polisi Arunika Bay.
//
// Polisi punya empat status yang berputar sesuai bintang buronan Bara:
//
//   patrol  — jalan santai di rute, tidak mengejar.
//   chase   — mengejar Bara (bintang >= 1) sampai jarak tangkap.
//   search  — Bara lolos dari pandangan: polisi menyisir area terakhir.
//   arrest  — Bara tertangkap: layar 'busted'.
//
// Polisi digerakkan sebagai data (x, z, heading, speed, state) dan mesh
// THREE sederhana (kotak biru berseragam). Semua angka gerak tinggal di
// sini, supaya tes Node bisa menjalankan logika kejar-kejaran tanpa renderer.

export const POLICE_STATES = ['patrol', 'chase', 'search', 'arrest'];

// Kecepatan (meter/detik) per status.
export const POLICE_SPEED_PATROL = 2.2;
export const POLICE_SPEED_CHASE = 7.5;
export const POLICE_SPEED_SEARCH = 3.5;

// Jarak pandang polisi (meter) dan jarak tangkap.
export const POLICE_SIGHT_RANGE = 26;
export const POLICE_CATCH_RANGE = 1.6;

// Berapa lama polisi menyisir sebelum kembali patroli (detik).
export const POLICE_SEARCH_TIME = 8;

// Jarak maksimum polisi mengejar sebelum menyerah dan kembali patroli.
export const POLICE_CHASE_RANGE = 60;

// Jumlah polisi yang dijaga di kota saat buronan berat (bintang >= 3).
export const POLICE_MAX_ACTIVE = 6;

/** Apakah `state` salah satu status polisi yang sah. */
export function isPoliceState(state) {
  return POLICE_STATES.includes(state);
}

/** Kecepatan polisi untuk status tertentu. */
export function speedForState(state) {
  if (state === 'chase') return POLICE_SPEED_CHASE;
  if (state === 'search') return POLICE_SPEED_SEARCH;
  return POLICE_SPEED_PATROL;
}

/**
 * Bangun mesh polisi: badan kotak biru + kepala. Mesh dibuat dari primitif
 * THREE saja (tanpa aset luar) supaya tetap jalan di tes Node dengan stub.
 */
export function buildOfficerMesh(THREE) {
  const group = new THREE.Group();
  const navy = new THREE.MeshLambertMaterial({ color: 0x1d4ed8 });
  const skin = new THREE.MeshLambertMaterial({ color: 0xd9a066 });
  const dark = new THREE.MeshLambertMaterial({ color: 0x111827 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.95, 0.36), navy);
  body.position.y = 0.95;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.42), skin);
  head.position.y = 1.66;
  const cap = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.14, 0.48), dark);
  cap.position.y = 1.92;
  const legs = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.32), dark);
  legs.position.y = 0.25;
  group.add(body);
  group.add(head);
  group.add(cap);
  group.add(legs);
  return group;
}

/** Jarak datar (XZ) antara dua titik. */
function flatDistance(ax, az, bx, bz) {
  const dx = ax - bx;
  const dz = az - bz;
  return Math.sqrt(dx * dx + dz * dz);
}

/**
 * Manajer polisi. `THREE` dan `scene` boleh null di tes logika (mesh
 * dilewati) — tapi di game nyata keduanya wajib ada.
 *
 * @param {object} THREE pustaka three.js (atau stub di tes)
 * @param {object|null} scene scene three.js (atau null di tes)
 * @param {(event:object)=>void} [onEvent] dipanggil saat Bara tertangkap
 */
export function createPolice(THREE, scene, onEvent) {
  const officers = [];
  const emit = typeof onEvent === 'function' ? onEvent : null;

  function syncMesh(officer) {
    if (!officer.mesh) return;
    officer.mesh.position.set(officer.x, 0, officer.z);
    officer.mesh.rotation.y = officer.heading;
  }

  const api = {
    officers,

    /** Tambah satu polisi di (x, z) dengan status awal. */
    spawnOfficer(x, z, state = 'patrol') {
      const officer = {
        x: Number(x) || 0,
        z: Number(z) || 0,
        heading: Math.random() * Math.PI * 2,
        speed: 0,
        state: isPoliceState(state) ? state : 'patrol',
        searchTimer: 0,
        patrolTarget: null,
        mesh: null,
      };
      if (THREE && scene) {
        officer.mesh = buildOfficerMesh(THREE);
        scene.add(officer.mesh);
      }
      syncMesh(officer);
      officers.push(officer);
      return officer;
    },

    /** Setel SEMUA polisi ke satu status (dipakai staging shot). */
    setAllState(state) {
      if (!isPoliceState(state)) return 0;
      let changed = 0;
      for (const officer of officers) {
        if (officer.state !== state) {
          officer.state = state;
          officer.searchTimer = state === 'search' ? POLICE_SEARCH_TIME : 0;
          changed++;
        }
      }
      return changed;
    },

    /** Jumlah polisi dalam status tertentu. */
    countByState(state) {
      let n = 0;
      for (const officer of officers) if (officer.state === state) n++;
      return n;
    },

    /** Polisi terdekat dari (x, z), atau null bila belum ada polisi. */
    nearestTo(x, z) {
      let best = null;
      let bestDist = Infinity;
      for (const officer of officers) {
        const d = flatDistance(officer.x, officer.z, x, z);
        if (d < bestDist) {
          bestDist = d;
          best = officer;
        }
      }
      return best ? { officer: best, distance: bestDist } : null;
    },

    /** Hapus semua polisi dari kota (dan dari scene bila ada). */
    clear() {
      for (const officer of officers) {
        if (officer.mesh && scene && scene.remove) scene.remove(officer.mesh);
      }
      officers.length = 0;
    },

    /**
     * Majukan semua polisi satu frame.
     * @param {number} dt detik sejak frame lalu
     * @param {{x:number,z:number}} playerPos posisi Bara
     * @param {number} wantedStars bintang buronan saat ini (0–5)
     * @returns {'arrest'|null} 'arrest' bila Bara tertangkap frame ini
     */
    update(dt, playerPos, wantedStars) {
      const step = Math.max(0, dt || 0);
      const px = playerPos ? playerPos.x || 0 : 0;
      const pz = playerPos ? playerPos.z || 0 : 0;
      const stars = Math.max(0, Math.floor(wantedStars) || 0);

      for (const officer of officers) {
        const dist = flatDistance(officer.x, officer.z, px, pz);

        // Transisi status dari situasi, bukan dari luar.
        if (officer.state !== 'arrest') {
          if (stars >= 1 && dist < POLICE_SIGHT_RANGE) {
            officer.state = 'chase';
          } else if (officer.state === 'chase' && dist > POLICE_CHASE_RANGE) {
            officer.state = 'search';
            officer.searchTimer = POLICE_SEARCH_TIME;
          } else if (officer.state === 'chase' && stars === 0) {
            officer.state = 'search';
            officer.searchTimer = POLICE_SEARCH_TIME;
          } else if (officer.state === 'search') {
            officer.searchTimer -= step;
            if (officer.searchTimer <= 0) officer.state = 'patrol';
          }
        }

        // Gerak sesuai status.
        officer.speed = speedForState(officer.state);
        let targetX = officer.x;
        let targetZ = officer.z;
        if (officer.state === 'chase' || officer.state === 'search') {
          targetX = px;
          targetZ = pz;
        } else if (officer.state === 'patrol') {
          if (!officer.patrolTarget) {
            officer.patrolTarget = {
              x: officer.x + (Math.random() - 0.5) * 30,
              z: officer.z + (Math.random() - 0.5) * 30,
            };
          }
          targetX = officer.patrolTarget.x;
          targetZ = officer.patrolTarget.z;
          if (flatDistance(officer.x, officer.z, targetX, targetZ) < 1) {
            officer.patrolTarget = null;
          }
        }
        if (officer.state !== 'arrest') {
          const dx = targetX - officer.x;
          const dz = targetZ - officer.z;
          const len = Math.sqrt(dx * dx + dz * dz);
          if (len > 0.001) {
            officer.heading = Math.atan2(dx, dz);
            const move = Math.min(len, officer.speed * step);
            officer.x += (dx / len) * move;
            officer.z += (dz / len) * move;
          }
        }

        // Tertangkap: polisi chase menyentuh Bara.
        if (officer.state === 'chase' && dist < POLICE_CATCH_RANGE) {
          officer.state = 'arrest';
          if (emit) emit({ type: 'arrested', x: px, z: pz });
          syncMesh(officer);
          return 'arrest';
        }
        syncMesh(officer);
      }
      return null;
    },
  };
  return api;
}
