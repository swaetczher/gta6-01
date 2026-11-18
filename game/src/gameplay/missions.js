// missions.js — 5 misi + cerita ARUNIKA BAY.
//
// Cerita: Bara Kelana, kurir fajar di kota Arunika Bay, berhadapan dengan
// geng "Ombak Hitam" pimpinan Rangga Samudra. Lima misi berurutan, tiap misi
// 4 langkah, tiap misi selesai memberi hadiah uang:
//
//   M1 Kurir Fajar              +200  — antar paket sebelum matahari terbit.
//   M2 Mobil Pertama            +300  — curi Kancil M2, serahkan ke Dimas.
//   M3 Brankas Pelabuhan        +800  — kalahkan 3 preman, buka brankas.
//   M4 Pelarian Pasar Terapung  +400  — kabur dari kejaran polisi.
//   M5 Fajar Terakhir           +700  — hadapi Rangga; kota bebas.
//
// Total hadiah 2.400; ditambah uang awal 50 = 2.450 di layar akhir — angka
// yang sama dengan yang tampil di shot vista.
//
// Modul ini hanya data + mesin langkah. Syarat tiap langkah (posisi,
// musuh tumbang, mobil dicuri) dicek oleh gameplay/index.js, yang memanggil
// `advanceStep()` saat syarat terpenuhi.

export const STORY = {
  hero: 'Bara Kelana',
  gang: 'Ombak Hitam',
  villain: 'Rangga Samudra',
  friend: 'Dimas',
  city: 'Arunika Bay',
  intro:
    'Fajar belum terbit di Arunika Bay. Bara Kelana, kurir paling cepat di ' +
    'kota, mengambil paket terakhirnya — tanpa tahu paket itu milik Rangga ' +
    'Samudra, pimpinan geng Ombak Hitam.',
};

/** Daftar misi (data murni — jangan diubah urutannya). */
export const MISSIONS = [
  {
    id: 'M1',
    title: 'Kurir Fajar',
    reward: 200,
    intro: 'Satu paket terakhir sebelum matahari terbit.',
    steps: [
      'Ambil paket di Alun-Alun Arunika',
      'Antar paket ke Kampung Lentera',
      'Antar paket ke Dermaga Arunika',
      'Kembali ke Alun-Alun Arunika',
    ],
  },
  {
    id: 'M2',
    title: 'Mobil Pertama',
    reward: 300,
    intro: 'Dimas butuh mobil. Parkiran Dermaga menyimpan Kancil M2 curian.',
    steps: [
      'Cari Kancil M2 di parkiran Dermaga',
      'Curi Kancil M2 (tahan E)',
      'Bawa Kancil ke Kampung Lentera',
      'Serahkan Kancil ke Dimas',
    ],
  },
  {
    id: 'M3',
    title: 'Brankas Pelabuhan',
    reward: 800,
    intro: 'Rangga menyimpan uang tebusan di brankas gudang kontainer.',
    steps: [
      'Pergi ke gudang kontainer Dermaga',
      'Kalahkan preman penjaga gudang (3 orang)',
      'Buka brankas gudang',
      'Ambil uang tebusan',
    ],
  },
  {
    id: 'M4',
    title: 'Pelarian Pasar Terapung',
    reward: 400,
    intro: 'Empat mobil polisi dan helikopter! Lewat kanal Pasar Terapung!',
    steps: [
      'Kabur dari kejaran polisi',
      'Lewat kanal Pasar Terapung',
      'Hindari helikopter polisi',
      'Sampai di tempat aman',
    ],
  },
  {
    id: 'M5',
    title: 'Fajar Terakhir',
    reward: 700,
    intro: 'Saatnya menghadapi Rangga Samudra di markas Ombak Hitam.',
    steps: [
      'Temui Rangga Samudra di markas Ombak Hitam',
      'Kalahkan anak buah Rangga',
      'Hadapi Rangga Samudra',
      'Arunika Bay bebas saat fajar terbit',
    ],
  },
];

/** Total hadiah semua misi. */
export const TOTAL_REWARD = MISSIONS.reduce((sum, m) => sum + m.reward, 0);

/** Cari misi berdasarkan id ('M1'..'M5'), atau null. */
export function missionById(id) {
  return MISSIONS.find((m) => m.id === id) || null;
}

