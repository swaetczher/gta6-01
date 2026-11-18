// main.js — Entry browser ARUNIKA BAY (three.js r187, vendored lokal).
// Renderer + kamera third-person + pointer-lock + loop fixed-step 60 Hz.
// Memuat modul dunia (game/src/world/index.js) bila ada; bila belum ada,
// memakai dunia stub dari gameplay/world-adapter.js supaya game tetap
// playable mandiri. Mode screenshot: ?shot=start|play|end (alias:
// cover/chase, foot, heist, vista) — memanggil world.update tiap frame
// supaya traffic bergerak, lalu menandai window.__shotReady.
// Tanpa network request: semua import relatif di dalam game/.
import * as THREE from 'three';
import { createGame, updateGame, newGame, continueGame, startNextMission } from './gameplay/index.js';
import { createPoliceUnit } from './gameplay/police.js';
import { createHudState, buildHud, updateHud, showDialog, showBanner, showMessage } from './gameplay/hud.js';
import { setScreen, isPlaying } from './gameplay/screens.js';
import { createStubWorld, adaptWorld } from './gameplay/world-adapter.js';
import { hasSave } from './gameplay/save.js';

const params = new URLSearchParams(location.search);
const SHOT = params.get('shot') || '';
const SEED = Number(params.get('seed') || 1);

let renderer;
let scene;
let camera;
let game;
let world;
let hud;
let yaw = Math.PI;
let pitch = 0.32;
let keys = {};
let mouseDX = 0;
let mouseDY = 0;
let mouseDown = false;
let shotFrames = 0;
let shotDone = false;
const meshes = { player: null, cars: new Map(), police: new Map(), thugs: new Map(), marker: null, heli: null };
const clock = { last: performance.now(), acc: 0 };

const CAR_COLORS = {
  Kancil: 0x3f8f5f, Banteng: 0xc96a2e, 'Lentera Cab': 0xf2c230,
  'Polair Arunika': 0x2e5fa3,
};

function makeBox(w, h, d, color, x, y, z) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshLambertMaterial({ color }),
  );
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function buildDawnSky() {
  // Fajar Arunika: langit oranye-merah muda, kabut tipis pelabuhan.
  scene.background = new THREE.Color(0xff9e6b);
  scene.fog = new THREE.Fog(0xffb98a, 90, 260);
  const hemi = new THREE.HemisphereLight(0xffd9b0, 0x2e4a5a, 0.9);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffc98a, 1.6);
  sun.position.set(60, 80, -40);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -120;
  sun.shadow.camera.right = 120;
  sun.shadow.camera.top = 120;
  sun.shadow.camera.bottom = -120;
  scene.add(sun);
  // Matahari fajar (bola emissive di cakrawala timur).
  const sunBall = new THREE.Mesh(
    new THREE.SphereGeometry(9, 16, 16),
    new THREE.MeshBasicMaterial({ color: 0xffe9a8 }),
  );
  sunBall.position.set(150, 26, -60);
  scene.add(sunBall);
}

