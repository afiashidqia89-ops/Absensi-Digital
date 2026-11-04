import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { simpanFoto } from '@/lib/storage'
import { jarakDescriptor, AMBANG_MATCH_WAJAH } from '@/lib/descriptor'
import {
  tanggalWIB, statusKehadiran, durasiKerja,
} from '@/lib/absensi-utils'

// ─────────────────────────────────────────────────────────────
// Upload Transaksi ke Web (menu Laporan → Sinkronisasi HP ↔ Web)
// Menerima file JSON atau CSV berisi transaksi absensi, lalu
// diproses baris per baris ke database (Absensi + AbsensiLog).
//
// CSV  : nik,tanggal,tipe,jam          (MASUK|KELUAR, jam HH:mm[:ss])
// JSON : [ { nik, tipe, tanggal, jam|waktu, descriptor?, liveness?,
//              deviceId?, foto? } ]  atau { "transaksi": [...] }
//
// Aturan:
//  • NIK tidak dikenal           → baris ditolak
//  • Ada descriptor              → diverifikasi ulang vs database wajah
//  • Tanpa descriptor            → impor manual (deviceId = IMPORT)
//  • Sudah absen di tanggal itu  → dilewati (duplikat)
//  • Maksimal 1000 baris per file
// ─────────────────────────────────────────────────────────────

const MAKS_BARIS = 1000
const RE_TANGGAL = /^\d{4}-\d{2}-\d{2}$/
const RE_JAM = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/

interface BarisInput {
  nik?: string
  karyawanId?: string
  tanggal?: string
  tipe?: string
  jam?: string
  waktu?: string
  foto?: string
  deviceId?: string
  descriptor?: unknown
  liveness?: unknown
}

interface GagalBaris {
  baris: number
  identitas: string
  pesan: string
}

/** Split satu baris CSV (mendukung tanda kutip, koma, dan titik-koma) */
function splitBarisCSV(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let inQ = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (inQ) {
      if (c === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++ }
        else inQ = false
      } else cur += c
    } else if (c === '"') inQ = true
    else if (c === ',' || c === ';') { out.push(cur.trim()); cur = '' }
    else cur += c
  }
  out.push(cur.trim())
  return out
}

