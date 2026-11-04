import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { prosesTransaksi } from '@/lib/absensi-server'
import { tanggalWIB } from '@/lib/absensi-utils'
import type { TransaksiAbsen } from '@/lib/types'

/** Kirim satu transaksi absensi dari HP ke web (upload hasil scan) */
export async function POST(req: NextRequest) {
  try {
    const tr = (await req.json()) as TransaksiAbsen
    const hasil = await prosesTransaksi(tr)
    if (!hasil.ok) return NextResponse.json({ error: hasil.error }, { status: 422 })
    return NextResponse.json(hasil)
  } catch (e) {
    console.error('POST /api/absensi', e)
    return NextResponse.json({ error: 'Gagal memproses absensi' }, { status: 500 })
  }
}

/** Daftar absensi per tanggal (untuk dashboard & pantauan) */
export async function GET(req: NextRequest) {
  const tanggal = req.nextUrl.searchParams.get('tanggal') ?? tanggalWIB(new Date())
  const data = await db.absensi.findMany({
    where: { tanggal },
    include: { karyawan: { select: { nama: true, nik: true, jabatan: true, departemen: true } } },
    orderBy: { jamMasuk: 'asc' },
  })
  return NextResponse.json({ tanggal, data })
}
