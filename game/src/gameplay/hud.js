// hud.js — HUD Arunika Bay + minimap canvas 2D top-down.
// HUD DOM: health bar, uang, bintang wanted, ammo + nama senjata,
// objektif + progres misi, kotak dialog, banner misi, pesan sementara.
// Minimap: jalan (jarak antar jalan 44 m dari data dunia), gedung,
// landmark, mobil, target misi, polisi, panah pemain. Semua fungsi
// aman dipanggil tanpa DOM (node test): guard typeof document.
export const MINIMAP_SIZE = 190;
export const ROAD_SPACING = 44;

export function createHudState() {
  return {
    root: null,
    els: {},
    minimapCtx: null,
    messageTimer: 0,
    dialogTimer: 0,
    bannerTimer: 0,
  };
}

function el(tag, id, css) {
  const n = document.createElement(tag);
  if (id) n.id = id;
  if (css) n.style.cssText = css;
  return n;
}

// Ambil elemen mengambang bila sudah ada, bila belum buat + tempel ke body.
function ensureFloatingBox(id, css) {
  const old = document.getElementById(id);
  if (old) return old;
  const n = el('div', id, css);
  document.body.appendChild(n);
  return n;
}

// Bangun elemen HUD bila belum ada di index.html. Idempotent.
// Bila index.html SUDAH menyediakan kerangka HUD (#hud, #hud-wanted,
// #hud-money, #hud-objective, #minimap), elemen itu DIPAKAI ULANG —
// tidak dibuat duplikat (ID ganda akan membuat getElementById salah
// sasaran dan HUD tampil dua kali). Dialog/banner dibuat hanya bila
// belum ada di halaman.
export function buildHud(hud) {
  if (typeof document === 'undefined' || hud.root) return hud;
  const pageWanted = document.getElementById('hud-wanted');
  const loading = document.getElementById('loading-screen');
  if (loading) loading.style.display = 'none';
  if (pageWanted) {
    const pageHud = document.getElementById('hud');
    if (pageHud) pageHud.classList.add('active');
    const minimapCanvas = document.getElementById('minimap');
    hud.root = pageHud || document.body;
    hud.adopted = true;
    // Halaman tidak punya slot senjata: tambahkan satu baris ke panel kiri.
    let weaponEl = document.getElementById('hud-weapon');
    if (!weaponEl) {
      const panel = document.getElementById('hud-top-left');
      weaponEl = document.createElement('div');
      weaponEl.id = 'hud-weapon';
      weaponEl.style.cssText = 'font-size:15px;margin-top:4px;';
      if (panel) panel.appendChild(weaponEl);
      else document.body.appendChild(weaponEl);
    }
    hud.els = {
      wanted: pageWanted,
      money: document.getElementById('hud-money'),
      healthFill: null,
      health: document.getElementById('hud-health'),
      weapon: weaponEl,
      objective: document.getElementById('hud-objective'),
      speed: document.getElementById('hud-speed'),
      district: document.getElementById('hud-district'),
      dialog: ensureFloatingBox('hud-dialog', 'position:fixed;left:50%;bottom:96px;transform:translateX(-50%);max-width:640px;background:rgba(0,0,0,.72);color:#ffe9a8;padding:12px 16px;border-radius:10px;font-size:16px;line-height:1.45;display:none;text-align:center;z-index:15;'),
      banner: ensureFloatingBox('hud-banner', 'position:fixed;left:50%;top:22%;transform:translateX(-50%);color:#ffd94a;font-size:34px;font-weight:800;text-shadow:0 2px 8px #000;display:none;text-align:center;z-index:15;'),
      message: document.getElementById('hud-message'),
    };
    if (minimapCanvas) hud.minimapCtx = minimapCanvas.getContext('2d');
    return hud;
  }
  const root = el('div', 'hud-arunika', 'position:fixed;inset:0;pointer-events:none;font-family:system-ui,sans-serif;z-index:10;');
  const topLeft = el('div', 'hud-topleft', 'position:absolute;top:12px;left:12px;color:#fff;text-shadow:0 1px 3px #000;');
  topLeft.innerHTML = '<div id="hud-wanted" style="font-size:26px;letter-spacing:2px;color:#ffd94a;">BERSIH</div>'
    + '<div id="hud-money" style="font-size:22px;font-weight:700;">$50</div>'
    + '<div id="hud-health" style="width:170px;height:14px;background:#222;border:2px solid #fff;margin-top:4px;"><div id="hud-health-fill" style="height:100%;width:100%;background:#37d67a;"></div></div>'
    + '<div id="hud-weapon" style="font-size:15px;margin-top:4px;">Tinju</div>';
  const topRight = el('div', 'hud-topright', 'position:absolute;top:12px;right:12px;max-width:340px;color:#fff;text-align:right;text-shadow:0 1px 3px #000;');
  topRight.innerHTML = '<div id="hud-objective" style="font-size:15px;font-weight:600;background:rgba(0,0,0,.45);padding:8px 10px;border-radius:8px;"></div>'
    + '<div id="hud-speed" style="font-size:13px;margin-top:6px;"></div>';
  const bottom = el('div', 'hud-bottom', 'position:absolute;left:12px;bottom:12px;');
  const canvas = el('canvas', 'hud-minimap', 'width:190px;height:190px;background:rgba(10,20,30,.82);border:2px solid #ffd94a;border-radius:8px;');
  canvas.width = MINIMAP_SIZE;
  canvas.height = MINIMAP_SIZE;
  bottom.appendChild(canvas);
  const dialog = el('div', 'hud-dialog', 'position:absolute;left:50%;bottom:96px;transform:translateX(-50%);max-width:640px;background:rgba(0,0,0,.72);color:#ffe9a8;padding:12px 16px;border-radius:10px;font-size:16px;line-height:1.45;display:none;text-align:center;');
  const banner = el('div', 'hud-banner', 'position:absolute;left:50%;top:22%;transform:translateX(-50%);color:#ffd94a;font-size:34px;font-weight:800;text-shadow:0 2px 8px #000;display:none;text-align:center;');
  const message = el('div', 'hud-message', 'position:absolute;left:50%;bottom:210px;transform:translateX(-50%);color:#fff;font-size:15px;background:rgba(0,0,0,.55);padding:6px 12px;border-radius:8px;display:none;');
  root.appendChild(topLeft);
  root.appendChild(topRight);
  root.appendChild(bottom);
  root.appendChild(dialog);
  root.appendChild(banner);
  root.appendChild(message);
  document.body.appendChild(root);
  hud.root = root;
  hud.els = {
    wanted: document.getElementById('hud-wanted'),
    money: document.getElementById('hud-money'),
    healthFill: document.getElementById('hud-health-fill'),
    health: null,
    weapon: document.getElementById('hud-weapon'),
    objective: document.getElementById('hud-objective'),
    speed: document.getElementById('hud-speed'),
    district: null,
    dialog,
    banner,
    message,
  };
  hud.minimapCtx = canvas.getContext('2d');
  return hud;
}