/** Ubah isi file (teks) menjadi daftar baris transaksi */
function parseIsi(text: string): { baris: BarisInput[]; format: 'json' | 'csv' } | { error: string } {
  const textBersih = text.replace(/^\uFEFF/, '').trim()
  if (!textBersih) return { error: 'File kosong' }

  // ── Coba JSON dulu ──
  if (textBersih.startsWith('[') || textBersih.startsWith('{')) {
    try {
      const parsed = JSON.parse(textBersih) as unknown
      const arr = Array.isArray(parsed)
        ? parsed
        : Array.isArray((parsed as { transaksi?: unknown }).transaksi)
          ? (parsed as { transaksi: BarisInput[] }).transaksi
          : null
      if (!arr) return { error: 'JSON harus berupa array transaksi atau { "transaksi": [...] }' }
      return { baris: arr as BarisInput[], format: 'json' }
    } catch {
      return { error: 'JSON tidak valid' }
    }
  }

  // ── CSV ──
  const lines = textBersih.split(/\r?\n/).filter((l) => l.trim().length > 0)
  if (lines.length === 0) return { error: 'CSV kosong' }

  const sel = lines.map(splitBarisCSV)
  const first = sel[0].map((s) => s.toLowerCase())
  const idx = (name: string) => first.indexOf(name)
  const iNik = idx('nik')
  const iTgl = idx('tanggal')
  const iTipe = idx('tipe')
  const iJam = idx('jam')
  const iWaktu = idx('waktu')
  const iDev = idx('deviceid')

  let dataRows = sel
  let map: (r: string[]) => BarisInput
  if (iNik >= 0 && (iTgl >= 0 || iTipe >= 0)) {
    // ada header — petakan sesuai nama kolom
    dataRows = sel.slice(1)
    map = (r) => ({
      nik: r[iNik],
      tanggal: iTgl >= 0 ? r[iTgl] : undefined,
      tipe: iTipe >= 0 ? r[iTipe] : undefined,
      jam: iJam >= 0 ? r[iJam] : undefined,
      waktu: iWaktu >= 0 ? r[iWaktu] : undefined,
      deviceId: iDev >= 0 ? r[iDev] : undefined,
    })
  } else {
    // tanpa header — urutan: nik,tanggal,tipe,jam
    map = (r) => ({ nik: r[0], tanggal: r[1], tipe: r[2], jam: r[3] })
  }
  return { baris: dataRows.map(map), format: 'csv' }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { namaFile?: string; isi?: string }
    const namaFile = (body?.namaFile ?? 'tanpa-nama').slice(0, 200)
    if (typeof body?.isi !== 'string' || body.isi.length === 0) {
      return NextResponse.json({ error: 'Isi file tidak ada' }, { status: 400 })
    }

    const parsed = parseIsi(body.isi)
    if ('error' in parsed) {
      return NextResponse.json({ error: `${parsed.error} — pastikan format sesuai contoh di layar` }, { status: 400 })
    }
    const { baris: rows, format } = parsed
    if (rows.length === 0) {
      return NextResponse.json({ error: 'Tidak ada baris transaksi di file' }, { status: 400 })
    }
    if (rows.length > MAKS_BARIS) {
      return NextResponse.json({ error: `Maksimal ${MAKS_BARIS} baris per file (file ini ${rows.length} baris)` }, { status: 400 })
    }

    // Batas jam masuk kantor (untuk hitung keterlambatan)
    const st = await db.setting.findUnique({ where: { key: 'jamMasuk' } })
    const batasMasuk = st?.value ?? '08:00'

    // Cache karyawan agar NIK yang sama tidak di-query berulang
    const cacheKaryawan = new Map<string, Awaited<ReturnType<typeof db.karyawan.findUnique>>>()

    let sukses = 0
    let duplikat = 0
    const gagal: GagalBaris[] = []

    for (let i = 0; i < rows.length; i++) {
      const noBaris = i + 1
      const r = rows[i]
      const identitas = r?.nik || r?.karyawanId || `baris ${noBaris}`

      try {
        const tipe = String(r?.tipe ?? '').trim().toUpperCase()
        if (tipe !== 'MASUK' && tipe !== 'KELUAR') {
          gagal.push({ baris: noBaris, identitas, pesan: 'Tipe harus MASUK atau KELUAR' })
          continue
        }

        // ── Cari karyawan ──
        const key = r?.nik?.trim() || r?.karyawanId?.trim() || ''
        if (!key) {
          gagal.push({ baris: noBaris, identitas, pesan: 'NIK kosong' })
          continue
        }
        let karyawan = cacheKaryawan.get(key)
        if (karyawan === undefined) {
          karyawan = await db.karyawan.findUnique({
            where: { nik: key },
            include: { dataWajah: true },
          })
          cacheKaryawan.set(key, karyawan)
        }
        if (!karyawan) {
          gagal.push({ baris: noBaris, identitas, pesan: 'NIK tidak ditemukan di data master' })
          continue
        }
        if (!karyawan.aktif) {
          gagal.push({ baris: noBaris, identitas, pesan: `Karyawan ${karyawan.nama} berstatus nonaktif` })
          continue
        }

        // ── Waktu transaksi ──
        let waktu: Date
        if (r?.waktu) {
          waktu = new Date(r.waktu)
          if (isNaN(waktu.getTime())) {
            gagal.push({ baris: noBaris, identitas, pesan: `waktu "${r.waktu}" tidak valid` })
            continue
          }
        } else {
          const tanggal = String(r?.tanggal ?? '').trim()
          const jam = String(r?.jam ?? '').trim()
          if (!RE_TANGGAL.test(tanggal)) {
            gagal.push({ baris: noBaris, identitas, pesan: `tanggal "${tanggal}" harus YYYY-MM-DD` })
            continue
          }
          if (!RE_JAM.test(jam)) {
            gagal.push({ baris: noBaris, identitas, pesan: `jam "${jam}" harus HH:mm atau HH:mm:ss` })
            continue
          }
          const jamLengkap = jam.length === 5 ? `${jam}:00` : jam
          waktu = new Date(`${tanggal}T${jamLengkap}+07:00`) // WIB
        }
        const tanggalAbsen = tanggalWIB(waktu)

        // ── Verifikasi descriptor bila baris menyertakannya ──
        let jarak: number | null = null
        if (r?.descriptor !== undefined && r?.descriptor !== null) {
          const desc = r.descriptor as unknown
          if (!Array.isArray(desc) || desc.length !== 128 || desc.some((v) => typeof v !== 'number')) {
            gagal.push({ baris: noBaris, identitas, pesan: 'Descriptor tidak valid (harus 128 angka)' })
            continue
          }
          if (!karyawan.dataWajah) {
            gagal.push({ baris: noBaris, identitas, pesan: `${karyawan.nama} belum mendaftarkan wajah — baris ber-descriptor tidak bisa diverifikasi` })
            continue
          }
          const sampel = JSON.parse(karyawan.dataWajah.sampelJson) as { descriptor: number[] }[]
          let min = Infinity
          for (const s of sampel) {
            const d = jarakDescriptor(desc as number[], s.descriptor)
            if (d < min) min = d
          }
          jarak = Number.isFinite(min) ? min : null
          if (jarak === null || jarak > AMBANG_MATCH_WAJAH) {
            gagal.push({ baris: noBaris, identitas, pesan: 'Wajah (descriptor) tidak cocok dengan pendaftaran — baris ditolak' })
            continue
          }
        }

        // ── Foto bukti (opsional) ──
        let fotoData: string | null = null
        if (typeof r?.foto === 'string' && r.foto.startsWith('data:image')) {
          try { fotoData = await simpanFoto(r.foto) } catch { fotoData = null }
        }

        const liveness = typeof r?.liveness === 'number' && r.liveness >= 0 && r.liveness <= 1 ? r.liveness : null
        const deviceId = r?.deviceId?.trim() || 'IMPORT'

        const existing = await db.absensi.findUnique({
          where: { karyawanId_tanggal: { karyawanId: karyawan.id, tanggal: tanggalAbsen } },
        })

        if (tipe === 'MASUK') {
          if (existing?.jamMasuk) {
            duplikat++
            continue
          }
          const { status, menitTerlambat } = statusKehadiran(waktu, batasMasuk)
          await db.absensi.upsert({
            where: { karyawanId_tanggal: { karyawanId: karyawan.id, tanggal: tanggalAbsen } },
            create: {
              karyawanId: karyawan.id, tanggal: tanggalAbsen, jamMasuk: waktu,
              fotoMasuk: fotoData, livenessMasuk: liveness, status, menitTerlambat, deviceId,
            },
            update: {
              jamMasuk: waktu, fotoMasuk: fotoData, livenessMasuk: liveness,
              status, menitTerlambat, deviceId,
            },
          })
        } else {
          if (existing?.jamKeluar) {
            duplikat++
            continue
          }
          const menitKerja = existing?.jamMasuk ? durasiKerja(existing.jamMasuk, waktu) : null
          await db.absensi.upsert({
            where: { karyawanId_tanggal: { karyawanId: karyawan.id, tanggal: tanggalAbsen } },
            create: {
              karyawanId: karyawan.id, tanggal: tanggalAbsen, jamKeluar: waktu,
              fotoKeluar: fotoData, livenessKeluar: liveness, deviceId,
              status: 'HADIR', menitKerja,
            },
            update: { jamKeluar: waktu, fotoKeluar: fotoData, livenessKeluar: liveness, menitKerja, deviceId },
          })
        }

        // Log audit
        await db.absensiLog.create({
          data: {
            karyawanId: karyawan.id, tipe, waktu, foto: fotoData, liveness,
            jarakWajah: jarak, deviceId, offlineSync: false,
          },
        })

        sukses++
      } catch (err) {
        console.error('upload baris', noBaris, err)
        gagal.push({ baris: noBaris, identitas, pesan: 'Gagal memproses baris ini' })
      }
    }

    await db.syncLog.create({
      data: {
        deviceId: 'IMPORT-FILE',
        jumlah: rows.length,
        status: sukses + duplikat === rows.length ? 'SUKSES' : sukses > 0 ? 'SEBAGIAN' : 'GAGAL',
        pesan: `${namaFile}: ${sukses} baru, ${duplikat} duplikat, ${gagal.length} gagal`,
      },
    })

    return NextResponse.json({
      ok: true,
      namaFile,
      format,
      total: rows.length,
      sukses,
      duplikat,
      gagal,
    })
  } catch (e) {
    console.error('POST /api/transaksi/upload', e)
    return NextResponse.json({ error: 'Gagal mengunggah transaksi' }, { status: 500 })
  }
}
