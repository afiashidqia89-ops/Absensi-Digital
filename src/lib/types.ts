// Types bersama client ↔ server

export interface SampelWajah {
  descriptor: number[]
  foto: string // dataURL atau path publik
}

export interface DataWajahDTO {
  jumlahSampel: number
  sampel: { descriptor: number[]; foto: string }[]
  updatedAt?: string
}

export interface KaryawanDTO {
  id: string
  nik: string
  nama: string
  jabatan: string
  departemen: string
  telepon?: string | null
  aktif: boolean
  terdaftarWajah: boolean
  dataWajah?: { jumlahSampel: number } | null
  createdAt?: string
}

export interface TransaksiAbsen {
  karyawanId: string
  tipe: 'MASUK' | 'KELUAR'
  foto?: string
  liveness?: number
  descriptor?: number[]
  deviceId?: string
  waktu?: string // ISO timestamp dari HP (untuk antrean offline)
  offlineSync?: boolean
}

export interface HasilAbsen {
  ok: true
  nama: string
  nik: string
  tipe: 'MASUK' | 'KELUAR'
  tanggal: string
  jamMasuk?: string
  jamKeluar?: string
  menitKerja?: number | null
  status: string
  jarakWajah: number | null
  pesan: string
}

export interface BarisRekap {
  tanggal: string
  karyawanId: string
  nik: string
  nama: string
  departemen: string
  jamMasuk: string | null
  jamKeluar: string | null
  menitKerja: number | null
  durasi: string
  status: string
  menitTerlambat: number
  livenessMasuk: number | null
}

export interface RingkasanKaryawan {
  karyawanId: string
  nik: string
  nama: string
  departemen: string
  hariHadir: number
  hariTerlambat: number
  totalMenit: number
  rataRataMenit: number
}

export interface DashboardDTO {
  totalKaryawan: number
  terdaftarWajah: number
  hadirHariIni: number
  terlambatHariIni: number
  belumAbsen: number
  sedangBekerja: number
  logTerbaru: {
    id: string
    nama: string
    tipe: string
    waktu: string
    foto?: string | null
  }[]
  rekap7Hari: { tanggal: string; hadir: number; terlambat: number }[]
  jamKantor: { masuk: string; keluar: string }
}
