import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim() ?? ''
  const karyawan = await db.karyawan.findMany({
    where: q
      ? {
          OR: [
            { nama: { contains: q } },
            { nik: { contains: q } },
            { jabatan: { contains: q } },
            { departemen: { contains: q } },
          ],
        }
      : undefined,
    include: { dataWajah: { select: { jumlahSampel: true } } },
    orderBy: { nama: 'asc' },
  })
  return NextResponse.json(karyawan)
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { nik, nama, jabatan, departemen, telepon } = body ?? {}
    if (!nik?.trim() || !nama?.trim()) {
      return NextResponse.json({ error: 'NIK dan nama wajib diisi' }, { status: 400 })
    }
    const ada = await db.karyawan.findUnique({ where: { nik: nik.trim() } })
    if (ada) return NextResponse.json({ error: `NIK ${nik} sudah terdaftar` }, { status: 409 })
    const baru = await db.karyawan.create({
      data: {
        nik: nik.trim(),
        nama: nama.trim(),
        jabatan: jabatan?.trim() || 'Karyawan',
        departemen: departemen?.trim() || 'Umum',
        telepon: telepon?.trim() || null,
      },
      include: { dataWajah: { select: { jumlahSampel: true } } },
    })
    return NextResponse.json(baru, { status: 201 })
  } catch (e) {
    console.error('POST /api/karyawan', e)
    return NextResponse.json({ error: 'Gagal menyimpan karyawan' }, { status: 500 })
  }
}