export function setText(node, text) {
  if (node && node.textContent !== text) node.textContent = text;
}

export function updateHud(hud, state) {
  if (typeof document === 'undefined') return;
  buildHud(hud);
  const { player, wanted, combat, missions } = state;
  setText(hud.els.wanted, wanted.stars > 0 ? '★'.repeat(wanted.stars) + '☆'.repeat(5 - wanted.stars) : 'BERSIH');
  setText(hud.els.money, `$${player.money}`);
  if (hud.els.healthFill) {
    hud.els.healthFill.style.width = `${Math.max(0, player.health)}%`;
    hud.els.healthFill.style.background = player.health > 50 ? '#37d67a' : player.health > 25 ? '#ffb02e' : '#e5484d';
  }
  // Halaman index.html memakai teks "❤ 100" (bukan health bar).
  setText(hud.els.health, `❤ ${Math.max(0, Math.round(player.health))}`);
  if (hud.els.district && state.world && state.world.dunia && typeof state.world.dunia.districtAt === 'function') {
    const d = state.world.dunia.districtAt(player.x, player.z);
    setText(hud.els.district, d ? d.name : '');
  }
  const w = combat ? combat.weapon : player.weapon;
  const ammo = combat && combat.weapon === 'pistol' ? ` ${combat.ammo}/${combat.ammoReserve}` : '';
  setText(hud.els.weapon, (w === 'pistol' ? 'Pistol Rakitan' : 'Tinju') + ammo);
  const obj = missionsLabel(state);
  setText(hud.els.objective, obj);
  const speed = player.inCar && state.world
    ? Math.round(Math.abs((state.world.cars.find((c) => c.id === player.inCar) || { speed: 0 }).speed) * 3.6)
    : 0;
  setText(hud.els.speed, player.inCar ? `${speed} km/jam — ${carName(state)}` : 'Jalan kaki — Bara Kelana');
  if (hud.minimapCtx) drawMinimap(hud.minimapCtx, state);
  tickHudTimers(hud, 1 / 60);
}

