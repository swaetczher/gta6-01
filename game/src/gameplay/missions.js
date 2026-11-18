// missions.js — 5 misi cerita ARUNIKA BAY (data-driven).
// Bara Kelana, mantan sopir truk pelabuhan yang dipecat karena menolak
// mengangkut selundupan, kembali saat adiknya Sinta ditahan sindikat
// "Ombak Hitam" pimpinan Rangga Samudra. Mesin misi generik: tiap misi
// adalah daftar objektif { type, x, z, label, ... } yang diselesaikan
// berurutan; dialog + hadiah + wanted diambil dari data, bukan kode.
// Koordinat memakai peta kota: jalan di -88, -44, 0, 44, 88 (jarak 44 m).
export const MISSIONS = [
  {
    id: 'M1',
    title: 'Kurir Fajar',
    intro: 'Bara: "Satu paket terakhir sebelum matahari terbit. Antar lewat tiga distrik — jangan sampai telat."',
    outro: 'Paket sampai. Sinta menelepon dari gudang: "Bang... mereka menahan aku di pelabuhan."',
    reward: 150,
    wantedOnStart: 0,
    objectives: [
      { type: 'goto', x: -22, z: 22, label: 'Ambil paket di Alun-Alun Arunika' },
      { type: 'goto', x: 22, z: 0, label: 'Antar paket ke tepi Pasar Terapung (kanal tidak bisa diseberangi)' },
      { type: 'goto', x: 66, z: -22, label: 'Antar paket ke RS Arunika' },
      { type: 'goto', x: -22, z: -66, label: 'Kembali ke Kampung Lentera' },
    ],
  },
  {
    id: 'M2',
    title: 'Mobil Pertama',
    intro: 'Bara: "Aku butuh mobil. Sedan Kancil di parkiran Dermaga itu... pinjam dulu. Tahan E untuk membobolnya."',
    outro: 'Kancil sampai di bengkel. Mekanik Kampung Lentera mengangguk: "Mesin bagus. Kau serius mau melawan Ombak Hitam?"',
    reward: 250,
    wantedOnStart: 0,
    stealTarget: { model: 'Kancil', x: -88, z: 44 },
    objectives: [
      { type: 'steal', carModel: 'Kancil', x: -88, z: 44, label: 'Curi sedan "Kancil" di parkiran Dermaga (tahan E)' },
      { type: 'deliver', x: -22, z: -66, label: 'Antar Kancil ke bengkel Kampung Lentera' },
    ],
  },
  {
    id: 'M3',
    title: 'Brankas Pelabuhan',
    intro: 'Rangga menyimpan uang tebusan di brankas gudang kontainer. Masuk diam-diam... atau tembak-tembakan. Pilihanmu.',
    outro: 'Brankas terbuka: uang tebusan Sinta — dan buku catatan suap Ombak Hitam. Bukti ini berharga.',
    reward: 500,
    wantedOnStart: 0,
    wantedOnAlarm: 60,
    thugs: [
      { id: 'preman-gudang-1', x: -60, z: 78, health: 60 },
      { id: 'preman-gudang-2', x: -72, z: 78, health: 60 },
      { id: 'preman-gudang-3', x: -66, z: 84, health: 60 },
    ],
    objectives: [
      { type: 'goto', x: -66, z: 78, label: 'Masuk ke gudang kontainer Dermaga' },
      { type: 'eliminate', label: 'Kalahkan preman penjaga gudang (3 orang)' },
      { type: 'goto', x: -66, z: 70, label: 'Buka brankas di dalam gudang' },
      { type: 'goto', x: 0, z: 44, label: 'Kabur ke persimpangan Kampung Lentera' },
    ],
  },
  {
    id: 'M4',
    title: 'Pelarian Pasar Terapung',
    intro: 'Sirene di mana-mana. "Empat mobil polisi dan helikopter! Lewat kanal Pasar Terapung — mereka tidak bisa masuk gang perahu!"',
    outro: 'Barikade terakhir hancur. Bara lolos ke Kampung Lentera saat fajar mulai naik. Tinggal satu tempat: Bukit Mercusuar.',
    reward: 650,
    wantedOnStart: 80,
    objectives: [
      { type: 'goto', x: 22, z: 0, label: 'Tiba di tepi kanal Pasar Terapung (air diblokir — jangan masuk kanal)' },
      { type: 'goto', x: 44, z: 44, label: 'Hancurkan barikade pertama (tabrak dengan mobil)' },
      { type: 'goto', x: 88, z: 44, label: 'Hancurkan barikade kedua di ujung kanal' },
      { type: 'evade', label: 'Kabur sampai wanted hilang — sembunyi dari polisi' },
    ],
  },
  {
    id: 'M5',
    title: 'Fajar Terakhir',
    intro: 'Rangga Samudra: "Kau datang juga, sopir. Adikmu di dalam menara." Bara: "Sinta... aku datang. Ini berakhir sekarang."',
    outro: 'Rangga jatuh. Sinta bebas. Fajar terbit di atas Arunika Bay — kota ini akhirnya bernapas lagi.',
    reward: 800,
    wantedOnStart: 100,
    thugs: [
      { id: 'preman-menara-1', x: -58, z: -66, health: 60 },
      { id: 'preman-menara-2', x: -66, z: -58, health: 80 },
      { id: 'rangga-samudra', x: -66, z: -66, health: 150, boss: true },
    ],
    objectives: [
      { type: 'goto', x: -44, z: -88, label: 'Naik ke Bukit Mercusuar' },
      { type: 'eliminate', label: 'Kalahkan penjaga markas Ombak Hitam' },
      { type: 'eliminate', boss: true, label: 'Hadapi Rangga Samudra' },
      { type: 'goto', x: -66, z: -66, label: 'Bebaskan Sinta di kaki mercusuar' },
    ],
  },
];

