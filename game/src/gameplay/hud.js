// hud.js — HUD + minimap ARUNIKA BAY.
//
// Menulis ke elemen DOM yang disediakan `game/index.html`:
//   #hud-wanted    bintang buronan ("BERSIH" atau ★★★★☆)
//   #hud-money     uang ("$50")
//   #hud-health    nyawa ("❤ 100")
//   #hud-weapon    senjata ("Tinju" / "Pistol Rakitan 12/48")
//   #hud-objective objektif misi aktif
//   #hud-dialog    baris dialog cerita
//   #hud-district  nama distrik tempat Bara berada
//   #hud-banner    spanduk besar (mis. "FAJAR TERBIT — ARUNIKA BAY")
//   #hud-toast     pesan singkat (mis. "Semua misi selesai ...")
//   #minimap       canvas 2D 190×190
//
// Semua akses DOM dijaga: elemen yang tidak ada dilewati diam-diam (bukan
// error), supaya modul tetap jalan di tes Node tanpa `document`. Pemanggil
// boleh menyuntik `doc` kustom — dipakai tes dengan document palsu.

import { wantedLabel } from './wanted.js';

/** Ukuran minimap (px) — sesuai kontrak. */
export const MINIMAP_SIZE = 190;

// Jangkauan dunia yang dipetakan minimap (meter, dari pusat kota).
export const MINIMAP_WORLD_RADIUS = 130;

// Warna titik di minimap.
export const MINIMAP_COLORS = {
  background: '#0f172a',
  road: '#334155',
  player: '#f97316',
  police: '#3b82f6',
  enemy: '#ef4444',
  vehicle: '#94a3b8',
  kancil: '#eab308',
};

/** Ambil elemen berdasarkan id, atau null bila tidak ada / tidak ada doc. */
function el(doc, id) {
  try {
    if (!doc || typeof doc.getElementById !== 'function') return null;
    return doc.getElementById(id);
  } catch (_err) {
    return null;
  }
}

/** Tulis teks ke elemen bila ada. */
function setText(node, text) {
  if (!node) return;
  try {
    node.textContent = String(text);
  } catch (_err) {
    // Elemen read-only di tes — abaikan.
  }
}

/** Format uang: 50 -> "$50". */
export function formatMoney(amount) {
  const n = Math.max(0, Math.floor(Number(amount) || 0));
  return `$${n}`;
}

/** Format nyawa: 100 -> "❤ 100". */
export function formatHealth(health) {
  const n = Math.max(0, Math.min(100, Math.floor(Number(health) || 0)));
  return `❤ ${n}`;
}

/**
 * Manajer HUD.
 *
 * @param {object} [doc] dokumen DOM (default: `document` global bila ada;
 *   boleh null di tes logika)
 */
