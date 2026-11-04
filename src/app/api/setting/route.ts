import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

/** Pengaturan jam kantor (jam masuk & jam keluar) */
export async function GET() {
  const rows = await db.setting.findMany()
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]))
  return NextResponse.json({ jamMasuk: map.jamMasuk ?? '08:00', jamKeluar: map.jamKeluar ?? '17:00' })
}

export async function PUT(req: NextRequest) {
  try {
    const { jamMasuk, jamKeluar } = await req.json()
    const valid = /^([01]\d|2[0-3]):[0-5]\d$/
    if (jamMasuk && !valid.test(jamMasuk)) return NextResponse.json({ error: 'Format jam masuk salah (HH:mm)' }, { status: 400 })
    if (jamKeluar && !valid.test(jamKeluar)) return NextResponse.json({ error: 'Format jam keluar salah (HH:mm)' }, { status: 400 })
    if (jamMasuk) await db.setting.upsert({ where: { key: 'jamMasuk' }, create: { key: 'jamMasuk', value: jamMasuk }, update: { value: jamMasuk } })
    if (jamKeluar) await db.setting.upsert({ where: { key: 'jamKeluar' }, create: { key: 'jamKeluar', value: jamKeluar }, update: { value: jamKeluar } })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Gagal menyimpan pengaturan' }, { status: 500 })
  }
}
