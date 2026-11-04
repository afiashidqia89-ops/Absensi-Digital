import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { tanggalWIB, jamMenitWIB, tanggalMinDariN } from '@/lib/absensi-utils'

/** Ringkasan dashboard: statistik hari ini + log terbaru + tren 7 hari */
export async function GET() {
  const hariIni = tanggalWIB(new Date())
  const tujuhHari = tanggalMinDariN(6)

  const [totalKaryawan, terdaftarWajah, absensiHariIni, logTerbaru, rekap7] = await Promise.all([
    db.karyawan.count({ where: { aktif: true } }),
    db.karyawan.count({ where: { aktif: true, terdaftarWajah: true } }),
    db.absensi.findMany({
      where: { tanggal: hariIni },
      include: { karyawan: { select: { nama: true } } },
    }),
    db.absensiLog.findMany({
      orderBy: { waktu: 'desc' },
      take: 8,
      include: { karyawan: { select: { nama: true } } },
    }),
    db.absensi.groupBy({
      by: ['tanggal', 'status'],
      where: { tanggal: { gte: tujuhHari, lte: hariIni } },
      _count: { _all: true },
    }),
  ])

  const hadir = absensiHariIni.length
  const terlambat = absensiHariIni.filter((a) => a.status === 'TERLAMBAT').length
  const sedangBekerja = absensiHariIni.filter((a) => a.jamMasuk && !a.jamKeluar).length

  // Susun tren 7 hari
  const tren: { tanggal: string; hadir: number; terlambat: number }[] = []
  for (let i = 6; i >= 0; i--) {
    const t = tanggalMinDariN(i)
    const entri = rekap7.filter((r) => r.tanggal === t)
    tren.push({
      tanggal: t,
      hadir: entri.reduce((s, e) => s + e._count._all, 0),
      terlambat: entri.find((e) => e.status === 'TERLAMBAT')?._count._all ?? 0,
    })
  }

  const jamMasukSet = await db.setting.findUnique({ where: { key: 'jamMasuk' } })
  const jamKeluarSet = await db.setting.findUnique({ where: { key: 'jamKeluar' } })

  return NextResponse.json({
    totalKaryawan,
    terdaftarWajah,
    hadirHariIni: hadir,
    terlambatHariIni: terlambat,
    belumAbsen: Math.max(0, totalKaryawan - hadir),
    sedangBekerja,
    logTerbaru: logTerbaru.map((l) => ({
      id: l.id,
      nama: l.karyawan.nama,
      tipe: l.tipe,
      waktu: jamMenitWIB(l.waktu),
      foto: l.foto,
    })),
    rekap7Hari: tren,
    jamKantor: {
      masuk: jamMasukSet?.value ?? '08:00',
      keluar: jamKeluarSet?.value ?? '17:00',
    },
  })
}