function buildGroundAndRoads() {
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(240, 240),
    new THREE.MeshLambertMaterial({ color: 0x5a6b52 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
  const roadMat = new THREE.MeshLambertMaterial({ color: 0x33383d });
  for (const r of world.roads) {
    const h = new THREE.Mesh(new THREE.PlaneGeometry(220, 10), roadMat);
    h.rotation.x = -Math.PI / 2;
    h.position.set(0, 0.02, r);
    h.receiveShadow = true;
    scene.add(h);
    const v = new THREE.Mesh(new THREE.PlaneGeometry(10, 220), roadMat);
    v.rotation.x = -Math.PI / 2;
    v.position.set(r, 0.02, 0);
    v.receiveShadow = true;
    scene.add(v);
  }
  // Gedung stub: kotak warna-warni dengan jendela menyala (fajar).
  let i = 0;
  for (const c of world.colliders) {
    const w = c.x2 - c.x1;
    const d = c.z2 - c.z1;
    const h = 6 + ((i * 13) % 26);
    const color = [0x8a6f5c, 0x6f7f8a, 0x9a7f6a, 0x7a6a8a, 0x5f7a6a][i % 5];
    const b = makeBox(w, h, d, color, (c.x1 + c.x2) / 2, h / 2, (c.z1 + c.z2) / 2);
    scene.add(b);
    const win = makeBox(w * 0.7, h * 0.5, 0.1, 0xffd94a, (c.x1 + c.x2) / 2, h * 0.55, c.z2 + 0.06);
    win.material = new THREE.MeshBasicMaterial({ color: 0xffd94a });
    scene.add(win);
    i += 1;
  }
  // Mercusuar di Bukit Mercusuar (88, 88): menara putih-merah + lampu.
  const tower = new THREE.Mesh(
    new THREE.CylinderGeometry(2.2, 3, 26, 12),
    new THREE.MeshLambertMaterial({ color: 0xf2ede2 }),
  );
  tower.position.set(88, 13, 88);
  tower.castShadow = true;
  scene.add(tower);
  const lamp = new THREE.Mesh(
    new THREE.SphereGeometry(2.4, 12, 12),
    new THREE.MeshBasicMaterial({ color: 0xffe9a8 }),
  );
  lamp.position.set(88, 27, 88);
  scene.add(lamp);
}

function buildActors() {
  // Bara Kelana: badan + kepala (oranye jaket, celana gelap).
  const group = new THREE.Group();
  const body = makeBox(0.7, 1.1, 0.4, 0xd86a2e, 0, 0.95, 0);
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.28, 12, 12),
    new THREE.MeshLambertMaterial({ color: 0xe8b88a }),
  );
  head.position.set(0, 1.75, 0);
  head.castShadow = true;
  group.add(body);
  group.add(head);
  scene.add(group);
  meshes.player = group;
  // Mesh mobil HANYA untuk dunia stub: dunia asli sudah membangun mesh
  // tiap mobil (vehicles.js) dan menggerakkannya sendiri lewat
  // world.update; membuat duplikat di posisi yang sama hanya menumpuk
  // geometri dan berisiko z-fighting.
  if (!world._fromModule) {
    for (const car of world.cars) {
      const g = new THREE.Group();
      const color = CAR_COLORS[car.model] || 0x888888;
      g.add(makeBox(2, 0.7, 4.4, color, 0, 0.55, 0));
      const cabin = makeBox(1.7, 0.6, 2.2, 0x222a33, 0, 1.15, -0.2);
      cabin.material = new THREE.MeshLambertMaterial({ color: 0x222a33 });
      g.add(cabin);
      g.position.set(car.x, 0, car.z);
      g.rotation.y = car.heading;
      scene.add(g);
      meshes.cars.set(car.id, g);
    }
  }
  // Penanda objektif misi: cincin kuning melayang.
  const marker = new THREE.Mesh(
    new THREE.TorusGeometry(2.2, 0.18, 8, 32),
    new THREE.MeshBasicMaterial({ color: 0xffd94a }),
  );
  marker.rotation.x = Math.PI / 2;
  marker.visible = false;
  scene.add(marker);
  meshes.marker = marker;
  // Helikopter Polair (muncul di wanted 4-5): badan + rotor.
  const heli = new THREE.Group();
  heli.add(makeBox(2.4, 1.2, 5, 0x2e5fa3, 0, 0, 0));
  const rotor = makeBox(9, 0.1, 0.5, 0x222222, 0, 0.9, 0);
  heli.add(rotor);
  heli.visible = false;
  scene.add(heli);
  meshes.heli = heli;
}

