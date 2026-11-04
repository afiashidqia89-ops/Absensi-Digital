import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params
  const karyawan = await db.karyawan.findUnique({
    where: { id },
    include: {
      dataWajah: true,
      absensi: { orderBy: { tanggal: 'desc' }, take: 30 },
    },
  })
  if (!karyawan) return NextResponse.json({ error: 'Karyawan tidak ditemukan' }, { status: 404 })
  return NextResponse.json(karyawan)
}

export async function PUT(req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params
    const body = await req.json()
    const { nik, nama, jabatan, departemen, telepon, aktif } = body ?? {}
    const data: Record<string, unknown> = {}
    if (nik !== undefined) data.nik = String(nik).trim()
    if (nama !== undefined) data.nama = String(nama).trim()
    if (jabatan !== undefined) data.jabatan = String(jabatan).trim()
    if (departemen !== undefined) data.departemen = String(departemen).trim()
    if (telepon !== undefined) data.telepon = telepon ? String(telepon).trim() : null
    if (aktif !== undefined) data.aktif = Boolean(aktif)
    const updated = await db.karyawan.update({
      where: { id },
      data,
      include: { dataWajah: { select: { jumlahSampel: true } } },
    })
    return NextResponse.json(updated)
  } catch (e: unknown) {
    const msg = e instanceof Error && e.message.includes('Unique') ? 'NIK sudah dipakai karyawan lain' : 'Gagal memperbarui karyawan'
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params
    await db.karyawan.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Gagal menghapus karyawan' }, { status: 400 })
  }
}
