import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { tanggalWIB, jamMenitWIB, formatDurasi } from '@/lib/absensi-utils'

/** Export laporan absensi ke CSV (bisa dibuka di Excel) */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams
  const sampai = sp.get('sampai') ?? tanggalWIB(new Date())
  const dari = sp.get('dari') ?? tanggalWIB(new Date(Date.now() - 6 * 86400000))
  const karyawanId = sp.get('karyawanId') ?? undefined

  const data = await db.absensi.findMany({
    where: { tanggal: { gte: dari, lte: sampai }, ...(karyawanId ? { karyawanId } : {}) },
    include: { karyawan: true },
    orderBy: [{ tanggal: 'desc' }, { karyawan: { nama: 'asc' } }],
  })

  const header = 'Tanggal,NIK,Nama,Departemen,Jam Masuk,Jam Keluar,Durasi Kerja,Menit Kerja,Status,Terlambat (mnt),Skor Liveness'
  const baris = data.map((a) => {
    const menit = a.jamMasuk && a.jamKeluar ? Math.round((a.jamKeluar.getTime() - a.jamMasuk.getTime()) / 60000) : a.menitKerja
    return [
      a.tanggal,
      a.karyawan.nik,
      `"${a.karyawan.nama.replace(/"/g, '""')}"`,
      `"${a.karyawan.departemen.replace(/"/g, '""')}"`,
      a.jamMasuk ? jamMenitWIB(a.jamMasuk) : '',
      a.jamKeluar ? jamMenitWIB(a.jamKeluar) : '',
      `"${formatDurasi(menit)}"`,
      menit ?? '',
      a.status,
      a.menitTerlambat,
      a.livenessMasuk != null ? a.livenessMasuk.toFixed(2) : '',
    ].join(',')
  })
  const csv = '\uFEFF' + [header, ...baris].join('\n')
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="laporan-absensi-${dari}-sd-${sampai}.csv"`,
    },
  })
}
