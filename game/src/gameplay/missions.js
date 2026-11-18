// missions.js — Lima misi cerita Arunika Bay.
// Tiap misi punya 4 langkah. Menyelesaikan satu langkah memberi petunjuk
// langkah berikut; menyelesaikan langkah keempat memberi hadiah uang dan
// membuka misi berikutnya. Total hadiah 2.400; ditambah uang awal 50,
// Bara mengakhiri permainan dengan 2.450 — angka yang tampil di vista.

export const MISSIONS = [
  {
    id: 'M1',
    title: 'Kurir Fajar',
    reward: 200,
    steps: [
      'Ambil paket di Alun-Alun Arunika',
      'Antar paket ke warung Kampung Lentera',
      'Ambil paket kedua di dermaga kecil',
      'Serahkan paket ke penerima di plaza',
    ],
  },
  {
    id: 'M2',
    title: 'Mobil Pertama',
    reward: 300,
    steps: [
      'Cari Kancil curian di parkiran Niaga',
      'Curi Kancil dengan menahan E',
      'Bawa Kancil ke bengkel pinggir kota',
      'Serahkan kunci ke pemilik bengkel',
    ],
  },
  {
    id: 'M3',
    title: 'Brankas Pelabuhan',
    reward: 800,
    steps: [
      'Datangi gudang kontainer Dermaga Arunika',
      'Kalahkan preman penjaga gudang (3 orang)',
      'Buka brankas di dalam gudang',
      'Bawa uang tebusan keluar dari dermaga',
    ],
  },
  {
    id: 'M4',
    title: 'Pelarian Pasar Terapung',
    reward: 400,
    steps: [
      'Kabur dari kejaran polisi di Distrik Niaga',
      'Lewat kanal Pasar Terapung',
      'Hindari helikopter polisi',
      'Sampai ke tempat aman di ujung kanal',
    ],
  },
  {
    id: 'M5',
    title: 'Fajar Terakhir',
    reward: 700,
    steps: [
      'Temui Rangga Samudra di markas Ombak Hitam',
      'Kalahkan anak buah Rangga',
      'Hadapi Rangga Samudra',
      'Bebaskan Arunika Bay selamanya',
    ],
  },
];

export const TOTAL_REWARD = MISSIONS.reduce((sum, m) => sum + m.reward, 0);

export function createMissions(opts = {}) {
  const onEvent = typeof opts.onEvent === 'function' ? opts.onEvent : null;
  let current = 0;
  let step = 0;
  const done = MISSIONS.map(() => false);

  function emit(type, payload) {
    if (onEvent) onEvent({ type, ...payload });
  }

  const api = {
    list: MISSIONS,
    get current() { return current; },
    get step() { return step; },
    get currentMission() { return MISSIONS[current]; },
    get allDone() { return done.every(Boolean); },
    get earned() {
      return MISSIONS.reduce((sum, m, i) => sum + (done[i] ? m.reward : 0), 0);
    },

    setCurrent(index) {
      const i = Math.max(0, Math.min(MISSIONS.length - 1, Math.round(index) || 0));
      current = i;
      step = 0;
      return current;
    },

    setStep(n) {
      const mission = MISSIONS[current];
      step = Math.max(0, Math.min(mission.steps.length - 1, Math.round(n) || 0));
      return step;
    },

    // Teks objektif untuk HUD: "M3 Brankas Pelabuhan (2/4): Kalahkan ...".
    objectiveText() {
      const mission = MISSIONS[current];
      const stepText = mission.steps[step] || mission.steps[0];
      return `${mission.id} ${mission.title} (${step + 1}/${mission.steps.length}): ${stepText}`;
    },

    // Maju satu langkah. Langkah terakhir menutup misi + memberi hadiah.
    advanceStep() {
      const mission = MISSIONS[current];
      if (step < mission.steps.length - 1) {
        step += 1;
        emit('mission-step', { mission: current, step, text: api.objectiveText() });
        return { finished: false, step };
      }
      done[current] = true;
      emit('mission-complete', { mission: current, reward: mission.reward, title: mission.title });
      if (current < MISSIONS.length - 1) {
        current += 1;
        step = 0;
        emit('mission-start', { mission: current, title: MISSIONS[current].title });
      } else {
        emit('complete', { earned: api.earned });
      }
      return { finished: true, step, reward: mission.reward };
    },

    // Tandai misi tertentu selesai dari luar (misalnya lewat save/load).
    markDone(index) {
      const i = Math.max(0, Math.min(MISSIONS.length - 1, Math.round(index) || 0));
      done[i] = true;
      return done[i];
    },

    isDone(index) {
      return Boolean(done[index]);
    },

    // Apakah langkah ini langkah terakhir misi berjalan?
    get isLastStep() {
      return step >= MISSIONS[current].steps.length - 1;
    },

    // Kembalikan state ringkas untuk save game.
    snapshot() {
      return { current, step, done: [...done] };
    },

    restore(data) {
      if (!data || typeof data !== 'object') return { current, step };
      current = Math.max(0, Math.min(MISSIONS.length - 1, Math.round(data.current) || 0));
      step = Math.max(0, Math.min(MISSIONS[current].steps.length - 1, Math.round(data.step) || 0));
      if (Array.isArray(data.done)) {
        data.done.forEach((v, i) => { if (i < done.length) done[i] = Boolean(v); });
      }
      return { current, step };
    },

    reset() {
      current = 0;
      step = 0;
      done.fill(false);
      return { current, step };
    },
  };

  return api;
}
