// wanted.js — Wanted level Arunika Bay: panas 0–100 jadi bintang 1–5.
// Panas naik saat Bara mencuri mobil atau melukai orang; turun saat ia
// bersembunyi dari pandangan polisi. Bintang tinggi lebih lambat hilang.
export const HEAT_PER_STAR = 20;
export const MAX_HEAT = 100;

export function createWanted() {
  return { heat: 0, stars: 0, hiddenTime: 0 };
}

export function starsForHeat(heat) {
  if (heat <= 0) return 0;
  return Math.min(5, Math.ceil(heat / HEAT_PER_STAR));
}

export function addHeat(wanted, amount) {
  wanted.heat = Math.min(MAX_HEAT, wanted.heat + amount);
  wanted.stars = starsForHeat(wanted.heat);
  wanted.hiddenTime = 0;
  return wanted.stars;
}

export function heatForCrime(crime) {
  if (crime === 'stealCar') return 25;
  if (crime === 'hurtThug') return 15;
  if (crime === 'hurtPolice') return 30;
  if (crime === 'shoot') return 12;
  return 5;
}

// dt detik berlalu; seen = ada polisi yang melihat pemain saat ini.
// Sembunyi 6 detik berturut-turut mulai menurunkan panas.
export function updateWanted(wanted, dt, seen) {
  if (seen) {
    wanted.hiddenTime = 0;
    return wanted.stars;
  }
  wanted.hiddenTime += dt;
  if (wanted.hiddenTime < 6 || wanted.heat <= 0) return wanted.stars;
  // Bintang tinggi hilang lebih lambat: 1★ cepat, 5★ merayap.
  const rate = wanted.stars <= 1 ? 6 : wanted.stars === 2 ? 4 : wanted.stars === 3 ? 2.5 : 1.6;
  wanted.heat = Math.max(0, wanted.heat - rate * dt);
  const next = starsForHeat(wanted.heat);
  if (next < wanted.stars) wanted.hiddenTime = 0;
  wanted.stars = next;
  return wanted.stars;
}

export function wantedLabel(wanted) {
  if (wanted.stars <= 0) return 'BERSIH';
  return '★'.repeat(wanted.stars) + '☆'.repeat(5 - wanted.stars);
}

export function clearWanted(wanted) {
  wanted.heat = 0;
  wanted.stars = 0;
  wanted.hiddenTime = 0;
}
// --- akhir wanted.js (baris revisi ditambahkan lewat edit terpisah) ---
// Revisi terekam: ambang sembunyi 6 detik memberi pemain M2 kesempatan
// kabur dari 1 bintang tanpa harus jauh-jauh — cukup putus pandangan
// polisi di gang Kampung Lentera, lalu panas mulai turun.
export function isWanted(wanted) {
  return wanted.stars > 0;
}