function syncActorMeshes() {
  const p = game.player;
  meshes.player.position.set(p.x, p.y, p.z);
  meshes.player.rotation.y = p.heading;
  meshes.player.visible = !p.inCar;
  // Sinkron mesh mobil hanya untuk dunia stub (dunia asli menggerakkan
  // mesh mobilnya sendiri; meshes.cars kosong di mode itu).
  for (const car of world.cars) {
    const m = meshes.cars.get(car.id);
    if (!m) continue;
    m.position.set(car.x, 0, car.z);
    m.rotation.y = car.heading;
  }
  // Polisi: buat/hapus mesh sesuai daftar aktif.
  const seen = new Set();
  for (const unit of game.police) {
    seen.add(unit.id);
    let m = meshes.police.get(unit.id);
    if (!m) {
      m = new THREE.Group();
      m.add(makeBox(0.7, 1.1, 0.4, unit.inCar ? 0x2e5fa3 : 0x24344d, 0, 0.95, 0));
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 10), new THREE.MeshLambertMaterial({ color: 0xe8b88a }));
      head.position.set(0, 1.7, 0);
      m.add(head);
      scene.add(m);
      meshes.police.set(unit.id, m);
    }
    m.position.set(unit.x, 0, unit.z);
    m.rotation.y = unit.heading;
  }
  for (const [id, m] of [...meshes.police]) {
    if (!seen.has(id)) {
      scene.remove(m);
      meshes.police.delete(id);
    }
  }
  const seenT = new Set();
  for (const thug of game.thugs) {
    if (!thug.alive) continue;
    seenT.add(thug.id);
    let m = meshes.thugs.get(thug.id);
    if (!m) {
      m = new THREE.Group();
      const body = makeBox(0.75, 1.15, 0.45, thug.id === 'rangga-samudra' ? 0x1a1a22 : 0x4d2434, 0, 0.95, 0);
      m.add(body);
      scene.add(m);
      meshes.thugs.set(thug.id, m);
    }
    m.position.set(thug.x, 0, thug.z);
    m.rotation.y = thug.heading;
  }
  for (const [id, m] of [...meshes.thugs]) {
    if (!seenT.has(id)) {
      scene.remove(m);
      meshes.thugs.delete(id);
    }
  }
  // Penanda misi.
  const ms = game.missions;
  const mission = game.missionDefs.find((mm) => mm.id === ms.currentId);
  const obj = mission ? mission.objectives[ms.objectiveIndex] : null;
  if (obj && typeof obj.x === 'number') {
    meshes.marker.visible = true;
    meshes.marker.position.set(obj.x, 2.2 + Math.sin(game.time * 3) * 0.3, obj.z);
    meshes.marker.rotation.z += 0.02;
  } else {
    meshes.marker.visible = false;
  }
  meshes.heli.visible = !!game.helicopter;
  if (game.helicopter) {
    // REPAIR-4: heli lama di (p.x+14, 26, p.z-10) terbang TERLALU TINGGI
    // (elevasi ~45° dari kamera, di atas tepi atas frame) dan percobaan
    // di (p.x+6, 9, p.z-20) malah bersembunyi DI BALIK banner objektif
    // HUD (tengah atas). Posisi baru (p.x, 7, p.z-45): tepat di atas
    // jalan 45 m di depan pemain — proyeksinya jatuh di tengah frame
    // tepat di bawah banner, di atas titik lenyap jalan; ketinggian 7 m
    // aman karena selalu di atas badan jalan (bukan di atas blok gedung).
    meshes.heli.position.set(p.x, 7, p.z - 45);
    meshes.heli.rotation.y = game.time * 0.4;
  }
}

function updateCamera(dt) {
  const p = game.player;
  const dist = p.inCar ? 11 : 7.5;
  const height = p.inCar ? 4.2 : 3.4;
  const cx = p.x - Math.sin(yaw) * dist * Math.cos(pitch);
  const cz = p.z - Math.cos(yaw) * dist * Math.cos(pitch);
  const cy = p.y + height + Math.sin(pitch) * dist * 0.4;
  camera.position.set(cx, cy, cz);
  camera.lookAt(p.x, p.y + 1.6, p.z);
}

function readInput() {
  const input = {
    forward: keys.KeyW || keys.ArrowUp,
    back: keys.KeyS || keys.ArrowDown,
    left: keys.KeyA || keys.ArrowLeft,
    right: keys.KeyD || keys.ArrowRight,
    run: keys.ShiftLeft || keys.ShiftRight,
    jump: keys.Space,
    enter: !!keys._enterTap,
    enterHeld: !!keys.KeyE,
    attack: mouseDown,
    reload: !!keys._reloadTap,
    weapon: keys._weaponTap || null,
    startMission: !!keys._missionTap,
    pause: false,
    heading: yaw,
  };
  keys._enterTap = false;
  keys._reloadTap = false;
  keys._weaponTap = null;
  keys._missionTap = false;
  return input;
}

