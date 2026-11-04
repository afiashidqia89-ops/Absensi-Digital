// Logika server transaksi absensi — dipakai /api/absensi dan /api/absensi/sync
import { db } from '@/lib/db'
import { simpanFoto } from '@/lib/storage'
import { jarakDescriptor, AMBANG_MATCH_WAJAH } from '@/lib/descriptor'
import { tanggalWIB, statusKehadiran, durasiKerja, jamMenitWIB } from '@/lib/absensi-utils'
import type { TransaksiAbsen, HasilAbsen } from '@/lib/types'

// Ambang kecocokan wajah: descriptor absensi vs database pendaftaran

async function ambilSettingBatas(): Promise<string> {
  const s = await db.setting.findUnique({ where: { key: 'jamMasuk' } })
  return s?.value ?? '08:00'
}

export async function prosesTransaksi(tr: TransaksiAbsen): Promise<HasilAbsen | { ok: false; error: string }> {
  const { karyawanId, tipe } = tr
  if (!karyawanId || (tipe !== 'MASUK' && tipe !== 'KELUAR')) {
    return { ok: false, error: 'Transaksi tidak valid (karyawanId/tipe wajib)' }
  }

  const karyawan = await db.karyawan.findUnique({ where: { id: karyawanId }, include: { dataWajah: true } })
  if (!karyawan) return { ok: false, error: 'Karyawan tidak ditemukan' }
  if (!karyawan.aktif) return { ok: false, error: `Karyawan ${karyawan.nama} berstatus nonaktif` }
  if (!karyawan.dataWajah) return { ok: false, error: `${karyawan.nama} belum mendaftarkan wajah` }

  // ── Verifikasi keaslian di SERVER (anti manipulasi & anti foto) ──
  // 1) Wajib melewati tantangan liveness di HP (skor 0..1)
  const liveness = typeof tr.liveness === 'number' ? tr.liveness : null
  if (liveness === null || liveness < 0.99) {
    return { ok: false, error: 'Verifikasi wajah asli (gerakan) belum selesai — absensi ditolak' }
  }

  // 2) Verifikasi ulang descriptor vs database wajah
  let jarak: number | null = null
  if (Array.isArray(tr.descriptor)) {
    const sampel = JSON.parse(karyawan.dataWajah.sampelJson) as { descriptor: number[] }[]
    let min = Infinity
    for (const s of sampel) {
      const d = jarakDescriptor(tr.descriptor, s.descriptor)
      if (d < min) min = d
    }
    jarak = Number.isFinite(min) ? min : null
    if (jarak === null || jarak > AMBANG_MATCH_WAJAH) {
      return { ok: false, error: 'Wajah tidak cocok dengan pendaftaran — absensi ditolak' }
    }
  }

  // Waktu transaksi: pakai waktu perangkat bila sync offline, jika tidak pakai waktu server
  const waktu = tr.waktu ? new Date(tr.waktu) : new Date()
  if (isNaN(waktu.getTime())) return { ok: false, error: 'Waktu transaksi tidak valid' }
  const tanggal = tanggalWIB(waktu)

  let fotoData: string | null = null
  if (tr.foto?.startsWith('data:image')) {
    try {
      fotoData = await simpanFoto(tr.foto) // tersimpan di database (dataURL)
    } catch {
      fotoData = null
    }
  }

  const batasMasuk = await ambilSettingBatas()
  const existing = await db.absensi.findUnique({
    where: { karyawanId_tanggal: { karyawanId, tanggal } },
  })

  let pesan = ''
  let jamMasuk: Date | null = existing?.jamMasuk ?? null
  let jamKeluar: Date | null = existing?.jamKeluar ?? null

  if (tipe === 'MASUK') {
    if (jamMasuk) {
      pesan = `${karyawan.nama} sudah absen MASUK hari ini pada ${jamMenitWIB(jamMasuk)}`
    } else {
      const { status, menitTerlambat } = statusKehadiran(waktu, batasMasuk)
      jamMasuk = waktu
      await db.absensi.upsert({
        where: { karyawanId_tanggal: { karyawanId, tanggal } },
        create: {
          karyawanId, tanggal, jamMasuk: waktu, fotoMasuk: fotoData,
          livenessMasuk: liveness, status, menitTerlambat, deviceId: tr.deviceId ?? null,
        },
        update: {
          jamMasuk: waktu, fotoMasuk: fotoData, livenessMasuk: liveness,
          status, menitTerlambat, deviceId: tr.deviceId ?? null,
        },
      })
      pesan = status === 'TERLAMBAT'
        ? `Selamat bekerja, ${karyawan.nama}! (tercatat terlambat ${menitTerlambat} menit)`
        : `Selamat bekerja, ${karyawan.nama}! Absen masuk berhasil`
    }
  } else {
    if (jamKeluar) {
      pesan = `${karyawan.nama} sudah absen KELUAR hari ini pada ${jamMenitWIB(jamKeluar)}`
    } else {
      jamKeluar = waktu
      const menitKerja = jamMasuk ? durasiKerja(jamMasuk, waktu) : null
      await db.absensi.upsert({
        where: { karyawanId_tanggal: { karyawanId, tanggal } },
        create: {
          karyawanId, tanggal, jamKeluar: waktu, fotoKeluar: fotoData,
          livenessKeluar: liveness, deviceId: tr.deviceId ?? null,
          status: 'HADIR',
        },
        update: {
          jamKeluar: waktu, fotoKeluar: fotoData, livenessKeluar: liveness,
          menitKerja, deviceId: tr.deviceId ?? null,
        },
      })
      pesan = menitKerja != null
        ? `Terima kasih, ${karyawan.nama}! Total kerja hari ini ${Math.floor(menitKerja / 60)} jam ${menitKerja % 60} menit`
        : `Terima kasih, ${karyawan.nama}! Absen keluar berhasil (jam masuk tidak ditemukan)`
    }
  }

  // Log transaksi mentah (audit)
  await db.absensiLog.create({
    data: {
      karyawanId, tipe, waktu,
      foto: fotoData, liveness, jarakWajah: jarak,
      deviceId: tr.deviceId ?? null, offlineSync: Boolean(tr.offlineSync),
    },
  })

  const updated = await db.absensi.findUnique({
    where: { karyawanId_tanggal: { karyawanId, tanggal } },
  })

  return {
    ok: true,
    nama: karyawan.nama,
    nik: karyawan.nik,
    tipe,
    tanggal,
    jamMasuk: updated?.jamMasuk ? jamMenitWIB(updated.jamMasuk) : undefined,
    jamKeluar: updated?.jamKeluar ? jamMenitWIB(updated.jamKeluar) : undefined,
    menitKerja: updated?.menitKerja ?? null,
    status: updated?.status ?? 'HADIR',
    jarakWajah: jarak,
    pesan,
  }
}