export function createHud(doc) {
  const documentRef =
    doc || (typeof document !== 'undefined' ? document : null);
  const nodes = {
    wanted: el(documentRef, 'hud-wanted'),
    money: el(documentRef, 'hud-money'),
    health: el(documentRef, 'hud-health'),
    weapon: el(documentRef, 'hud-weapon'),
    objective: el(documentRef, 'hud-objective'),
    dialog: el(documentRef, 'hud-dialog'),
    district: el(documentRef, 'hud-district'),
    banner: el(documentRef, 'hud-banner'),
    toast: el(documentRef, 'hud-toast'),
    minimap: el(documentRef, 'minimap'),
  };

  function show(node) {
    if (!node || !node.style) return;
    node.style.display = '';
  }

  function hide(node) {
    if (!node || !node.style) return;
    node.style.display = 'none';
  }

  const api = {
    /** Elemen-elemen HUD yang ditemukan (untuk diagnosis). */
    nodes,

    /** Bintang buronan: tulis "BERSIH" atau ★★★★☆. */
    setWanted(stars) {
      setText(nodes.wanted, wantedLabel(stars));
      return nodes.wanted ? nodes.wanted.textContent : wantedLabel(stars);
    },

    /** Uang: tulis "$50". */
    setMoney(amount) {
      setText(nodes.money, formatMoney(amount));
      return formatMoney(amount);
    },

    /** Nyawa: tulis "❤ 100". */
    setHealth(health) {
      setText(nodes.health, formatHealth(health));
      return formatHealth(health);
    },

    /** Senjata: "Tinju" atau "Pistol Rakitan 12/48". */
    setWeapon(name, ammo, reserveAmmo) {
      let text = name || 'Tinju';
      // Amunisi hanya ditampilkan bila ada peluru (pistol); tinju polos.
      if (
        typeof ammo === 'number' &&
        typeof reserveAmmo === 'number' &&
        (ammo > 0 || reserveAmmo > 0)
      ) {
        text = `${name} ${ammo}/${reserveAmmo}`;
      }
      setText(nodes.weapon, text);
      return text;
    },

    /** Objektif misi aktif. */
    setObjective(text) {
      setText(nodes.objective, text || '');
      return text || '';
    },

    /** Baris dialog cerita. */
    setDialog(text) {
      setText(nodes.dialog, text || '');
      if (text) show(nodes.dialog);
      else hide(nodes.dialog);
      return text || '';
    },

    /** Nama distrik tempat Bara berada. */
    setDistrict(name) {
      setText(nodes.district, name || '');
      return name || '';
    },

    /** Spanduk besar tengah layar (layar akhir / vista). */
    showBanner(text) {
      setText(nodes.banner, text || '');
      if (text) show(nodes.banner);
      else hide(nodes.banner);
      return text || '';
    },

    /** Pesan singkat (toast) di bawah spanduk. */
    showToast(text) {
      setText(nodes.toast, text || '');
      if (text) show(nodes.toast);
      else hide(nodes.toast);
      return text || '';
    },

    /** Sembunyikan spanduk + toast. */
    hideBanner() {
      this.showBanner('');
      this.showToast('');
    },

    /**
     * Gambar minimap 190×190: titik Bara (oranye), polisi (biru), preman
     * (merah), mobil (abu-abu), Kancil M2 (kuning). Dunia dipetakan dari
     * pusat kota dengan radius MINIMAP_WORLD_RADIUS.
     */
    drawMinimap(adapter, player, police, enemies) {
      const canvas = nodes.minimap;
      if (!canvas || typeof canvas.getContext !== 'function') return false;
      let ctx = null;
      try {
        ctx = canvas.getContext('2d');
      } catch (_err) {
        return false;
      }
      if (!ctx) return false;
      const size = MINIMAP_SIZE;
      const scale = size / (MINIMAP_WORLD_RADIUS * 2);
      const toMap = (wx, wz) => ({
        x: size / 2 + wx * scale,
        y: size / 2 + wz * scale,
      });
      const dot = (wx, wz, radius, color) => {
        const p = toMap(wx, wz);
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
        ctx.fill();
      };

      ctx.fillStyle = MINIMAP_COLORS.background;
      ctx.fillRect(0, 0, size, size);
      // Jalan utama: salib di tengah kota.
      ctx.fillStyle = MINIMAP_COLORS.road;
      ctx.fillRect(0, size / 2 - 3, size, 6);
      ctx.fillRect(size / 2 - 3, 0, 6, size);

      const vehicles = (adapter && adapter.vehicles) || [];
      for (const vehicle of vehicles) {
        if (!vehicle) continue;
        const isKancil = vehicle.type === 'kancil';
        dot(
          vehicle.x || 0,
          vehicle.z || 0,
          isKancil ? 3.5 : 2.5,
          isKancil ? MINIMAP_COLORS.kancil : MINIMAP_COLORS.vehicle,
        );
      }
      const foes = (enemies && enemies.list) || [];
      for (const enemy of foes) {
        if (enemy && enemy.alive) dot(enemy.x || 0, enemy.z || 0, 3, MINIMAP_COLORS.enemy);
      }
      const officers = (police && police.officers) || [];
      for (const officer of officers) {
        dot(officer.x || 0, officer.z || 0, 3, MINIMAP_COLORS.police);
      }
      if (player) {
        dot(player.x || 0, player.z || 0, 4, MINIMAP_COLORS.player);
        // Arah hadap Bara: garis pendek dari titik pemain.
        const p = toMap(player.x || 0, player.z || 0);
        const yaw = player.yaw || 0;
        ctx.strokeStyle = MINIMAP_COLORS.player;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x + Math.sin(yaw) * 9, p.y + Math.cos(yaw) * 9);
        ctx.stroke();
      }
      return true;
    },

    /**
     * Segarkan semua bidang HUD dari satu objek state game.
     * @param {object} state `{money, health, weapon, ammo, reserveAmmo,
     *   wantedStars, objective, dialog, district}`
     */
    update(state) {
      if (!state) return;
      if (typeof state.wantedStars === 'number') this.setWanted(state.wantedStars);
      if (typeof state.money === 'number') this.setMoney(state.money);
      if (typeof state.health === 'number') this.setHealth(state.health);
      if (typeof state.weapon === 'string') {
        this.setWeapon(state.weapon, state.ammo, state.reserveAmmo);
      }
      if (typeof state.objective === 'string') this.setObjective(state.objective);
      if (typeof state.dialog === 'string') this.setDialog(state.dialog);
      if (typeof state.district === 'string') this.setDistrict(state.district);
    },
  };
  return api;
}