export function missionsLabel(state) {
  const ms = state.missions;
  const mission = ms.currentId
    ? (state.missionDefs || []).find((m) => m.id === ms.currentId)
    : null;
  if (!mission) {
    const done = ms.completed.length;
    return done >= 5 ? 'Semua misi selesai — Arunika Bay bebas!' : `Misi selesai: ${done}/5 — tekan Enter untuk misi berikutnya.`;
  }
  const obj = mission.objectives[ms.objectiveIndex];
  const prog = `(${Math.min(ms.objectiveIndex + 1, mission.objectives.length)}/${mission.objectives.length})`;
  return `${mission.id} ${mission.title} ${prog}: ${obj ? obj.label : ''}`;
}

export function carName(state) {
  if (!state.player.inCar || !state.world) return '';
  const car = state.world.cars.find((c) => c.id === state.player.inCar);
  return car ? car.model : '';
}

export function showDialog(hud, text, seconds) {
  if (typeof document === 'undefined') return;
  buildHud(hud);
  hud.els.dialog.textContent = text;
  hud.els.dialog.style.display = 'block';
  hud.dialogTimer = seconds || 5;
}

export function showBanner(hud, text, seconds) {
  if (typeof document === 'undefined') return;
  buildHud(hud);
  hud.els.banner.textContent = text;
  hud.els.banner.style.display = 'block';
  hud.bannerTimer = seconds || 3;
}

export function showMessage(hud, text, seconds) {
  if (typeof document === 'undefined') return;
  buildHud(hud);
  hud.els.message.textContent = text;
  hud.els.message.style.display = 'block';
  hud.messageTimer = seconds || 3;
}

export function tickHudTimers(hud, dt) {
  if (hud.dialogTimer > 0) {
    hud.dialogTimer -= dt;
    if (hud.dialogTimer <= 0 && hud.els.dialog) hud.els.dialog.style.display = 'none';
  }
  if (hud.bannerTimer > 0) {
    hud.bannerTimer -= dt;
    if (hud.bannerTimer <= 0 && hud.els.banner) hud.els.banner.style.display = 'none';
  }
  if (hud.messageTimer > 0) {
    hud.messageTimer -= dt;
    if (hud.messageTimer <= 0 && hud.els.message) hud.els.message.style.display = 'none';
  }
}

// Minimap 2D top-down. worldToMap memakai bounds dunia (±110 m) sehingga
// jalan yang berjarak 44 m tergambar dengan jarak yang benar.
export function worldToMap(x, z, size, bounds) {
  const half = bounds || 110;
  const s = size / (half * 2);
  return { mx: (x + half) * s, my: (z + half) * s };
}

