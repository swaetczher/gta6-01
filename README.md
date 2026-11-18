# ARUNIKA BAY

[![gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/c/gta6-01)
[![rank](https://make.fun/badge/swaetczher/gta6-01/rank.svg)](https://make.fun/c/gta6-01)
[![reward](https://make.fun/badge/swaetczher/gta6-01/reward.svg)](https://make.fun/c/gta6-01)

**ARUNIKA BAY** — open-world crime di kota pelabuhan Indonesia saat fajar. Entri untuk kompetisi [gta6-01 di make.fun](https://make.fun/c/gta6-01).

Bara Kelana, mantan sopir truk pelabuhan yang dipecat karena menolak mengangkut selundupan, kembali ke Arunika saat adiknya, Sinta, ditahan sindikat **Ombak Hitam** pimpinan Rangga Samudra. Dalam satu malam menjelang fajar, Bara menjalankan 5 pekerjaan — kurir, curi mobil, heist gudang, pelarian dari Polair, sampai penyerbuan markas di Bukit Mercusuar — sebelum matahari terbit.

## Main

```sh
node serve.ts
# buka http://localhost:8080
```

WASD jalan · Shift lari · Spasi lompat · E masuk/keluar mobil (tahan E untuk mencuri mobil terkunci) · F tinju · Klik tembak · R isi ulang · 1/2 ganti senjata · Enter mulai misi · P jeda.

## Fitur

- Kota prosedural ARUNIKA BAY (5 distrik: Dermaga, Pasar Terapung, Kampung Lentera, Bukit Mercusuar, Distrik Niaga) — three.js, semua aset prosedural, tanpa network request.
- Jalan kaki + mengemudi (sedan **Kancil**, pikap **Banteng**, taksi **Lentera Cab**, mobil polisi **Polair Arunika**) + traffic AI + pejalan kaki.
- Curi mobil (tahan E), wanted level bintang 1–5, polisi jalan kaki + mobil patroli + helikopter di 4★ ke atas, sistem sembunyi sampai wanted hilang.
- Combat: tinju jarak dekat + pistol rakitan (magazin 12, reload).
- 5 misi cerita data-driven + dialog + hadiah $150–$800, autosave tiap misi selesai (localStorage).
- HUD lengkap (health, uang, bintang wanted, ammo, objektif + progres misi, dialog, banner) + minimap 2D top-down (jalan 44 m, gedung, kanal, landmark, mobil, target misi, polisi).
- Layar start / pause / tertangkap / selesai; mode screenshot `?shot=start|play|cover|heist|end&seed=1` (deterministik).

## Struktur source

- `game/src/main.js` — entry browser: renderer, kamera third-person, loop fixed-step 60 Hz, mode screenshot.
- `game/src/world/` — dunia + render + traffic + pejalan kaki + minimap data.
- `game/src/gameplay/` — satu sistem satu file: `player.js`, `combat.js`, `wanted.js`, `police.js`, `enemies.js`, `missions.js`, `hud.js`, `screens.js`, `save.js`, `world-adapter.js`, `index.js` (fasad).
- `game/vendor/three/` — three.js r187 (vendored lokal).
- `screenshots/` — 4 screenshot render asli game (cover = kejar-kejaran polisi).
- `main.ts` — program penyerahan (Node 22): menyalin `game/` + `screenshots/` dan menulis `dossier.json`.

## Lisensi

MIT — lihat [LICENSE](LICENSE). Game orisinal total: tanpa nama, logo, karakter, map, art, atau musik dari game komersial mana pun.
<!-- akhir README.md (baris revisi ditambahkan lewat edit terpisah) -->
<!-- Revisi terekam: badge rank/reward memakai path pemilik swaetczher
     (bukan placeholder {owner}) sesuai syarat repo make.fun. -->

