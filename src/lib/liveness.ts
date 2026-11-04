// ─────────────────────────────────────────────────────────────
// Engine LIVENESS — tantangan gerakan acak agar absensi hanya
// bisa dilakukan wajah asli (bukan foto cetak / rekaman).
// SESUAI PERMINTAAN: validasi cukup dengan SATU gerakan acak —
// tengok kepala ke KANAN atau ke KIRI saja.
// ─────────────────────────────────────────────────────────────
import type { HasilDeteksi } from './face-engine'

export type TipeTantangan =
  | 'KEDIP'
  | 'SENYUM'
  | 'BUKA_MULUT'
  | 'TENGGOK_KIRI'
  | 'TENGGOK_KANAN'
  | 'MAJUKAN'

export interface Tantangan {
  tipe: TipeTantangan
  instruksi: string
  ikon: string
}

const POOL: Record<TipeTantangan, Omit<Tantangan, 'tipe'>> = {
  KEDIP: { instruksi: 'Kedipkan mata 2 kali', ikon: '😌' },
  SENYUM: { instruksi: 'Tersenyumlah lebar', ikon: '😀' },
  BUKA_MULUT: { instruksi: 'Buka mulut lebar-lebar', ikon: '😮' },
  TENGGOK_KIRI: { instruksi: 'Tengok kepala ke kiri', ikon: '⬅️' },
  TENGGOK_KANAN: { instruksi: 'Tengok kepala ke kanan', ikon: '➡️' },
  MAJUKAN: { instruksi: 'Dekatkan wajah ke kamera', ikon: '🤳' },
}

/**
 * Susun sesi tantangan: SATU gerakan acak saja — tengok KANAN atau KIRI.
 * Foto cetak tidak bisa mengikuti perintah gerakan → selalu gagal.
 */
export function buatSesiTantangan(): Tantangan[] {
  const arah: TipeTantangan[] = ['TENGGOK_KANAN', 'TENGGOK_KIRI']
  const pilih = arah[Math.floor(Math.random() * arah.length)]
  return [{ tipe: pilih, ...POOL[pilih] }]
}

interface StateTantangan {
  baselineEar: number[]
  baselineArea: number[]
  fase: 'awal' | 'aksi' // untuk KEDIP: awal (menunggu mata tertutup) → aksi (membuka kembali)
  mataTertutup: boolean
  frameAksi: number
  frame: number
}

export interface HasilProses {
  selesai: boolean
  indexAktif: number
  tantanganAktif: Tantangan | null
  progress: number // 0..1 keseluruhan sesi
  progressAntar: number[] // progress per tantangan
  gagal: boolean
  pesan: string
}

const TIMEOUT_MS = 9000

/**
 * Mesin status liveness: proses tiap frame deteksi, maju tantangan
 * ketika gerakan terverifikasi. Foto cetak tidak bisa kedip, senyum,
 * buka mulut, atau bergerak mengikuti perintah → selalu gagal.
 */
export class EvaluatorLiveness {
  sesi: Tantangan[]
  index = 0
  waktuMulaiTantangan = 0
  percobaanUlang = 0
  state: StateTantangan
  progressAntar: number[]

  constructor(sesi: Tantangan[]) {
    this.sesi = sesi
    this.progressAntar = sesi.map(() => 0)
    this.state = this.stateBaru()
    this.waktuMulaiTantangan = Date.now()
  }

  private stateBaru(): StateTantangan {
    return { baselineEar: [], baselineArea: [], fase: 'awal', mataTertutup: false, frameAksi: 0, frame: 0 }
  }

  get tantanganAktif(): Tantangan | null {
    return this.index < this.sesi.length ? this.sesi[this.index] : null
  }

  get progress(): number {
    const perTantangan = 1 / this.sesi.length
    return Math.min(1, this.index * perTantangan + this.progressAntar[this.index] * perTantangan)
  }

  /** Reset tantangan aktif (timeout) */
  private resetTantangan(gagal: boolean): HasilProses {
    this.percobaanUlang++
    this.state = this.stateBaru()
    this.waktuMulaiTantangan = Date.now()
    this.progressAntar[this.index] = 0
    if (this.percobaanUlang >= 3) {
      return {
        selesai: true, gagal: true, indexAktif: this.index,
        tantanganAktif: this.tantanganAktif, progress: this.progress,
        progressAntar: this.progressAntar,
        pesan: 'Verifikasi keaslian wajah gagal. Pastikan Anda berada di depan kamera (bukan foto), lalu coba lagi.',
      }
    }
    return {
      selesai: false, gagal, indexAktif: this.index, tantanganAktif: this.tantanganAktif,
      progress: this.progress, progressAntar: this.progressAntar,
      pesan: 'Waktu habis — ulangi gerakan',
    }
  }

