import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { tanggalWIB, jamMenitWIB, formatDurasi } from '@/lib/absensi-utils'
import type { BarisRekap, RingkasanKaryawan } from '@/lib/types'

/**
 * Laporan absensi lengkap + jam kerja per hari.
 * Query: dari=YYYY-MM-DD&sampai=YYYY-MM-DD&karyawanId=opsional
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams
  const sampai = sp.get('sampai') ?? tanggalWIB(new Date())
  const dari = sp.get('dari') ?? tanggalWIB(new Date(Date.now() - 6 * 86400000))
  const karyawanId = sp.get('karyawanId') ?? undefined

  const data = await db.absensi.findMany({
    where: {
      tanggal: { gte: dari, lte: sampai },
      ...(karyawanId ? { karyawanId } : {}),
    },
    include: { karyawan: true },
    orderBy: [{ tanggal: 'desc' }, { karyawan: { nama: 'asc' } }],
  })

  const baris: BarisRekap[] = data.map((a) => ({
    tanggal: a.tanggal,
    karyawanId: a.karyawanId,
    nik: a.karyawan.nik,
    nama: a.karyawan.nama,
    departemen: a.karyawan.departemen,
    jamMasuk: a.jamMasuk ? jamMenitWIB(a.jamMasuk) : null,
    jamKeluar: a.jamKeluar ? jamMenitWIB(a.jamKeluar) : null,
    menitKerja: a.jamMasuk && a.jamKeluar ? Math.round((a.jamKeluar.getTime() - a.jamMasuk.getTime()) / 60000) : a.menitKerja,
    durasi: a.jamMasuk && a.jamKeluar ? formatDurasi(Math.round((a.jamKeluar.getTime() - a.jamMasuk.getTime()) / 60000)) : formatDurasi(a.menitKerja),
    status: a.status,
    menitTerlambat: a.menitTerlambat,
    livenessMasuk: a.livenessMasuk,
  }))

  // Ringkasan per karyawan
  const map = new Map<string, RingkasanKaryawan>()
  for (const b of baris) {
    const r = map.get(b.karyawanId) ?? {
      karyawanId: b.karyawanId, nik: b.nik, nama: b.nama, departemen: b.departemen,
      hariHadir: 0, hariTerlambat: 0, totalMenit: 0, rataRataMenit: 0,
    }
    if (b.menitKerja != null) r.totalMenit += b.menitKerja
    if (b.status === 'TERLAMBAT') r.hariTerlambat++
    r.hariHadir++
    map.set(b.karyawanId, r)
  }
  const ringkasan = Array.from(map.values()).map((r) => ({
    ...r,
    rataRataMenit: r.hariHadir > 0 ? Math.round(r.totalMenit / r.hariHadir) : 0,
  }))

  return NextResponse.json({
    dari,
    sampai,
    baris,
    ringkasan,
    totalMenit: baris.reduce((s, b) => s + (b.menitKerja ?? 0), 0),
  })
}
