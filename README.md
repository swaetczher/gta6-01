# ARUNIKA BAY — Fajar Terbit

[![Kompetisi gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![Peringkat](https://make.fun/badge/gta6-01/swaetczher/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01)
[![Hadiah](https://make.fun/badge/gta6-01/swaetczher/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01)

Game aksi dunia terbuka di kota fajar **Arunika Bay**, dibuat untuk kompetisi
[gta6-01 di make.fun](https://make.fun/bounty/gta6-01). Kamu bermain sebagai
**Bara Kelana**, kurir fajar yang melawan geng **Ombak Hitam** pimpinan
**Rangga Samudra** — dari antar paket subuh, mencuri Kancil pertama,
membobol brankas pelabuhan, sampai pelarian terakhir lewat Pasar Terapung.

## Main

- **Gerak:** W/A/S/D atau panah — jalan kaki, tahan Shift untuk lari.
- **Aksi:** tahan **E** untuk mencuri mobil terkunci, **Spasi** untuk menyerang.
- **Senjata:** Tinju (gratis) dan Pistol Rakitan (magasin 12/48, isi ulang otomatis).
- **Buronan:** panas 0–100 menjadi 0–5 bintang; polisi patroli, mengejar,
  mencari, lalu menangkap bila terlalu dekat.
- **Simpan otomatis:** progres tersimpan tiap 15 detik di peramban.

## Lima Misi

1. **M1 Kurir Fajar** — antar paket terakhir sebelum matahari terbit.
2. **M2 Mobil Pertama** — curi Kancil M2 dari parkiran Distrik Niaga.
3. **M3 Brankas Pelabuhan** — kalahkan 3 preman penjaga gudang kontainer.
4. **M4 Pelarian Pasar Terapung** — kabur dari 4 mobil polisi dan helikopter.
5. **M5 Fajar Terakhir** — hadapi Rangga Samudra dan bebaskan Arunika Bay.

Total hadiah misi 2.400 — ditambah uang awal 50, Bara menutup cerita dengan 2.450.

## Teknologi

- **three.js r187** (vendored `*.min.js` di `game/vendor/three/`) — render 3D kota.
- **JavaScript murni + TypeScript stdlib** untuk entry dan server lokal.
- Tanpa dependensi runtime dan tanpa network saat bermain.

## Struktur Repo

- `game/index.html` — halaman game + import map three.js + HUD.
- `game/src/main.js` — bootstrap, loop, dan staging 4 screenshot.
- `game/src/world/` — kota, lalu lintas, pejalan kaki, kamera, cahaya, minimap.
- `game/src/gameplay/` — pemain, polisi, musuh, combat, misi, wanted, HUD,
  layar, save, dan adapter dunia (dengan `test-gameplay.mjs` mandiri).
- `screenshots/` — 4 gambar (cover, jalan kaki, heist, vista), 1280×720.
- `main.ts` — entrypoint pengiriman (bangun dossier).
- `shots.json` — daftar 4 shot (`?shot=cover|foot|heist|vista&seed=1`).
- `serve.ts` — server lokal `127.0.0.1:8901`.

## Menjalankan Lokal

```sh
node serve.ts
# buka 127.0.0.1:8901 di peramban
```

Tes gameplay mandiri (tanpa peramban):

```sh
node game/src/gameplay/test-gameplay.mjs
```

Bangun dossier pengiriman:

```sh
MAKEFUN_OUTPUT_DIR=out node main.ts
```

## Orisinalitas

Semua kode game, peta kota, dialog, dan staging ditulis sendiri untuk
kompetisi ini. Aset tiga dimensi dibuat prosedural dari primitif three.js;
tidak ada aset unduhan, tidak ada cuplikan film atau musik berhak cipta.

---

Dibuat oleh [@swaetczher](https://make.fun/bounty/gta6-01) untuk kompetisi
gta6-01. Referral Make Fun: `s8p0rqq6`.