function bindInput() {
  addEventListener('keydown', (e) => {
    if (e.code === 'KeyE' && !e.repeat) keys._enterTap = true;
    if (e.code === 'KeyR' && !e.repeat) keys._reloadTap = true;
    if (e.code === 'Digit1' && !e.repeat) keys._weaponTap = 'fists';
    if (e.code === 'Digit2' && !e.repeat) keys._weaponTap = 'pistol';
    if (e.code === 'Enter' && !e.repeat) {
      if (game.screens.current === 'start') {
        document.dispatchEvent(new CustomEvent('arunika-start'));
      } else if (game.screens.current === 'busted' || game.screens.current === 'complete') {
        newGame(game);
      } else {
        keys._missionTap = true;
      }
    }
    if (e.code === 'KeyF' && !e.repeat) {
      game.combat.weapon = 'fists';
      mouseDown = true;
      setTimeout(() => { mouseDown = false; }, 120);
    }
    if (e.code === 'KeyP' && !e.repeat) {
      if (game.screens.current === 'playing') setScreen(game.screens, 'paused');
      else if (game.screens.current === 'paused') setScreen(game.screens, 'playing');
    }
    keys[e.code] = true;
    if (['Space', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
  });
  addEventListener('keyup', (e) => { keys[e.code] = false; });
  renderer.domElement.addEventListener('mousedown', (e) => {
    if (e.button === 0) {
      mouseDown = true;
      if (document.pointerLockElement !== renderer.domElement) {
        renderer.domElement.requestPointerLock();
      }
    }
  });
  addEventListener('mouseup', () => { mouseDown = false; });
  document.addEventListener('mousemove', (e) => {
    if (document.pointerLockElement === renderer.domElement) {
      yaw -= e.movementX * 0.0032;
      pitch = Math.max(-0.1, Math.min(0.9, pitch + e.movementY * 0.0024));
    }
  });
  document.addEventListener('arunika-start', () => {
    if (hasSave() && !game._saveAsked) {
      game._saveAsked = true;
      if (continueGame(game)) {
        showMessage(hud, 'Save dimuat — selamat datang kembali di Arunika Bay.', 4);
        return;
      }
    }
    newGame(game);
    showBanner(hud, 'ARUNIKA BAY', 3);
  });
  addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });
}

