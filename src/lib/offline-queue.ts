// Antrean offline — transaksi absensi disimpan di HP (localStorage)
// saat sinyal hilang, lalu otomatis diunggah ke web saat online.
import type { TransaksiAbsen } from './types'

const KEY = 'absensi-antrean'
const KEY_MASTER = 'absensi-master-karyawan'
const KEY_DEVICE = 'absensi-device-id'

export function deviceId(): string {
  if (typeof window === 'undefined') return 'server'
  let id = localStorage.getItem(KEY_DEVICE)
  if (!id) {
    id = `HP-${Math.random().toString(36).slice(2, 8).toUpperCase()}`
    localStorage.setItem(KEY_DEVICE, id)
  }
  return id
}

export interface EntriAntrean extends TransaksiAbsen {
  lokalId: string
  disimpanPada: string
}

export function bacaAntrean(): EntriAntrean[] {
  if (typeof window === 'undefined') return []
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]') as EntriAntrean[]
  } catch {
    return []
  }
}

export function tambahAntrean(tr: TransaksiAbsen): EntriAntrean {
  const entri: EntriAntrean = {
    ...tr,
    lokalId: `L-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    disimpanPada: new Date().toISOString(),
  }
  const antrean = bacaAntrean()
  antrean.push(entri)
  localStorage.setItem(KEY, JSON.stringify(antrean))
  return entri
}

export function hapusDariAntrean(lokalId: string) {
  const sisa = bacaAntrean().filter((e) => e.lokalId !== lokalId)
  localStorage.setItem(KEY, JSON.stringify(sisa))
  return sisa
}

export function simpanAntrean(antrean: EntriAntrean[]) {
  localStorage.setItem(KEY, JSON.stringify(antrean))
}

/** Sinkronkan seluruh antrean ke web. Return jumlah sukses. */
export async function sinkronAntrean(): Promise<{ sukses: number; total: number; gagal: string[] }> {
  const antrean = bacaAntrean()
  if (antrean.length === 0) return { sukses: 0, total: 0, gagal: [] }
  const gagal: string[] = []
  let sukses = 0
  // kirim satu per satu agar transaksi gagal tidak ikut hilang
  for (const e of antrean) {
    try {
      const res = await fetch('/api/absensi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...e, offlineSync: true }),
      })
      if (res.ok) {
        sukses++
        hapusDariAntrean(e.lokalId)
      } else {
        const err = await res.json().catch(() => ({}))
        // penolakan bisnis (wajah tak cocok dsb.) → buang dari antrean
        if (res.status === 422) {
          hapusDariAntrean(e.lokalId)
          gagal.push(err.error ?? 'Ditolak server')
        } else {
          gagal.push(err.error ?? 'Gagal mengunggah')
        }
      }
    } catch {
      gagal.push('Tidak ada koneksi')
      break // masih offline — hentikan percobaan
    }
  }
  return { sukses, total: antrean.length, gagal }
}

// ── Master data karyawan cache di HP (untuk verifikasi offline) ──
export interface MasterKaryawan {
  id: string
  nik: string
  nama: string
  jabatan: string
  departemen: string
  aktif: boolean
  wajah: { sampel: { descriptor: number[] }[] } | null
}

export function simpanMaster(karyawan: MasterKaryawan[]) {
  localStorage.setItem(KEY_MASTER, JSON.stringify({ waktu: Date.now(), karyawan }))
}

export function bacaMaster(): { waktu: number; karyawan: MasterKaryawan[] } | null {
  if (typeof window === 'undefined') return null
  try {
    const v = JSON.parse(localStorage.getItem(KEY_MASTER) ?? 'null')
    return v
  } catch {
    return null
  }
}

/**
 * Verifikasi wajah 1:1 OFFLINE — bandingkan descriptor hasil scan dengan
 * sampel pendaftaran SATU karyawan tertentu (yang dipilih di menu absen).
 */
export function verifikasiLokal(karyawanId: string, descriptor: number[]): { ok: boolean; jarak: number | null } {
  const master = bacaMaster()
  if (!master) return { ok: false, jarak: null }
  const k = master.karyawan.find((x) => x.id === karyawanId)
  if (!k || !k.wajah || k.wajah.sampel.length === 0) return { ok: false, jarak: null }
  let min = Infinity
  for (const s of k.wajah.sampel) {
    const d = jarakLokal(descriptor, s.descriptor)
    if (d < min) min = d
  }
  return { ok: Number.isFinite(min) && min <= 0.55, jarak: Number.isFinite(min) ? min : null }
}

function jarakLokal(a: number[], b: number[]): number {
  if (!a || !b || a.length !== b.length) return Infinity
  let sum = 0
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i]
    sum += d * d
  }
  return Math.sqrt(sum)
}
