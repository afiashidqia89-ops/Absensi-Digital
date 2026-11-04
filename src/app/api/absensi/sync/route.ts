import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { prosesTransaksi } from '@/lib/absensi-server'
import type { TransaksiAbsen } from '@/lib/types'

/**
 * Sinkronisasi batch dari HP — mengunggah antrean transaksi offline
 * (dibuat saat sinyal hilang) ke database web.
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { deviceId?: string; transaksi: TransaksiAbsen[] }
    const antrean = Array.isArray(body?.transaksi) ? body.transaksi : []
    if (antrean.length === 0) {
      return NextResponse.json({ error: 'Tidak ada transaksi untuk disinkronkan' }, { status: 400 })
    }

    const hasil: { index: number; ok: boolean; pesan: string }[] = []
    for (let i = 0; i < antrean.length; i++) {
      const tr = antrean[i]
      try {
        const r = await prosesTransaksi({ ...tr, offlineSync: true })
        if (r.ok) hasil.push({ index: i, ok: true, pesan: `${r.nama}: ${r.pesan}` })
        else hasil.push({ index: i, ok: false, pesan: r.error })
      } catch {
        hasil.push({ index: i, ok: false, pesan: 'Gagal memproses transaksi' })
      }
    }

    const sukses = hasil.filter((h) => h.ok).length
    await db.syncLog.create({
      data: {
        deviceId: body.deviceId ?? 'tidak-diketahui',
        jumlah: antrean.length,
        status: sukses === antrean.length ? 'SUKSES' : 'SEBAGIAN',
        pesan: `${sukses}/${antrean.length} transaksi berhasil diunggah`,
      },
    })

    return NextResponse.json({ ok: true, sukses, total: antrean.length, hasil })
  } catch (e) {
    console.error('POST /api/absensi/sync', e)
    return NextResponse.json({ error: 'Gagal sinkronisasi' }, { status: 500 })
  }
}
