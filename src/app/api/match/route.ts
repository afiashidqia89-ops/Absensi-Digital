import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { jarakDescriptor, AMBANG_MATCH_WAJAH } from '@/lib/descriptor'

/**
 * Cari karyawan dari descriptor wajah (server-side matching terhadap
 * database wajah web). Return kandidat terbaik bila jarak < ambang.
 */
export async function POST(req: NextRequest) {
  try {
    const { descriptor } = await req.json()
    if (!Array.isArray(descriptor) || descriptor.length !== 128) {
      return NextResponse.json({ error: 'Descriptor tidak valid' }, { status: 400 })
    }
    const data = await db.dataWajah.findMany({
      include: { karyawan: { select: { id: true, nik: true, nama: true, jabatan: true, departemen: true, aktif: true } } },
    })

    let terbaik: { karyawan: (typeof data)[number]['karyawan']; jarak: number } | null = null
    for (const dw of data) {
      if (!dw.karyawan.aktif) continue
      const sampel = JSON.parse(dw.sampelJson) as { descriptor: number[] }[]
      for (const s of sampel) {
        const d = jarakDescriptor(descriptor, s.descriptor)
        if (Number.isFinite(d) && (!terbaik || d < terbaik.jarak)) {
          terbaik = { karyawan: dw.karyawan, jarak: d }
        }
      }
    }

    if (!terbaik || terbaik.jarak > AMBANG_MATCH_WAJAH) {
      return NextResponse.json(
        { match: false, pesan: 'Wajah tidak dikenali. Daftarkan wajah terlebih dahulu.' },
        { status: 404 }
      )
    }
    return NextResponse.json({
      match: true,
      karyawan: terbaik.karyawan,
      jarak: Number(terbaik.jarak.toFixed(4)),
      keyakinan: Math.max(0, Math.min(1, 1 - terbaik.jarak / AMBANG_MATCH_WAJAH)),
    })
  } catch (e) {
    console.error('POST /api/match', e)
    return NextResponse.json({ error: 'Gagal mencocokkan wajah' }, { status: 500 })
  }
}