export function drawMinimap(ctx, state) {
  const size = MINIMAP_SIZE;
  const bounds = state.world ? state.world.bounds : 110;
  const roads = state.world && state.world.roads ? state.world.roads : [-88, -44, 0, 44, 88];
  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = '#0d2733';
  ctx.fillRect(0, 0, size, size);
  // Blok gedung.
  if (state.world && state.world.colliders) {
    ctx.fillStyle = '#274b5f';
    for (const c of state.world.colliders) {
      const a = worldToMap(c.x1, c.z1, size, bounds);
      const b = worldToMap(c.x2, c.z2, size, bounds);
      ctx.fillRect(a.mx, a.my, Math.max(2, b.mx - a.mx), Math.max(2, b.my - a.my));
    }
  }
  // Jalan (data dunia; jarak antar jalan 44 m).
  ctx.strokeStyle = '#c9a86a';
  ctx.lineWidth = 5;
  for (const r of roads) {
    const h = worldToMap(r, -bounds, size, bounds);
    const v = worldToMap(-bounds, r, size, bounds);
    ctx.beginPath(); ctx.moveTo(0, h.my); ctx.lineTo(size, h.my); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(v.mx, 0); ctx.lineTo(v.mx, size); ctx.stroke();
  }
  // Kanal Pasar Terapung: persegi air teal (diblokir — lihat world-adapter).
  if (state.world && state.world.canal) {
    const c = state.world.canal;
    const a = worldToMap(c.x1, c.z1, size, bounds);
    const b = worldToMap(c.x2, c.z2, size, bounds);
    ctx.fillStyle = '#3f8fa3';
    ctx.fillRect(a.mx, a.my, b.mx - a.mx, b.my - a.my);
  }
  // Landmark.
  if (state.world && state.world.landmarks) {
    ctx.fillStyle = '#ffd94a';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    for (const lm of state.world.landmarks) {
      const p = worldToMap(lm.x, lm.z, size, bounds);
      ctx.fillText(lm.mark || '◆', p.mx, p.my);
    }
  }
  // Mobil (kuning), polisi (merah), target misi (kuning berdenyut).
  const dot = (x, z, color, r) => {
    const p = worldToMap(x, z, size, bounds);
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(p.mx, p.my, r, 0, Math.PI * 2); ctx.fill();
  };
  if (state.world) {
    for (const car of state.world.cars) dot(car.x, car.z, '#ffe066', 2.5);
    for (const p of state.police) dot(p.x, p.z, '#e5484d', 3);
  }
  const target = missionTargetPoint(state);
  if (target) {
    const pulse = 4 + Math.sin(Date.now() / 240) * 1.5;
    dot(target.x, target.z, '#ffd94a', pulse);
  }
  // Panah pemain (biru, searah heading). Arah dunia (sin h, cos h) di
  // peta (x ke kanan, z ke bawah) sama dengan putaran (PI - h) dari
  // panah yang digambar menghadap atas.
  const pp = worldToMap(state.player.x, state.player.z, size, bounds);
  ctx.save();
  ctx.translate(pp.mx, pp.my);
  ctx.rotate(Math.PI - state.player.heading);
  ctx.fillStyle = '#4da3ff';
  ctx.beginPath(); ctx.moveTo(0, -7); ctx.lineTo(5, 6); ctx.lineTo(-5, 6); ctx.closePath(); ctx.fill();
  ctx.restore();
}

export function missionTargetPoint(state) {
  const ms = state.missions;
  if (!ms.currentId) return null;
  const mission = (state.missionDefs || []).find((m) => m.id === ms.currentId);
  if (!mission) return null;
  const obj = mission.objectives[ms.objectiveIndex];
  if (!obj || typeof obj.x !== 'number') return null;
  return { x: obj.x, z: obj.z };
}
// --- akhir hud.js (baris revisi ditambahkan lewat edit terpisah) ---
// Revisi terekam: minimap membaca daftar jalan dari world.roads (bukan
// grid hardcode) — bila Rewrite-World mengubah letak jalan, minimap ikut
// benar selama jarak antar jalan tetap 44 m seperti kontrak dunia.
export function minimapRoadCount(state) {
  return state.world && state.world.roads ? state.world.roads.length : 0;
}
