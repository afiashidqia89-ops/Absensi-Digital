# 🎮 SUPER BIMO — Platformer Klasik untuk Android & Web

**Super Bimo** adalah game platformer 2D bergaya retro: lari, lompat, hancurkan
musuh, kumpulkan koin, pukul blok `?`, dan capai bendera di ujung level!
Dengan alur cerita klasik: **Raja Gorgo menculik Putri Rara**, dan hanya Bimo
yang bisa menembus 3 dunia untuk menyelamatkannya.

> 100% aset original — semua gambar (pixel-art), suara, dan musik dibuat secara
> prosedural di dalam kode. Tidak ada file gambar/audio eksternal dan tidak ada
> aset dari game komersial mana pun.

---

## ✨ Fitur

- 3 dunia (DUNIA 1-1, 1-2, 1-3) dengan tema siang / senja / malam
- Fisika platformer klasik: lompatan variabel (tahan tombol = lebih tinggi),
  coyote time, jump buffer
- 2 jenis musuh: **Gloob** si lendir (bisa diinjak) dan **Duro** si berduri
  (harus dihindari)
- Blok `?` berisi koin, bata yang bisa dipecahkan (saat besar), buah energi
  **Berry** untuk menjadi Bimo Besar
- Koin, skor, nyawa, batas waktu, rekor tersimpan otomatis
- Musik chiptune + efek suara (Web Audio API)
- Kontrol keyboard **dan** tombol sentuh untuk Android
- Layar judul, kartu dunia, jeda, game over, dan ending menyelamatkan Putri Rara

---

## 🕹️ Kontrol

| Aksi | Keyboard | Sentuh (Android) |
| --- | --- | --- |
| Gerak kiri/kanan | `A`/`D` atau `←`/`→` | Tombol ◀ ▶ |
| Lompat | `Spasi`, `W`, atau `↑` | Tombol ▲ |
| Jeda | `P` / `Esc` | — |
| Suara on/off | `M` | Tombol ♪ |
| Layar penuh | — | Tombol ⤢ |

---

## 📁 Struktur Proyek

```
super-bimo/
├── www/                      # Game (HTML5) — bisa dibuka langsung di browser
│   ├── index.html
│   ├── css/style.css
│   └── js/
│       ├── sprites.js        # Pixel-art semua karakter (mudah diedit!)
│       ├── audio.js          # Efek suara & musik chiptune
│       ├── input.js          # Keyboard + tombol sentuh
│       ├── levels.js         # Peta level (ASCII) — edit level di sini
│       ├── entities.js       # Fisika, Bimo, musuh, item, partikel
│       ├── game.js           # State machine, rendering, HUD, layar
│       └── main.js           # Loop utama (60 FPS fixed timestep)
├── tools/patch-manifest.py   # Kunci orientasi landscape di Android
├── .github/workflows/
│   ├── android-build.yml     # Build APK otomatis via GitHub Actions
│   └── pages.yml             # Deploy versi web ke GitHub Pages
├── capacitor.config.json     # Konfigurasi pembungkus Android (Capacitor)
├── package.json
└── README.md
```

---

## ▶️ Main di Browser (tanpa install apa pun)

Buka `www/index.html` langsung di browser (klik dua kali), atau jalankan server
lokal:

```bash
cd www
python3 -m http.server 8000
# lalu buka http://localhost:8000
```

---

## 🚀 Upload ke GitHub (langkah demi langkah)

1. Buat repository baru di <https://github.com/new> (misal `super-bimo`),
   **tanpa** README/wizard awal.
2. Di komputer kamu:

   ```bash
   cd super-bimo
   git init
   git add .
   git commit -m "Super Bimo v1.0 - platformer klasik"
   git branch -M main
   git remote add origin https://github.com/USERNAME/super-bimo.git
   git push -u origin main
   ```

3. Selesai! Begitu ter-push, GitHub Actions otomatis:
   - **Build APK** → lihat tab **Actions** di repo → klik run terbaru →
     unduh **SuperBimo-APK** (berisi `app-debug.apk`).
   - **Deploy versi web** → aktifkan sekali di
     **Settings → Pages → Source: GitHub Actions**, lalu game bisa dimainkan di
     `https://USERNAME.github.io/super-bimo/`.

### 📱 Instal APK ke ponsel Android

1. Unduh `app-debug.apk` dari artifact Actions (atau dari Release).
2. Kirim ke ponsel, buka file-nya.
3. Jika diminta, izinkan **"instal dari sumber tidak dikenal"**.
4. Mainkan! Game otomatis tampil landscape.

### 🏷️ Membuat versi rilis (GitHub Release berisi APK)

```bash
git tag v1.0.0
git push origin v1.0.0
```

Actions akan mem-build APK dan otomatis membuat **Release** yang berisi
`app-debug.apk` — tautan yang enak dibagikan ke teman-temanmu.

---

## 🛠️ Kustomisasi

- **Level**: edit `www/js/levels.js`. Peta adalah teks ASCII — lihat legenda di
  bagian atas file. Tambah dunia baru dengan menyalin blok level.
- **Karakter & warna**: edit pixel-art di `www/js/sprites.js` (huruf = warna,
  lihat `COLORS`).
- **Musik/suara**: melodi & efek ada di `www/js/audio.js`.
- **Fisika**: konstanta kecepatan/lompatan ada di `entities.js`
  (`ACC`, `MAXV`, gravitasi `0.55`, kekuatan lompat `-11`).
- **Ikon aplikasi**: siapkan `resources/icon.png` (512×512) lalu jalankan
  `npx @capacitor/assets generate` di lokal (opsional).

## 🤖 Build APK di komputer sendiri (opsional)

Butuh Node 20+, Java 17, dan Android SDK:

```bash
npm install
npx cap add android
python3 tools/patch-manifest.py android/app/src/main/AndroidManifest.xml
npx cap sync android
cd android && ./gradlew assembleDebug
```

Hasil: `android/app/build/outputs/apk/debug/app-debug.apk`

---

## ⚖️ Catatan

Game ini adalah karya original yang *terinspirasi* genre platformer klasik.
Tidak berafiliasi dengan, didukung oleh, atau mengandung aset dari Nintendo
atau pemegang IP game mana pun. Jangan menambahkan aset/ROM dari game
komersial ke repo ini.

## 📜 Lisensi

MIT — bebas dipakai, dimodifikasi, dan dibagikan.