  private maju(): HasilProses {
    this.progressAntar[this.index] = 1
    this.index++
    this.percobaanUlang = 0
    if (this.index >= this.sesi.length) {
      return {
        selesai: true, gagal: false, indexAktif: this.index, tantanganAktif: null,
        progress: 1, progressAntar: this.progressAntar,
        pesan: 'Verifikasi wajah asli berhasil',
      }
    }
    this.state = this.stateBaru()
    this.waktuMulaiTantangan = Date.now()
    return {
      selesai: false, gagal: false, indexAktif: this.index, tantanganAktif: this.tantanganAktif,
      progress: this.progress, progressAntar: this.progressAntar, pesan: 'Bagus! Lanjut gerakan berikutnya',
    }
  }

  proses(det: HasilDeteksi): HasilProses {
    const t = this.tantanganAktif
    if (!t) {
      return { selesai: true, gagal: false, indexAktif: this.index, tantanganAktif: null, progress: 1, progressAntar: this.progressAntar, pesan: 'Selesai' }
    }

    // Timeout tantangan
    if (Date.now() - this.waktuMulaiTantangan > TIMEOUT_MS) return this.resetTantangan(false)

    if (!det.terdeteksi) {
      // wajah hilang dari frame — timer tetap jalan
      return {
        selesai: false, gagal: false, indexAktif: this.index, tantanganAktif: t,
        progress: this.progress, progressAntar: this.progressAntar, pesan: 'Wajah tidak terlihat, hadap kamera',
      }
    }

    const st = this.state
    st.frame++

    switch (t.tipe) {
      case 'KEDIP': {
        // Ambil baseline EAR saat mulai, lalu deteksi siklus tutup→buka
        if (st.baselineEar.length < 5) {
          st.baselineEar.push(det.ear)
          this.progressAntar[this.index] = 0.1
          break
        }
        const base = st.baselineEar.reduce((a, b) => a + b, 0) / st.baselineEar.length
        if (st.fase === 'awal') {
          if (det.ear < base * 0.72) {
            st.mataTertutup = true
            this.progressAntar[this.index] = 0.5
          }
          if (st.mataTertutup && det.ear > base * 0.9) {
            st.fase = 'aksi'
            st.frameAksi = 0
          }
        } else {
          // fase aksi: satu kedipan lagi
          if (det.ear < base * 0.72) {
            st.mataTertutup = true
            this.progressAntar[this.index] = 0.8
          }
          if (st.mataTertutup && det.ear > base * 0.9) {
            return this.maju()
          }
        }
        break
      }

      case 'SENYUM': {
        if (det.happy > 0.62) {
          st.frameAksi++
          this.progressAntar[this.index] = Math.min(0.9, st.frameAksi / 4)
          if (st.frameAksi >= 3) return this.maju()
        } else {
          st.frameAksi = Math.max(0, st.frameAksi - 1)
          this.progressAntar[this.index] = Math.min(0.4, st.frameAksi / 4)
        }
        break
      }

      case 'BUKA_MULUT': {
        if (det.bukaanMulut > 0.22) {
          st.frameAksi++
          this.progressAntar[this.index] = Math.min(0.9, st.frameAksi / 4)
          if (st.frameAksi >= 3) return this.maju()
        } else {
          this.progressAntar[this.index] = Math.min(0.3, this.progressAntar[this.index])
        }
        break
      }

      case 'TENGGOK_KIRI': {
        // frame mentah tanpa mirror: user nengok KIRI → hidung bergeser ke KANAN frame
        if (det.noseRatio > 0.58) {
          st.frameAksi++
          this.progressAntar[this.index] = Math.min(0.9, st.frameAksi / 4)
          if (st.frameAksi >= 3) return this.maju()
        }
        break
      }

      case 'TENGGOK_KANAN': {
        // frame mentah tanpa mirror: user nengok KANAN → hidung bergeser ke KIRI frame
        if (det.noseRatio < 0.42) {
          st.frameAksi++
          this.progressAntar[this.index] = Math.min(0.9, st.frameAksi / 4)
          if (st.frameAksi >= 3) return this.maju()
        }
        break
      }

      case 'MAJUKAN': {
        if (st.baselineArea.length < 5) {
          st.baselineArea.push(det.areaRatio)
          this.progressAntar[this.index] = 0.1
          break
        }
        const base = st.baselineArea.reduce((a, b) => a + b, 0) / st.baselineArea.length
        const naik = det.areaRatio / Math.max(base, 1e-6)
        if (naik > 1.25) {
          st.frameAksi++
          this.progressAntar[this.index] = Math.min(0.9, st.frameAksi / 4)
          if (st.frameAksi >= 3) return this.maju()
        }
        break
      }
    }

    return {
      selesai: false, gagal: false, indexAktif: this.index, tantanganAktif: t,
      progress: this.progress, progressAntar: this.progressAntar, pesan: '',
    }
  }
}
