# 📱 Panduan Build APK — Absensi Wajah

Aplikasi web (Next.js) dibungkus menjadi APK Android memakai **Capacitor**.
APK ini adalah "shell" yang memuat aplikasi web dari URL **Vercel** Anda —
jadi setiap perbaikan di web otomatis ikut terpakai di APK **tanpa build ulang**.

> **Prasyarat deploy web:** sebelum build APK, aplikasi web harus sudah live di
> Vercel (lihat `README.md` bagian deploy). Semua fitur (kamera, liveness,
> sinkronisasi) berjalan lewat kamera HP langsung di dalam WebView.

---

## 0. Prasyarat perangkat

| Alat | Versi | Keterangan |
|---|---|---|
| Node.js | 20+ | untuk CLI Capacitor |
| Java JDK | 17 | untuk Gradle (sudah dibundel Android Studio) |
| Android Studio | terbaru | atau cukup *Android SDK Command-line Tools* |
| HP Android | 8.0 (API 26)+ | untuk uji coba |

---

## 1. Siapkan URL Vercel

Edit `capacitor.config.json` di root proyek, isi `server.url` dengan URL produksi Anda:

```json
{
  "appId": "id.web.absensiwajah.app",
  "appName": "Absensi Wajah",
  "webDir": "mobile-www",
  "server": {
    "url": "https://absensi-perusahaan-anda.vercel.app",
    "androidScheme": "https"
  }
}
```

> ⚠️ Harus **https** (URL Vercel otomatis https). Ganti seluruh tulisan
> `GANTI-DENGAN-URL-VERCEL.vercel.app`.

---

## 2. Buat project Android (sekali saja)

```bash
npm install @capacitor/core @capacitor/cli @capacitor/android
npx cap add android
npx cap sync android
```

Ini membuat folder `android/`. **Commit folder ini ke GitHub** — workflow
build otomatis (`.github/workflows/build-apk.yml`) membutuhkannya.

## 3. Izin kamera

Buka `android/app/src/main/AndroidManifest.xml` dan pastikan ada:

```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.CAMERA" />
```

(Untuk **GitHub Actions** langkah ini otomatis — script workflow menyisipkan
izin CAMERA bila belum ada.)

## 4. Build APK — pilih salah satu

### Cara A — Lewat Android Studio (lokal)

```bash
npx cap sync android
npx cap open android
```

Di Android Studio: **Build → Build App Bundle(s) / APK(s) → Build APK(s)**.
Hasil: `android/app/build/outputs/apk/debug/app-debug.apk`

Atau lewat terminal saja:

```bash
cd android
./gradlew assembleDebug
```

### Cara B — Lewat GitHub Actions (otomatis, tanpa install Android Studio)

1. Push repo (termasuk folder `android/`) ke GitHub.
2. Buka tab **Actions** → workflow **"Build APK Absensi"** → **Run workflow**.
3. Tunggu ± 5–10 menit, lalu unduh artefak **`absensi-apk`** berisi `app-debug.apk`.

Workflow ini juga berjalan otomatis setiap kali `android/`,
`capacitor.config.json`, atau `mobile-www/` berubah di branch `main`.

## 5. Install ke HP

1. Salin `app-debug.apk` ke HP, buka file tersebut.
2. Izinkan *"Install dari sumber tidak dikenal"* bila diminta.
3. Buka aplikasi → izinkan **Kamera** (wajib, untuk scan wajah & liveness).
4. Login tidak diperlukan — aplikasi langsung terhubung ke web Vercel Anda.

## 6. Catatan penting

- **Kamera tidak muncul di APK?** Pastikan izin CAMERA ada di manifest dan
  Anda menyetujui permintaan izin saat pertama kali membuka menu Absen/Daftar Wajah.
- **Tetap tampil "Menghubungkan ke server…"?** `server.url` salah/layar offline
  — cek URL Vercel di `capacitor.config.json`, lalu rebuild.
- **APK debug vs release:** `assembleDebug` cukup untuk pemakaian internal.
  Untuk rilis ke Play Store diperlukan signing (`assembleRelease` + keystore).
- **Versi aplikasi:** ubah `versionName` di `android/app/build.gradle`.

## 7. Ringkasan perintah cepat

```bash
npm install @capacitor/core @capacitor/cli @capacitor/android
npx cap add android            # sekali
# edit capacitor.config.json (server.url) + manifest CAMERA
npx cap sync android           # setiap kali konfigurasi berubah
cd android && ./gradlew assembleDebug
```
