# ARUNIKA BAY

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/swaetczher/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/swaetczher/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

Game open-world 3D di kota fajar **Arunika Bay** — dibuat untuk kompetisi
[make.fun/bounty/gta6-01](https://make.fun/bounty/gta6-01). Bara Kelana, kurir
paling cepat di kota, mengambil satu paket terakhir sebelum matahari terbit —
tanpa tahu paket itu milik Rangga Samudra, pimpinan geng **Ombak Hitam**.

## Cara main

- **Jalan kaki / mengemudi:** W/S maju-mundur, A/D belok, Shift lari.
- **Masuk mobil:** tekan E di dekat mobil. Mobil terkunci dicuri dengan
  **menahan E** sampai progres penuh — hati-hati, panas buronan naik.
- **Bertarung:** Spasi menyerang (Tinju, lalu Pistol Rakitan setelah M3).
- **Jeda:** Esc / P. Progres tersimpan otomatis (localStorage).

## 5 misi

1. **M1 Kurir Fajar** — antar paket keliling kota sebelum matahari terbit.
2. **M2 Mobil Pertama** — curi Kancil M2 di parkiran Dermaga, serahkan ke Dimas.
3. **M3 Brankas Pelabuhan** — kalahkan 3 preman penjaga gudang, buka brankas.
4. **M4 Pelarian Pasar Terapung** — kabur dari kejaran polisi lewat kanal.
5. **M5 Fajar Terakhir** — hadapi Rangga Samudra; kota bebas saat fajar terbit.

Wanted level 0–5 bintang mengikuti panas perbuatanmu; polisi berpatroli,
mengejar, menyisir, lalu menangkap. Kota hidup: 14 mobil lalu lintas, 28
pejalan kaki, 10 mobil parkir (5 terkunci), laut teal di dermaga, dan
matahari terbit oranye di atas plaza.

## Menjalankan

```sh
node serve.ts
# buka http://127.0.0.1:8901/game/index.html
```

Atau langsung buka `game/index.html` di browser desktop (offline penuh,
tanpa network). Entri diserahkan dengan `main.ts` (Node 22, stdlib saja):

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

## Screenshot

- `1-cover-chase.jpg` — kejar-kejaran M4 (cover)
- `2-foot-lentera.jpg` — Bara jalan kaki di zebra cross (M1)
- `3-heist.jpg` — gudang kontainer Dermaga (M3)
- `4-vista.jpg` — vista fajar setelah semua misi selesai

## Teknologi

Three.js r187 (di-vendor sebagai `*.min.js` di `game/vendor/three/`),
ES modules murni, tanpa build step, tanpa aset unduhan. Kode game di
`game/src/` (dunia + gameplay), tes logika di
`game/src/gameplay/test-gameplay.mjs` (`node game/src/gameplay/test-gameplay.mjs`).

---

Dibuat oleh [@swaetczher](https://github.com/swaetczher) untuk
[make.fun](https://make.fun/bounty/gta6-01) — referral: `s8p0rqq6`.
Lisensi MIT, lihat `LICENSE`.

## Struktur repo

```text
main.ts                  entrypoint penyerahan (Node 22)
serve.ts                 server lokal port 8901
shots.json               daftar 4 screenshot + mode ?shot=
game/index.html          halaman game + import map three.js
game/src/main.js         bootstrap browser + staging screenshot
game/src/world/          kota, jalan, traffic, pejalan kaki, kamera
game/src/gameplay/       pemain, polisi, misi, wanted, combat, HUD, save
game/vendor/three/       three.js r187 (minified, *.min.js)
screenshots/             4 screenshot final 1280x720
```

Catatan jujur: game ini terinspirasi genre open-world kota (jalan kaki,
curi mobil, wanted level, misi cerita), tapi seluruh kode, nama tokoh,
nama tempat, dan aset visualnya dibuat sendiri dari nol untuk kompetisi
ini — bukan port, bukan klon, bukan aset dari game mana pun.
