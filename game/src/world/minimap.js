// minimap.js — Minimap 2D ARUNIKA BAY di atas canvas 190x190.
// Menggambar jalan, laut, plaza, pemain (oranye), polisi (biru),
// preman (merah), dan Kancil (oranye muda). Murni Canvas 2D —
// tanpa THREE, bisa dites di Node dengan canvas palsu.

import { MINIMAP_COLORS, WORLD_BOUNDS, ROAD_Z, ROAD_X, SEA_Z, FOUNTAIN } from './config.js';

export const MINIMAP_SIZE = 190;

// Petakan koordinat dunia -> piksel minimap.
export function worldToMap(x, z, size = MINIMAP_SIZE) {
  const spanX = WORLD_BOUNDS.maxX - WORLD_BOUNDS.minX;
  const spanZ = WORLD_BOUNDS.maxZ - WORLD_BOUNDS.minZ;
  return {
    x: ((x - WORLD_BOUNDS.minX) / spanX) * size,
    y: ((z - WORLD_BOUNDS.minZ) / spanZ) * size,
  };
}

// Gambar minimap ke konteks 2D. data = { player, police, enemies,
// kancil, vehicles } — semua opsional kecuali player.
export function drawMinimap(ctx, data, size = MINIMAP_SIZE) {
  const C = MINIMAP_COLORS;
  ctx.fillStyle = C.background;
  ctx.fillRect(0, 0, size, size);

  // Laut teal di selatan.
  const seaTop = worldToMap(0, SEA_Z, size).y;
  ctx.fillStyle = C.sea;
  ctx.fillRect(0, seaTop, size, size - seaTop);

  // Plaza alun-alun.
  const plaza = worldToMap(FOUNTAIN.x, FOUNTAIN.z, size);
  ctx.fillStyle = C.plaza;
  ctx.beginPath();
  ctx.arc(plaza.x, plaza.y, 7, 0, Math.PI * 2);
  ctx.fill();

  // Jalan: garis tebal abu-abu.
  ctx.strokeStyle = C.road;
  ctx.lineWidth = 4;
  for (const z of ROAD_Z) {
    const a = worldToMap(WORLD_BOUNDS.minX, z, size);
    const b = worldToMap(WORLD_BOUNDS.maxX, z, size);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  for (const x of ROAD_X) {
    const a = worldToMap(x, WORLD_BOUNDS.minZ, size);
    const b = worldToMap(x, WORLD_BOUNDS.maxZ, size);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }

  // Kancil M2 (penanda oranye muda).
  if (data.kancil) {
    const k = worldToMap(data.kancil.x, data.kancil.z, size);
    ctx.fillStyle = C.kancil;
    ctx.beginPath();
    ctx.arc(k.x, k.y, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Preman (merah).
  if (data.enemies) {
    ctx.fillStyle = C.enemy;
    for (const e of data.enemies) {
      const p = worldToMap(e.x, e.z, size);
      ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
    }
  }

  // Polisi (biru).
  if (data.police) {
    ctx.fillStyle = C.police;
    for (const o of data.police) {
      const p = worldToMap(o.x, o.z, size);
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Pemain (segitiga oranye menghadap arah yaw di peta).
  if (data.player) {
    const p = worldToMap(data.player.x, data.player.z, size);
    const yaw = data.player.yaw || 0;
    // Maju di peta = (-sin yaw, -cos yaw) karena y peta = +z dunia.
    const fx = -Math.sin(yaw);
    const fy = -Math.cos(yaw);
    const px = -fy;
    const py = fx;
    ctx.fillStyle = C.player;
    ctx.beginPath();
    ctx.moveTo(p.x + fx * 7, p.y + fy * 7);
    ctx.lineTo(p.x - fx * 5 + px * 5, p.y - fy * 5 + py * 5);
    ctx.lineTo(p.x - fx * 5 - px * 5, p.y - fy * 5 - py * 5);
    ctx.closePath();
    ctx.fill();
  }
  return true;
}

// ---- Tambahan: pabrik minimap terikat canvas (revisi ke-2) ----

// Buat penggambar minimap yang terikat satu elemen canvas: panggil
// draw(data) tiap frame dari main.js. Canvas di index.html 190x190.
export function createMinimap(canvas) {
  const ctx = canvas.getContext('2d');
  return {
    canvas,
    draw(data) {
      return drawMinimap(ctx, data, MINIMAP_SIZE);
    },
  };
}
