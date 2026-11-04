# 🧑‍💼 Absensi Wajah — Sistem Presensi Karyawan (App + Web)

Sistem absensi karyawan berbasis **pengenalan wajah + liveness detection**.
Bisa dipakai dari **browser/HP (PWA)** maupun **APK Android**, dengan database
terpusat di web.

## ✨ Fitur

| # | Fitur | Keterangan |
|---|---|---|
| 1 | Pendaftaran wajah karyawan | Menu **Daftar Wajah**: pilih karyawan → 3 pose (lurus → tengok kiri → tengok kanan) → descriptor 128-dim + foto diunggah ke web sebagai database wajah |
| 2 | Absen masuk & keluar | Menu **Absen**: wajib **pilih nama/NIK dulu** → pilih Masuk/Keluar → scan wajah → tercatat di web |
| 3 | Validasi gerakan anti-foto | **SATU perintah acak: tengok kepala ke KANAN atau KIRI** — foto cetak/rekaman tidak bisa mengikuti → ditolak |
| 4 | Verifikasi 1:1 | Descriptor hasil scan dibandingkan server dengan data wajah karyawan **yang dipilih** (jarak Euclidean ≤ 0,55) — orang lain tidak bisa absen untuk rekan |
| 5 | Laporan lengkap + jam kerja | Menu **Laporan**: detail harian, rekap per karyawan, total jam kerja, status terlambat, export CSV |
| 6 | Unduh Data Master ke HP | Di menu **Laporan** → *Sinkronisasi HP ↔ Web*: unduh JSON (dengan data wajah, untuk mode offline) atau CSV Excel |
| 7 | Upload Transaksi ke Web | Di menu **Laporan** → *Sinkronisasi HP ↔ Web*: unggah file transaksi `.json` / `.csv` ke database web |
| 8 | Mode offline + auto-sync | Sinyal hilang? Transaksi disimpan di HP (localStorage) dan otomatis terunggah saat online |
| 9 | Verifikasi ulang di server | Server selalu memverifikasi ulang liveness & kecocokan wajah — client tidak bisa dipalsukan |

Anti-cheat berlaku berlapis: gerakan kepala acak (kanan/kiri) + verifikasi
descriptor wajah 1:1 di server + skor liveness wajib + foto bukti tersimpan.

---

## 🧰 Teknologi

- **Next.js 16 (App Router) + TypeScript** — satu kode untuk web & API
- **Tailwind CSS 4 + shadcn/ui** — tampilan responsif HP & desktop
- **face-api.js (TinyFaceDetector + Landmark68 + FaceRecognition)** — semua model
  berjalan di perangkat (lihat `public/models/face-api`), cepat & privat
- **Prisma ORM** — SQLite untuk pengembangan lokal, **PostgreSQL (Neon)** untuk produksi
- **Vercel** (hosting) + **Neon** (database) + **GitHub** (repo & CI build APK)
- **Capacitor** — pembungkus APK Android

---

## 🚀 Deploy: GitHub + Neon + Vercel

### A. Push ke GitHub

```bash
git init
git add .
git commit -m "Aplikasi absensi wajah"
git branch -M main
git remote add origin https://github.com/USERNAME/absensi-wajah.git
git push -u origin main
```

> `.env` (berisi kredensial) **tidak ikut** ter-push — sudah masuk `.gitignore`.

### B. Buat database di Neon

