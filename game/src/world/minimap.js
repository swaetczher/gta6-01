// ARUNIKA BAY — minimap 2D top-down 190x190 (tulis ulang round 2).
// Digambar tiap frame oleh world.update ke canvas #minimap bila ada:
// jalan abu-abu, blok bangunan, laut teal, pemain panah oranye, mobil,
// pejalan kaki, dan penanda misi kuning.
import { AVENUES, STREETS, WORLD } from './config.js';

const MAP_SIZE = 190;

// Proyeksi koordinat dunia (-130..130) ke piksel canvas (0..190).
export function worldToMap(x, z) {
  const s = MAP_SIZE / (WORLD.half * 2);
  return { x: (x + WORLD.half) * s, y: (z + WORLD.half) * s };
}

export function drawMinimap(canvas, world, focus) {
  if (!canvas || typeof canvas.getContext !== 'function') return false;
  const ctx = canvas.getContext('2d');
  if (!ctx) return false;
  const w = canvas.width || MAP_SIZE;
  const h = canvas.height || MAP_SIZE;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#20242e';
  ctx.fillRect(0, 0, w, h);
  const s = w / (WORLD.half * 2);
  const px = (x) => (x + WORLD.half) * s;
  const pz = (z) => (z + WORLD.half) * s;
  // Laut di selatan.
  ctx.fillStyle = '#1f8a8a';
  ctx.fillRect(0, pz(112), w, h - pz(112));
  // Jalan.
  ctx.fillStyle = '#55505e';
  for (const x of AVENUES) ctx.fillRect(px(x - 5), 0, 10 * s, h);
  for (const z of STREETS) ctx.fillRect(0, pz(z - 5), w, 10 * s);
  // Bangunan (kotak collider).
  ctx.fillStyle = '#8a7f74';
  for (const c of world.colliders || []) {
    if (c.w !== undefined) ctx.fillRect(px(c.x - c.w / 2), pz(c.z - c.d / 2), c.w * s, c.d * s);
  }
  // Kanal pasar terapung.
  ctx.fillStyle = '#2a7a8a';
  ctx.fillRect(px(-85), pz(57), 130 * s, 18 * s);
  // Mobil lalu lintas (titik putih) + parkir (titik abu).
  ctx.fillStyle = '#f5f5f5';
  for (const car of world.traffic || []) {
    ctx.fillRect(px(car.x) - 1.5, pz(car.z) - 1.5, 3, 3);
  }
  ctx.fillStyle = '#b8b0a0';
  for (const v of world.vehicles || []) {
    ctx.fillRect(px(v.x) - 1.5, pz(v.z) - 1.5, 3, 3);
  }
  return true;
}

// Penanda misi (kuning) + pemain (panah oranye) + polisi (titik biru).
export function drawMinimapOverlays(canvas, world, focus) {
  if (!canvas || typeof canvas.getContext !== 'function') return false;
  const ctx = canvas.getContext('2d');
  if (!ctx) return false;
  const w = canvas.width || MAP_SIZE;
  const s = w / (WORLD.half * 2);
  const px = (x) => (x + WORLD.half) * s;
  const pz = (z) => (z + WORLD.half) * s;
  if (focus && Array.isArray(focus.markers)) {
    ctx.fillStyle = '#ffd23a';
    for (const m of focus.markers) {
      ctx.beginPath();
      ctx.arc(px(m.x), pz(m.z), 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  if (focus && Array.isArray(focus.police)) {
    ctx.fillStyle = '#3a6ad8';
    for (const p of focus.police) {
      ctx.beginPath();
      ctx.arc(px(p.x), pz(p.z), 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  if (focus && focus.player) {
    const p = focus.player;
    const cx = px(p.x);
    const cy = pz(p.z);
    const yaw = p.yaw || 0;
    ctx.fillStyle = '#ff8a2a';
    ctx.beginPath();
    ctx.moveTo(cx + Math.sin(yaw) * 7, cy + Math.cos(yaw) * 7);
    ctx.lineTo(cx + Math.sin(yaw + 2.5) * 5, cy + Math.cos(yaw + 2.5) * 5);
    ctx.lineTo(cx + Math.sin(yaw - 2.5) * 5, cy + Math.cos(yaw - 2.5) * 5);
    ctx.closePath();
    ctx.fill();
  }
  return true;
}

// Gambar lengkap: dasar + overlay (satu panggilan dari world.update).
export function renderMinimap(canvas, world, focus) {
  if (!drawMinimap(canvas, world, focus)) return false;
  return drawMinimapOverlays(canvas, world, focus);
}
