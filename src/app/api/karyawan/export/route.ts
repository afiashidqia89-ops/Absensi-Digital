import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * Download data master karyawan dari web ke HP.
 * format=json  → lengkap termasuk descriptor wajah (HP bisa matching offline)
 * format=csv   → ringkas untuk Excel
 */
export async function GET(req: NextRequest) {
  const format = req.nextUrl.searchParams.get('format') ?? 'json'
  const karyawan = await db.karyawan.findMany({
    include: { dataWajah: true },
    orderBy: { nama: 'asc' },
  })

  if (format === 'csv') {
    const header = 'NIK,Nama,Jabatan,Departemen,Telepon,Aktif,WajahTerdaftar,JumlahSampel,TerdaftarPada'
    const baris = karyawan.map((k) =>
      [
        k.nik,
        `"${k.nama.replace(/"/g, '""')}"`,
        `"${k.jabatan.replace(/"/g, '""')}"`,
        `"${k.departemen.replace(/"/g, '""')}"`,
        k.telepon ?? '',
        k.aktif ? 'Ya' : 'Tidak',
        k.terdaftarWajah ? 'Ya' : 'Tidak',
        String(k.dataWajah?.jumlahSampel ?? 0),
        k.createdAt,
      ].join(',')
    )
    const csv = '\uFEFF' + [header, ...baris].join('\n') // BOM agar Excel rapi
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="master-karyawan-${Date.now()}.csv"`,
      },
    })
  }

  // JSON lengkap — dipakai HP untuk verifikasi offline + tampilan master data.
  // Foto TIDAK disertakan agar file tetap ringan (descriptor cukup untuk matching).
  const data = {
    diunduhPada: new Date().toISOString(),
    versi: 1,
    karyawan: karyawan.map((k) => ({
      id: k.id,
      nik: k.nik,
      nama: k.nama,
      jabatan: k.jabatan,
      departemen: k.departemen,
      telepon: k.telepon,
      aktif: k.aktif,
      wajah: k.dataWajah
        ? {
            sampel: (JSON.parse(k.dataWajah.sampelJson) as { descriptor: number[]; foto: string }[]).map((s) => ({
              descriptor: s.descriptor,
            })),
          }
        : null,
    })),
  }
  return new NextResponse(JSON.stringify(data), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="master-karyawan-${Date.now()}.json"`,
    },
  })
}