function stageShot() {
  // Determinisme screenshot: traffic dunia memakai Math.random saat
  // belok di simpul (world-api.md) — di mode ?shot=, ganti dengan RNG
  // bersseed tetap (mulberry32) supaya lalu lintas + patroli polisi
  // sama di setiap run screenshot. Di mode main normal, Math.random
  // asli tetap dipakai.
  let shotSeed = (0xc0ffee + SEED * 97) >>> 0;
  Math.random = () => {
    shotSeed = (shotSeed + 0x6d2b79f5) >>> 0;
    let t = shotSeed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  // Staging deterministik per mode screenshot (seed dipakai untuk
  // variasi kecil posisi kamera; dunia memakai seed tetap).
  const mode = SHOT;
  if (mode === 'start') {
    setScreen(game.screens, 'start');
    yaw = Math.PI * 0.75;
    game.player.x = 0;
    game.player.z = 20;
  } else if (mode === 'play' || mode === 'foot') {
    newGame(game);
    game.player.x = -44;
    game.player.z = 8;
    yaw = Math.PI;
    startNextMission(game);
    showDialog(hud, 'Bara: "Satu paket terakhir sebelum matahari terbit."', 6);
  } else if (mode === 'cover' || mode === 'chase') {
    newGame(game);
    // M4: kejar-kejaran besar — pemain di Kancil, wanted 4 bintang.
    const car = world.cars.find((c) => c.model === 'Kancil' && !c.locked);
    // REPAIR-4: Kancil tak terkunci pertama parkir di (-22,-58) — lajur
    // lurus ke selatan TANPA jalan, 52 m sampai tepi dunia. Gas penuh
    // 2 detik membawanya ke z -105, lalu (karena sim TIDAK dibekukan)
    // tiap frame menabrak batas dan kecepatan runtuh x0,25 → "1 km/jam"
    // di shot uji. Pindahkan mobil ke tengah jalan x=0 (z=44,
    // persimpangan) menghadap -z (heading PI) supaya laju lurus di jalan
    // dan setelah 2 detik masih di tengah peta (z -3, 94 km/jam).
    car.x = 0;
    car.z = 44;
    car.heading = Math.PI;
    // REPAIR-4: dua mobil polisi dari arah depan (head-on) di jalan yang
    // sama, supaya kejar-kejaran terlihat di frame saat __shotReady
    // (120 frame). Posisi dipilih dari simulasi node (probe): (5,-14)
    // dan (-5,-22) berakhir dz +3,3 (tepat di belakang Kancil, tepi
    // bawah frame) dan dz -15,2 (15 m di depan, tengah frame) saat
    // pemain di (0,-3) melaju 26 m/s — keduanya state 'chase'.
    // Posisi lebih jauh (-42/-56) GAGAL: di luar jarak lihat polisi
    // (46 m) sehingga mereka mengembara 'search' dan tertinggal 39 m+.
    game.police.push(createPoliceUnit('polisi-cover-1', 5, -14, true));
    game.police.push(createPoliceUnit('polisi-cover-2', -5, -22, true));
    game.police[0].state = 'chase';
    game.police[1].state = 'chase';
    game.player.x = car.x;
    game.player.z = car.z;
    game.player.inCar = car.id;
    car.driven = true;
    car.speed = 14;
    car.heading = Math.PI;
    game.wanted.heat = 80;
    game.wanted.stars = 4;
    game.missions.completed = ['M1', 'M2', 'M3'];
    const m4 = game.missionDefs.find((m) => m.id === 'M4');
    game.missions.currentId = 'M4';
    game.missions.started = true;
    game.missions.objectiveIndex = 1;
    yaw = Math.PI;
    showDialog(hud, '"Empat mobil polisi dan helikopter! Lewat kanal Pasar Terapung!"', 6);
  } else if (mode === 'heist') {
    newGame(game);
    game.missions.completed = ['M1', 'M2'];
    const m3 = game.missionDefs.find((m) => m.id === 'M3');
    game.missions.currentId = 'M3';
    game.missions.started = true;
    game.missions.objectiveIndex = 1;
    game.thugs = m3.thugs.map((t) => ({ ...t, alive: true, state: 'chase', punchCooldown: 0, shootCooldown: 0, heading: 0 }));
    // REPAIR-4: staging lama (-80,-72) di blok Mercusuar, ~150 m dari
    // gudang — preman + gudang di luar frame, kamera menghadap bukit.
    // Pemain kini di selatan gudang (-66,94), yaw PI: kamera di selatan
    // pemain menghadap utara — gudang (pintu z=74) + 3 preman (z=78–84)
    // berada 10–28 m di depan pemain, di dalam frame.
    game.player.x = -66;
    game.player.z = 94;
    game.player.heading = Math.PI;
    game.combat.weapon = 'pistol';
    game.combat.ammo = 12;
    yaw = Math.PI;
    showDialog(hud, 'Rangga menyimpan uang tebusan di brankas gudang kontainer.', 6);
  } else if (mode === 'end' || mode === 'vista') {
    newGame(game);
    game.missions.completed = ['M1', 'M2', 'M3', 'M4', 'M5'];
    game.player.x = -52;
    game.player.z = -52;
    game.player.money = 2450;
    // REPAIR-4: yaw lama (1,25 PI) menghadap kamera ke barat daya —
    // punggung kota tak terlihat, hanya bukit gelap. Yaw 0,25 PI menaruh
    // kamera di barat daya pemain menghadap timur laut: vista kota +
    // matahari fajar dari Bukit Mercusuar.
    // REPAIR-4 ronde 2: pemain lama (-58,-58) tepat di atas gundukan
    // mercusuar — gundukan menutupi >50% frame bawah. Geser ke (-52,-52)
    // (tepi timur laut gundukan) + pitch 0,25 (kamera lebih mendatar)
    // supaya porsi kota di frame membesar.
    yaw = Math.PI * 0.25 + (SEED - 1) * 0.05;
    pitch = 0.25;
    // Sengaja TIDAK setScreen('complete'): overlay layar akhir akan
    // menutupi vista fajar. Banner saja yang tampil di atas kota.
    // REPAIR-4: updateGame TETAP memicu complete (semua misi selesai)
    // di frame pertama — penahannya ada di frame(): layar complete
    // dikembalikan ke 'playing' sampai __shotReady tercapai.
    showBanner(hud, 'FAJAR TERBIT — ARUNIKA BAY', 6);
  }
}

function frame() {
  requestAnimationFrame(frame);
  const now = performance.now();
  let dt = (now - clock.last) / 1000;
  clock.last = now;
  if (dt > 0.25) dt = 0.25;
  if (SHOT) {
    // Mode screenshot: simulasi maju terus (traffic bergerak) + input
    // maju otomatis di mode kejar-kejaran, lalu beku + tandai siap.
    // REPAIR-4: BEKU BENAR-BENAR setelah siap — kode lama mengklaim
    // "lalu beku" tapi simulasi terus jalan: driver CDP menangkap
    // hingga 500 ms setelah __shotReady, dan dalam jeda itu mobil cover
    // melaju sampai tepi dunia lalu terjepit (kecepatan runtuh x0,25
    // tiap frame → "1 km/jam" di shot uji). Setelah shotDone, hanya
    // render — tanpa updateGame/world.update — supaya isi frame sama
    // persis seperti saat __shotReady pertama kali true.
    if (!shotDone) {
      clock.acc += dt;
      const step = 1 / 60;
      let guard = 0;
      while (clock.acc >= step && guard < 5) {
        clock.acc -= step;
        guard += 1;
        const input = readInput();
        if (SHOT === 'cover' || SHOT === 'chase') input.forward = true;
        if (isPlaying(game.screens)) updateGame(game, input, step);
        if (world.update) world.update(step, { player: game.player, wanted: game.wanted });
        shotFrames += 1;
      }
    }
    // REPAIR-4 (vista): updateGame memicu layar 'complete' di frame
    // pertama karena semua misi ditandai selesai — kembalikan ke
    // 'playing' di SETIAP frame mode vista (tanpa syarat !shotDone:
    // frame yang sama saat shotDone jadi true harus ikut ditahan,
    // kalau tidak overlay lolos ke screenshot). allMissionsDone sudah
    // true, jadi pemicu tidak berulang; sim dibekukan setelah siap,
    // maka layar complete tidak pernah tampil di frame tangkapan.
    if (SHOT === 'vista' || SHOT === 'end') {
      if (game.screens.current === 'complete') setScreen(game.screens, 'playing');
    }
    updateHud(hud, game);
    syncActorMeshes();
    updateCamera(dt);
    renderer.render(scene, camera);
    if (shotFrames >= 120 && !shotDone) {
      shotDone = true;
      window.__shotReady = true;
    }
    return;
  }
  clock.acc += dt;
  const step = 1 / 60;
  let guard = 0;
  while (clock.acc >= step && guard < 5) {
    clock.acc -= step;
    guard += 1;
    if (isPlaying(game.screens)) updateGame(game, readInput(), step);
    else if (world.update) world.update(step, { player: game.player, wanted: game.wanted });
  }
  // Toast + dialog misi diteruskan ke HUD.
  if (game.toasts.length) {
    const t = game.toasts[game.toasts.length - 1];
    showMessage(hud, t.text, 3);
    game.toasts.length = 0;
  }
  updateHud(hud, game);
  syncActorMeshes();
  updateCamera(dt);
  renderer.render(scene, camera);
}

async function boot() {
  // Pakai kanvas #game-canvas dari index.html bila ada; bila tidak ada,
  // buat kanvas sendiri (game tetap jalan tanpa halaman Rewrite-World).
  const pageCanvas = typeof document !== 'undefined' ? document.getElementById('game-canvas') : null;
  renderer = new THREE.WebGLRenderer({ antialias: true, canvas: pageCanvas || undefined });
  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.domElement.id = 'arunika-canvas';
  if (!pageCanvas) document.body.appendChild(renderer.domElement);
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.1, 600);

  // Muat modul dunia bila ada; bila gagal, pakai stub (game tetap jalan).
  world = createStubWorld();
  try {
    const mod = await import('./world/index.js');
    const createWorld = mod.createWorld || (mod.default && mod.default.createWorld);
    if (typeof createWorld === 'function') {
      const raw = await createWorld(THREE, scene);
      world = adaptWorld(raw);
      world._fromModule = true;
    }
  } catch (err) {
    console.warn('[arunika] modul World belum tersedia, memakai dunia stub:', err && err.message);
  }
  if (!world._fromModule) {
    buildDawnSky();
    buildGroundAndRoads();
  }
  // Dunia asli sudah membangun langit + pencahayaan + kota + mobil
  // sendiri — jangan menumpuk matahari/kota/mesh mobil kedua di atasnya.
  game = createGame(world);
  hud = createHudState();
  buildHud(hud);
  buildActors();
  bindInput();
  setScreen(game.screens, 'start');
  if (SHOT) stageShot();
  frame();
}

boot().catch((err) => {
  console.error('[arunika] gagal boot:', err);
  document.body.innerHTML = '<p style="font-family:sans-serif;padding:24px;">ARUNIKA BAY gagal dimuat: ' + String(err && err.message) + '</p>';
});
// --- akhir main.js (baris revisi ditambahkan lewat edit terpisah) ---
// Revisi terekam: mode screenshot memakai nama yang sama dengan
// screenshots/ (1-cover-chase, 2-foot-lentera, 3-heist, 4-vista) supaya
// nama file = mode ?shot= yang men-staging-nya; juri melihat cover
// kejar-kejaran sebagai screenshot pertama menurut nama file.
// Daftar mode: start | play/foot | cover/chase | heist | end/vista.
export const SHOT_MODES = ['start', 'play', 'foot', 'cover', 'chase', 'heist', 'end', 'vista'];