1. Buka [neon.tech](https://neon.tech) → daftar/login → **Create project**.
2. Pilih region terdekat (mis. *Singapore*).
3. Di dashboard, salin **Pooled connection** string (bertanda `-pooler`), bentuknya:
   ```
   postgresql://user:pass@ep-xxxx-pooler.region.aws.neon.tech/neondb?sslmode=require
   ```
4. Buat tabel di database — jalankan dari komputer lokal:
   ```bash
   # salin .env.example → .env, isi DATABASE_URL dengan string Neon di atas
   npm install
   npm run db:push:pg
   ```
   Perintah ini membuat tabel `Karyawan`, `DataWajah`, `Absensi`, `AbsensiLog`, `Setting`, `SyncLog` di Neon.

### C. Deploy di Vercel

1. [vercel.com](https://vercel.com) → **Add New Project** → pilih repo GitHub tadi.
2. **Environment Variables** → tambahkan:
   | Key | Value |
   |---|---|
   | `DATABASE_URL` | connection string Neon (pooled) dari langkah B |
3. **Build Command** (override) → isi:
   ```
   prisma generate --schema prisma/schema.postgres.prisma && next build
   ```
   (script `build` di `package.json` sudah berisi perintah yang sama —
   mengisi ulang memastikan benar.)
4. **Deploy**. Setelah selesai, cek `https://nama-app.vercel.app/api` —
   jika muncul `{"message":"API Absensi Wajah aktif",...}` berarti sukses.
5. Mulai pakai: tambah karyawan di menu **Karyawan** → daftar wajah di
   **Daftar Wajah** → absen di **Absen**.

> Skema database berubah? Jalankan `npm run db:push:pg` lagi dari lokal
> (atau ubah kedua file schema: `prisma/schema.prisma` dan `prisma/schema.postgres.prisma`).

---

## 📱 Build APK Android

Lihat **[docs/BUILD-APK.md](docs/BUILD-APK.md)** — dua cara:
lewat Android Studio, atau otomatis via **GitHub Actions** (APK diunduh dari
tab Actions sebagai artefak). Ringkas:

```bash
npm install @capacitor/core @capacitor/cli @capacitor/android
# isi server.url di capacitor.config.json dengan URL Vercel Anda
npx cap add android      # sekali, lalu commit folder android/
npx cap sync android
cd android && ./gradlew assembleDebug
```

Alternatif tanpa install apa pun: gunakan PWA — buka URL Vercel di Chrome HP →
*Tambahkan ke layar utama*.

---

## 📄 Format File "Upload Transaksi"

Dari menu **Laporan → Sinkronisasi HP ↔ Web → Upload Transaksi**.
Maksimal 1000 baris per file.

**CSV** (header wajib, tipe boleh `MASUK`/`KELUAR`, jam WIB `HH:mm` atau `HH:mm:ss`):

```csv
nik,tanggal,tipe,jam
00123,2026-10-30,MASUK,07:58
00123,2026-10-30,KELUAR,17:05
00124,2026-10-30,MASUK,08:12
```

**JSON** (array, atau `{"transaksi":[...]}`):

```json
[
  { "nik": "00123", "tipe": "MASUK",  "tanggal": "2026-10-30", "jam": "07:58" },
  { "nik": "00123", "tipe": "KELUAR", "waktu": "2026-10-30T10:05:00+07:00" }
]
```

Aturan pemrosesan per baris:

- NIK dicari di data master — NIK tidak dikenal → baris ditolak (laporan hasil upload menunjukkan alasannya).
- Baris yang **menyertakan descriptor wajah** tetap diverifikasi ulang oleh server terhadap database wajah.
- Baris **tanpa** descriptor dianggap impor manual — tercatat `deviceId=IMPORT` di log audit.
- Duplikat (karyawan sudah absen masuk/keluar di tanggal itu) → dilewati dengan catatan.
- Hasil upload ditampilkan langsung: jumlah baru / duplikat / gagal + alasannya.

---

## 🔌 API (untuk integrasi HP/aplikasi lain)

| Endpoint | Metode | Fungsi |
|---|---|---|
| `/api/karyawan` | GET/POST | daftar & tambah karyawan (query `?q=` untuk cari) |
| `/api/karyawan/[id]` | GET/PUT/DELETE | detail, ubah, hapus karyawan |
| `/api/karyawan/[id]/wajah` | POST/DELETE | **upload pendaftaran wajah** (descriptor + foto) / hapus |
| `/api/karyawan/export?format=json\|csv` | GET | **unduh data master** (JSON berisi descriptor wajah) |
| `/api/absensi` | POST | **upload transaksi absen** (karyawanId, tipe, foto, descriptor, liveness) |
| `/api/absensi?tanggal=YYYY-MM-DD` | GET | daftar absensi per tanggal |
| `/api/absensi/sync` | POST | sinkronisasi batch antrean offline |
| `/api/transaksi/upload` | POST | **upload file transaksi** `{ namaFile, isi }` (JSON/CSV) |
| `/api/laporan?dari=&sampai=&karyawanId=` | GET | laporan + jam kerja |
| `/api/laporan/export` | GET | export CSV laporan |
| `/api/dashboard` | GET | statistik harian |
| `/api/setting` | GET/PUT | jam masuk/keluar kantor (default 08:00 / 17:00, toleransi terlambat 15 menit) |
| `/api/match` | POST | pencocokan 1:N (identifikasi) — alur utama kini memakai verifikasi 1:1 via `/api/absensi` |

---

## 🗂️ Struktur Penting

```
prisma/schema.prisma            # skema SQLite (pengembangan/preview)
prisma/schema.postgres.prisma   # skema PostgreSQL — NEON (produksi)
src/app/api/...                 # endpoint API (tabel di atas)
src/components/absensi-view.tsx # menu Absen (pilih NIK → masuk/keluar → scan)
src/components/face-scanner.tsx # kamera + tantangan liveness
src/lib/liveness.ts             # engine tantangan gerakan (kanan/kiri)
src/lib/face-engine.ts          # pemuatan model face-api (client-side)
src/lib/absensi-server.ts       # verifikasi server (liveness + wajah 1:1)
src/lib/offline-queue.ts        # antrean offline + cache master data HP
public/models/face-api/         # model neural network (dilayani lokal)
capacitor.config.json           # konfigurasi APK (isi server.url!)
docs/BUILD-APK.md               # panduan build APK
.github/workflows/build-apk.yml # CI build APK otomatis
```

---

## ❓ Troubleshooting

| Masalah | Solusi |
|---|---|
| Kamera tidak muncul | Izinkan kamera di browser/APK; gunakan **https** (URL Vercel sudah https) |
| "Wajah tidak cocok dengan ..." | Daftarkan ulang wajah dengan pencahayaan baik; jaga jarak ± 50 cm |
| Foto dicoba menipu sistem | Sistem meminta tengok kanan/kiri acak — foto statis selalu gagal, skornya tidak pernah sampai 1 |
| Model wajah gagal dimuat | Pastikan folder `public/models/face-api` ter-deploy (ikut repo, jangan dihapus) |
| Upload transaksi banyak gagal "NIK tidak ditemukan" | Tambahkan karyawan dulu di menu Karyawan (NIK harus sama persis) |
| Laporan kosong di Vercel | Cek `DATABASE_URL` (harus pooled `-pooler`) dan jalankan `npm run db:push:pg` |
| APK stuck di splash | `server.url` di `capacitor.config.json` belum diisi / salah — perbaiki lalu rebuild |
| Jam tidak sesuai | Seluruh sistem memakai zona **WIB (Asia/Jakarta)**, termasuk tanggal absen & batas terlambat |

---

## 🔒 Catatan Keamanan

- Verifikasi wajah **1:1** dilakukan ulang di server untuk setiap transaksi —
  data yang dikirim dari HP tidak dipercaya mentah-mentah.
- Tanpa lulus tantangan gerakan (liveness ≥ 0,99) transaksi ditolak server.
- Foto bukti absensi disimpan di database web (bisa diperiksa di log audit
  `AbsensiLog`, termasuk jarak wajah & perangkat pengirim).
- Import CSV tanpa data wajah ditandai `IMPORT` — batasi akses URL web hanya
  untuk admin/HR bila fitur ini dipakai.
