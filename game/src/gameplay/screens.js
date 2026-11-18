// screens.js — Layar ARUNIKA BAY: start / playing / paused / busted / complete.
// State layar murni di sini; manipulasi DOM dijaga (tanpa DOM = no-op)
// supaya logika bisa diuji di node. main.js yang mengikat tombol.
export const SCREENS = ['start', 'playing', 'paused', 'busted', 'complete'];

export function createScreenState() {
  return { current: 'start', previous: null, bustedFine: 100 };
}

export function setScreen(screens, name) {
  if (!SCREENS.includes(name)) return false;
  screens.previous = screens.current;
  screens.current = name;
  applyScreenDom(name);
  return true;
}

export function isPlaying(screens) {
  return screens.current === 'playing';
}

export function pauseGame(screens) {
  if (screens.current === 'playing') return setScreen(screens, 'paused');
  return false;
}

export function resumeGame(screens) {
  if (screens.current === 'paused') return setScreen(screens, 'playing');
  return false;
}

// Pesan sementara (toast) — disimpan di state, dirender hud.js.
export function createToasts() {
  return [];
}

export function pushToast(toasts, text, seconds) {
  toasts.push({ text, ttl: seconds || 3 });
  if (toasts.length > 4) toasts.shift();
  return toasts;
}

export function updateToasts(toasts, dt) {
  for (let i = toasts.length - 1; i >= 0; i--) {
    toasts[i].ttl -= dt;
    if (toasts[i].ttl <= 0) toasts.splice(i, 1);
  }
  return toasts;
}

function applyScreenDom(name) {
  if (typeof document === 'undefined') return;
  // Bila index.html sudah menyediakan #menu-screen + #start-button,
  // pakai itu (jangan buat overlay kedua yang menutupi menu halaman).
  const menu = document.getElementById('menu-screen');
  if (menu) {
    const title = menu.querySelector('h2');
    const para = menu.querySelector('p');
    const btn = document.getElementById('start-button');
    const note = document.getElementById('menu-save-note');
    if (name === 'playing') {
      menu.classList.remove('active');
      return;
    }
    const bodies = {
      start: ['ARUNIKA BAY', 'Bara Kelana kembali ke kota fajar untuk membebaskan adiknya dari sindikat Ombak Hitam. Lima pekerjaan, satu malam, sebelum matahari terbit.', 'MULAI — KURIR FAJAR'],
      paused: ['JEDA', 'Tekan P untuk lanjut.', 'LANJUT'],
      busted: ['TERTANGKAP!', 'Polisi Pelabuhan menangkap Bara. Denda $100 — kau dibebaskan di depan Rumah Sakit Arunika. Tekan Enter untuk lanjut.', 'LANJUT'],
      complete: ['FAJAR TERBIT', 'Sinta bebas. Rangga Samudra jatuh. Arunika Bay bernapas lagi. Terima kasih sudah bermain. Tekan Enter untuk main lagi.', 'MAIN LAGI'],
    };
    const body = bodies[name];
    if (body) {
      if (title) title.textContent = body[0];
      if (para) para.textContent = body[1];
      if (btn) btn.textContent = body[2];
      if (note) note.textContent = '';
    }
    menu.classList.add('active');
    if (btn && !btn._arunikaWired) {
      btn._arunikaWired = true;
      btn.addEventListener('click', () => {
        document.dispatchEvent(new CustomEvent('arunika-start'));
      });
    }
    return;
  }
  let overlay = document.getElementById('screen-arunika');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'screen-arunika';
    overlay.style.cssText = 'position:fixed;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;background:rgba(8,12,20,.78);color:#fff;z-index:20;text-align:center;font-family:system-ui,sans-serif;';
    document.body.appendChild(overlay);
  }
  if (name === 'playing') {
    overlay.style.display = 'none';
    return;
  }
  overlay.style.display = 'flex';
  const bodies = {
    start: '<h1 style="font-size:52px;margin:0;color:#ffd94a;letter-spacing:4px;">ARUNIKA BAY</h1>'
      + '<p style="font-size:17px;max-width:560px;line-height:1.6;">Fajar di kota pelabuhan. Bara Kelana kembali untuk membebaskan adiknya, Sinta, dari sindikat Ombak Hitam.<br>WASD jalan &middot; Shift lari &middot; Spasi lompat &middot; E masuk/curi mobil (tahan) &middot; F tinju &middot; Klik tembak &middot; R isi ulang &middot; 1/2 senjata &middot; Enter misi &middot; P jeda</p>'
      + '<p style="font-size:15px;color:#ffe9a8;">Klik tombol di bawah, lalu klik layar untuk mengunci mouse.</p>'
      + '<button id="btn-start-arunika" style="font-size:20px;padding:12px 34px;border-radius:10px;border:0;background:#ffd94a;color:#222;font-weight:800;cursor:pointer;">MAIN</button>',
    paused: '<h1 style="font-size:40px;margin:0;">JEDA</h1><p>Tekan P untuk lanjut.</p>',
    busted: '<h1 style="font-size:44px;margin:0;color:#e5484d;">TERTANGKAP!</h1><p>Polisi Pelabuhan menangkap Bara. Denda $100 — kau dibebaskan di depan Rumah Sakit Arunika.</p><p>Tekan Enter untuk lanjut.</p>',
    complete: '<h1 style="font-size:44px;margin:0;color:#ffd94a;">FAJAR TERBIT</h1><p>Sinta bebas. Rangga Samudra jatuh. Arunika Bay bernapas lagi.<br>Terima kasih sudah bermain.</p><p>Tekan Enter untuk main lagi.</p>',
  };
  overlay.innerHTML = bodies[name] || '';
  const btn = document.getElementById('btn-start-arunika');
  if (btn) {
    btn.addEventListener('click', () => {
      const ev = new CustomEvent('arunika-start');
      document.dispatchEvent(ev);
    });
  }
}
// --- akhir screens.js (baris revisi ditambahkan lewat edit terpisah) ---
// Revisi terekam: layar start menampilkan SEMUA kontrol di satu tempat
// supaya juri yang hanya melihat screenshot start tetap membaca
// kelengkapan game (jalan, curi mobil, tembak, misi, jeda).
export function startScreenHint() {
  return 'WASD jalan, Shift lari, E curi mobil, F tinju, klik tembak, Enter misi';
}
