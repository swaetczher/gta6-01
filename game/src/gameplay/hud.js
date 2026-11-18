// hud.js — Lapisan info di layar: bintang buronan, uang, nyawa, senjata,
// objektif misi, dialog, nama distrik, banner, toast, dan minimap.
// Semua setter menyimpan nilai terakhir di memori dulu, lalu menulis ke
// DOM bila elemennya ada. Elemen yang tidak ada dilewati diam-diam —
// HUD tidak pernah melempar error karena satu id hilang.

export const MINIMAP_SIZE = 190;
export const MINIMAP_RANGE = 120;

export function formatMoney(amount) {
  return `$${Math.round(Number(amount) || 0)}`;
}

export function formatHealth(health) {
  return `❤${Math.max(0, Math.round(Number(health) || 0))}`;
}

export function formatStars(stars) {
  const full = Math.max(0, Math.min(5, Math.round(Number(stars) || 0)));
  return '★'.repeat(full) + '☆'.repeat(5 - full);
}

function el(id) {
  if (typeof document === 'undefined') return null;
  return document.getElementById(id);
}

export function createHud() {
  const cache = {};
  const last = {
    wanted: 0,
    money: 50,
    health: 100,
    weapon: 'Tinju',
    ammo: null,
    reserve: null,
    objective: '',
    dialog: '',
    district: '',
    banner: '',
    toast: '',
  };

  function get(id) {
    if (!(id in cache)) cache[id] = el(id);
    return cache[id];
  }

  function setText(id, text) {
    const node = get(id);
    if (node) node.textContent = text;
  }

  function show(id, visible) {
    const node = get(id);
    if (node && node.style) node.style.display = visible ? '' : 'none';
  }

  let bannerTimer = null;
  let toastTimer = null;

  const api = {
    get last() { return { ...last }; },
    get money() { return last.money; },
    get health() { return last.health; },
    get wanted() { return last.wanted; },
    get objective() { return last.objective; },
    get district() { return last.district; },

    setWanted(stars) {
      last.wanted = Math.max(0, Math.min(5, Math.round(Number(stars) || 0)));
      setText('hud-wanted', last.wanted === 0 ? 'BERSIH' : formatStars(last.wanted));
      return last.wanted;
    },

    setMoney(amount) {
      last.money = Math.round(Number(amount) || 0);
      setText('hud-money', formatMoney(last.money));
      return last.money;
    },

    setHealth(health) {
      last.health = Math.max(0, Math.round(Number(health) || 0));
      setText('hud-health', formatHealth(last.health));
      return last.health;
    },

    setWeapon(name, ammo, reserve) {
      last.weapon = String(name || 'Tinju');
      last.ammo = typeof ammo === 'number' ? ammo : null;
      last.reserve = typeof reserve === 'number' ? reserve : null;
      let text = last.weapon;
      if (last.ammo !== null && Number.isFinite(last.ammo)) {
        text += ` ${last.ammo}/${last.reserve ?? '—'}`;
      }
      setText('hud-weapon', text);
      return text;
    },

    setObjective(text) {
      last.objective = String(text || '');
      setText('hud-objective', last.objective);
      return last.objective;
    },

    setDialog(text) {
      last.dialog = String(text || '');
      setText('hud-dialog', last.dialog);
      return last.dialog;
    },

    setDistrict(name) {
      last.district = String(name || '');
      setText('hud-district', last.district);
      return last.district;
    },

    // Banner kuning besar di tengah layar (misalnya "FAJAR TERBIT").
    showBanner(text, ms = 3500) {
      last.banner = String(text || '');
      setText('hud-banner', last.banner);
      show('hud-banner', last.banner.length > 0);
      if (bannerTimer) clearTimeout(bannerTimer);
      if (last.banner.length > 0 && typeof setTimeout === 'function') {
        bannerTimer = setTimeout(() => {
          last.banner = '';
          show('hud-banner', false);
        }, ms);
      }
      return last.banner;
    },

    // Toast kecil bawah layar (misalnya "Semua misi selesai ...").
    showToast(text, ms = 4000) {
      last.toast = String(text || '');
      setText('hud-toast', last.toast);
      show('hud-toast', last.toast.length > 0);
      if (toastTimer) clearTimeout(toastTimer);
      if (last.toast.length > 0 && typeof setTimeout === 'function') {
        toastTimer = setTimeout(() => {
          last.toast = '';
          show('hud-toast', false);
        }, ms);
      }
      return last.toast;
    },

    // Minimap 190x190: titik pemain di tengah, polisi biru, musuh merah,
    // kendaraan abu-abu. Tanpa canvas di DOM, tidak melakukan apa-apa.
    drawMinimap(view = {}) {
      const canvas = get('minimap');
      if (!canvas || typeof canvas.getContext !== 'function') return false;
      const ctx2d = canvas.getContext('2d');
      if (!ctx2d) return false;
      const size = MINIMAP_SIZE;
      const range = view.range || MINIMAP_RANGE;
      const px = view.playerX ?? 0;
      const pz = view.playerZ ?? 0;
      const scale = size / 2 / range;
      const toMap = (x, z) => [size / 2 + (x - px) * scale, size / 2 + (z - pz) * scale];
      ctx2d.clearRect(0, 0, size, size);
      ctx2d.fillStyle = '#0f2a1e';
      ctx2d.fillRect(0, 0, size, size);
      ctx2d.strokeStyle = '#2d6a4f';
      ctx2d.strokeRect(1, 1, size - 2, size - 2);
      const dot = (x, z, color, r) => {
        const [mx, mz] = toMap(x, z);
        ctx2d.fillStyle = color;
        ctx2d.beginPath();
        ctx2d.arc(mx, mz, r, 0, Math.PI * 2);
        ctx2d.fill();
      };
      for (const v of view.vehicles || []) dot(v.x, v.z, '#9ca3af', 2.5);
      for (const e of view.enemies || []) dot(e.x, e.z, '#ef4444', 3);
      for (const o of view.police || []) dot(o.x, o.z, '#3b82f6', 3);
      dot(px, pz, '#f97316', 4);
      return true;
    },

    // Tampilkan menu (judul + pesan opsional) di #menu-screen.
    showMenu(title, message) {
      if (title) setText('menu-title', title);
      if (typeof message === 'string') setText('menu-message', message);
      show('menu-screen', true);
      return true;
    },

    hideMenu() {
      show('menu-screen', false);
      return true;
    },
  };

  return api;
}
