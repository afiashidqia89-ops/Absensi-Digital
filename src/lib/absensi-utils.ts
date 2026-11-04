// Util waktu & jam kerja — zona waktu WIB (Asia/Jakarta)

export const TZ_WIB = 'Asia/Jakarta'

/** Format tanggal ke YYYY-MM-DD dalam WIB */
export function tanggalWIB(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ_WIB,
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(date)
}

/** Format jam HH:mm:ss dalam WIB */
export function jamWIB(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: TZ_WIB,
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  }).format(date)
}

/** Jam HH:mm dalam WIB */
export function jamMenitWIB(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ_WIB,
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(date)
}

/** Menit sejak tengah malam WIB (untuk hitung keterlambatan) */
export function menitHariWIB(d: Date | string): number {
  const date = typeof d === 'string' ? new Date(d) : d
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ_WIB, hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(date)
  const jam = parseInt(parts.find((p) => p.type === 'hour')?.value ?? '0', 10)
  const menit = parseInt(parts.find((p) => p.type === 'minute')?.value ?? '0', 10)
  return jam * 60 + menit
}

/** Nama hari & tanggal panjang Indonesia */
export function tanggalPanjang(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: TZ_WIB, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  }).format(date)
}

export const DEFAULT_JAM_MASUK = '08:00'
export const DEFAULT_JAM_KELUAR = '17:00'

/** "08:00" → 480 menit */
export function parseJamMenit(s: string): number {
  const [j, m] = s.split(':').map((v) => parseInt(v, 10))
  return (j || 0) * 60 + (m || 0)
}

/** Hitung status & keterlambatan berdasarkan jam masuk kantor */
export function statusKehadiran(jamMasuk: Date, batasMasuk: string): { status: 'HADIR' | 'TERLAMBAT'; menitTerlambat: number } {
  const batas = parseJamMenit(batasMasuk)
  const actual = menitHariWIB(jamMasuk)
  const selisih = actual - batas
  return {
    status: selisih > 15 ? 'TERLAMBAT' : 'HADIR', // toleransi 15 menit
    menitTerlambat: Math.max(0, selisih),
  }
}

/** Durasi kerja menit dari jamMasuk→jamKeluar */
export function durasiKerja(masuk: Date, keluar: Date): number {
  return Math.max(0, Math.round((keluar.getTime() - masuk.getTime()) / 60000))
}

/** 515 → "8 jam 35 mnt" */
export function formatDurasi(menit: number | null | undefined): string {
  if (menit == null) return '—'
  const j = Math.floor(menit / 60)
  const m = menit % 60
  if (j === 0) return `${m} mnt`
  return m === 0 ? `${j} jam` : `${j} jam ${m} mnt`
}

/** Range tanggal N hari terakhir (inklusif) sebagai [dari, sampai] YYYY-MM-DD WIB */
export function rangeHariIni(): [string, string] {
  const kini = tanggalWIB(new Date())
  return [kini, kini]
}

export function tanggalMinDariN(n: number): string {
  const d = new Date(Date.now() - n * 86400000)
  return tanggalWIB(d)
}
