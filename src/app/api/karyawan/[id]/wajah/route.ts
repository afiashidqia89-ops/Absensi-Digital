import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { simpanFoto } from '@/lib/storage'
import type { SampelWajah } from '@/lib/types'

type Ctx = { params: Promise<{ id: string }> }

interface Body {
  sampel: SampelWajah[]
  deviceId?: string
}

/**
 * Upload hasil pendaftaran wajah karyawan ke web (database wajah terpusat).
 * Sampel: array { descriptor: number[128], foto: dataURL }
 */
export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params
    const body = (await req.json()) as Body
    const sampel = body?.sampel
    if (!Array.isArray(sampel) || sampel.length === 0) {
      return NextResponse.json({ error: 'Data sampel wajah kosong' }, { status: 400 })
    }
    const karyawan = await db.karyawan.findUnique({ where: { id } })
    if (!karyawan) return NextResponse.json({ error: 'Karyawan tidak ditemukan' }, { status: 404 })

    // Foto & descriptor disimpan di DATABASE (dataURL) — kompatibel Vercel/Neon
    const tersimpan: SampelWajah[] = []
    for (const s of sampel.slice(0, 6)) {
      if (!Array.isArray(s.descriptor) || s.descriptor.length !== 128) {
        return NextResponse.json({ error: 'Descriptor wajah tidak valid (harus 128 dimensi)' }, { status: 400 })
      }
      const fotoData = s.foto?.startsWith('data:image') ? await simpanFoto(s.foto) : s.foto
      tersimpan.push({ descriptor: s.descriptor, foto: fotoData })
    }

    const dataWajah = await db.dataWajah.upsert({
      where: { karyawanId: id },
      create: {
        karyawanId: id,
        sampelJson: JSON.stringify(tersimpan),
        jumlahSampel: tersimpan.length,
        deviceId: body.deviceId ?? null,
      },
      update: {
        sampelJson: JSON.stringify(tersimpan),
        jumlahSampel: tersimpan.length,
        deviceId: body.deviceId ?? null,
      },
    })

    await db.karyawan.update({ where: { id }, data: { terdaftarWajah: true } })

    return NextResponse.json({
      ok: true,
      pesan: `Wajah ${karyawan.nama} terdaftar di database web (${tersimpan.length} sampel)`,
      jumlahSampel: tersimpan.length,
      dataWajah,
    })
  } catch (e) {
    console.error('POST wajah', e)
    return NextResponse.json({ error: 'Gagal mengunggah data wajah' }, { status: 500 })
  }
}

/** Hapus pendaftaran wajah */
export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params
  try {
    await db.dataWajah.deleteMany({ where: { karyawanId: id } })
    await db.karyawan.update({ where: { id }, data: { terdaftarWajah: false } })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Gagal menghapus data wajah' }, { status: 500 })
  }
}