/**
 * Mesin misi: menyimpan misi aktif + langkah aktif, memajukan langkah,
 * dan memberi hadiah saat misi selesai.
 *
 * @param {(event:object)=>void} [onEvent] dipanggil saat langkah/misi
 *   selesai (`mission-step`, `mission-complete`)
 */
export function createMissions(onEvent) {
  const emit = typeof onEvent === 'function' ? onEvent : null;
  let currentIndex = 0;
  let step = 0;
  let completed = 0;
  let earned = 0;

  const api = {
    /** Daftar misi (data statis). */
    list: MISSIONS,
    /** Indeks misi aktif (0–4). */
    get currentIndex() {
      return currentIndex;
    },
    /** Misi aktif (atau null bila semua selesai). */
    get current() {
      return MISSIONS[currentIndex] || null;
    },
    /** Langkah aktif dalam misi (0–3). */
    get step() {
      return step;
    },
    /** Jumlah misi yang sudah selesai. */
    get completed() {
      return completed;
    },
    /** Total uang hadiah yang sudah dikumpulkan dari misi. */
    get earned() {
      return earned;
    },
    /** Apakah semua misi selesai. */
    get isComplete() {
      return currentIndex >= MISSIONS.length;
    },

    /** Teks objektif HUD: "M1 Kurir Fajar (1/4): Ambil paket ..." */
    objectiveText() {
      const mission = MISSIONS[currentIndex];
      if (!mission) return 'Semua misi selesai — Arunika Bay bebas!';
      const stepText = mission.steps[Math.min(step, mission.steps.length - 1)];
      return `${mission.id} ${mission.title} (${step + 1}/${mission.steps.length}): ${stepText}`;
    },

    /** Dialog intro misi aktif. */
    introText() {
      const mission = MISSIONS[currentIndex];
      return mission ? mission.intro : 'Semua misi selesai — Arunika Bay bebas!';
    },

    /** Lompat ke misi tertentu (dipakai staging + save). */
    setCurrent(index) {
      const i = Math.max(0, Math.min(MISSIONS.length, Math.floor(index) || 0));
      currentIndex = i;
      step = 0;
      return this.current;
    },

    /** Lompat ke langkah tertentu dalam misi aktif. */
    setStep(n) {
      const mission = MISSIONS[currentIndex];
      if (!mission) return step;
      step = Math.max(0, Math.min(mission.steps.length - 1, Math.floor(n) || 0));
      return step;
    },

    /**
     * Majukan satu langkah. Bila langkah terakhir misi selesai, misi
     * ditutup (hadiah dikembalikan) dan misi berikutnya dimulai.
     * @returns {{mission:object|null, reward:number, finished:boolean}}
     */
    advanceStep() {
      const mission = MISSIONS[currentIndex];
      if (!mission) return { mission: null, reward: 0, finished: true };
      step++;
      if (step < mission.steps.length) {
        if (emit) {
          emit({ type: 'mission-step', mission: mission.id, step });
        }
        return { mission, reward: 0, finished: false };
      }
      // Misi selesai: hadiah + lanjut misi berikut.
      const reward = mission.reward;
      earned += reward;
      completed++;
      currentIndex++;
      step = 0;
      if (emit) {
        emit({ type: 'mission-complete', mission: mission.id, reward });
      }
      return { mission, reward, finished: currentIndex >= MISSIONS.length };
    },

    /** Cuplikan untuk save game. */
    snapshot() {
      return { currentIndex, step, completed, earned };
    },

    /** Pulihkan dari save game. */
    restore(data) {
      if (!data) return;
      if (typeof data.currentIndex === 'number') {
        currentIndex = Math.max(0, Math.min(MISSIONS.length, Math.floor(data.currentIndex)));
      }
      if (typeof data.step === 'number') {
        const mission = MISSIONS[currentIndex];
        step = mission
          ? Math.max(0, Math.min(mission.steps.length - 1, Math.floor(data.step)))
          : 0;
      }
      if (typeof data.completed === 'number') completed = Math.max(0, Math.floor(data.completed));
      if (typeof data.earned === 'number') earned = Math.max(0, Math.floor(data.earned));
    },
  };
  return api;
}