export const MISSION_COUNT = MISSIONS.length;
export const OBJECTIVE_RADIUS = 4;

export function createMissionState() {
  return {
    currentId: null, // id misi aktif, atau null
    objectiveIndex: 0,
    completed: [], // id misi yang sudah selesai
    started: false,
    thugsSpawned: false,
  };
}

export function getMission(id) {
  return MISSIONS.find((m) => m.id === id) || null;
}

export function nextMissionId(completed) {
  const next = MISSIONS.find((m) => !completed.includes(m.id));
  return next ? next.id : null;
}

export function startMission(missionState, id) {
  const mission = getMission(id);
  if (!mission) return null;
  missionState.currentId = id;
  missionState.objectiveIndex = 0;
  missionState.started = true;
  missionState.thugsSpawned = false;
  return mission;
}

export function currentObjective(missionState) {
  const mission = getMission(missionState.currentId);
  if (!mission) return null;
  return mission.objectives[missionState.objectiveIndex] || null;
}

export function missionProgress(missionState) {
  const mission = getMission(missionState.currentId);
  if (!mission) return { done: 0, total: 0 };
  return { done: missionState.objectiveIndex, total: mission.objectives.length };
}

// Satu langkah mesin misi per frame. Mengembalikan event bila ada.
// ctx: { player, world, thugs, wanted, events, addHeat }
export function updateMission(missionState, ctx) {
  const mission = getMission(missionState.currentId);
  if (!mission || !missionState.started) return null;
  const obj = currentObjective(missionState);
  if (!obj) return null;
  const { player } = ctx;

  if (obj.type === 'goto' || obj.type === 'deliver') {
    const d = Math.hypot(player.x - obj.x, player.z - obj.z);
    if (obj.type === 'deliver' && !player.inCar) {
      // Antar mobil: harus tiba dengan mobil.
      if (d < OBJECTIVE_RADIUS) {
        ctx.events.push({ type: 'hint', text: 'Naik mobil dulu — paket ini diantar dengan kendaraan.' });
        return null;
      }
    }
    if (d < OBJECTIVE_RADIUS) return advanceObjective(missionState, ctx, mission);
  }
  if (obj.type === 'steal') {
    const stolen = ctx.world.cars.some((c) => c.model === obj.carModel && c.stolen);
    if (stolen) return advanceObjective(missionState, ctx, mission);
  }
  if (obj.type === 'eliminate') {
    // Objektif biasa menghitung preman non-boss; objektif boss hanya
    // menghitung Rangga Samudra — kalau tidak dipisah, objektif pertama
    // tidak pernah selesai selama boss masih hidup.
    const alive = obj.boss
      ? ctx.thugs.filter((t) => t.alive && t.boss).length
      : ctx.thugs.filter((t) => t.alive && !t.boss).length;
    if (ctx.thugs.length > 0 && alive === 0) return advanceObjective(missionState, ctx, mission);
  }
  if (obj.type === 'evade') {
    if (ctx.wanted.stars === 0) return advanceObjective(missionState, ctx, mission);
  }
  return null;
}

function advanceObjective(missionState, ctx, mission) {
  missionState.objectiveIndex += 1;
  ctx.events.push({ type: 'objectiveDone', missionId: mission.id, index: missionState.objectiveIndex });
  if (missionState.objectiveIndex >= mission.objectives.length) {
    return completeMission(missionState, ctx, mission);
  }
  return { type: 'objectiveAdvanced', missionId: mission.id };
}

function completeMission(missionState, ctx, mission) {
  missionState.completed.push(mission.id);
  missionState.currentId = null;
  missionState.started = false;
  missionState.objectiveIndex = 0;
  ctx.player.money += mission.reward;
  ctx.events.push({ type: 'missionComplete', missionId: mission.id, reward: mission.reward });
  return { type: 'missionComplete', missionId: mission.id, reward: mission.reward };
}

export function missionObjectiveLabel(missionState) {
  const obj = currentObjective(missionState);
  if (!obj) return 'Tidak ada misi aktif — tekan Enter untuk misi berikutnya.';
  const mission = getMission(missionState.currentId);
  return `${mission.id} ${mission.title}: ${obj.label}`;
}
// --- akhir missions.js (baris revisi ditambahkan lewat edit terpisah) ---
// Revisi terekam: M4 "Pelarian Pasar Terapung" memakai objektif evade
// yang hanya selesai bila wanted benar-benar 0 — pemain tidak bisa
// curang dengan berlari lurus ke marker; harus putus pandangan polisi.
export function totalRewardAvailable() {
  return MISSIONS.reduce((sum, m) => sum + m.reward, 0);
}
