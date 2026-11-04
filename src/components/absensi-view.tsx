'use client'

// ─────────────────────────────────────────────────────────────
// Halaman Absensi — ALUR BARU (revisi user):
// 1) WAJIB pilih NAMA/NIK karyawan terlebih dahulu
// 2) Pilih Absen Masuk / Absen Keluar (dengan info status hari ini)
// 3) Scan wajah + validasi liveness SATU gerakan acak (tengok kanan/kiri)
// 4) Verifikasi wajah 1:1 terhadap karyawan terpilih
//    (online: server memverifikasi vs database wajah web;
//     offline: verifikasi lokal vs master data yang diunduh)
// Hasil langsung terunggah ke web; saat sinyal hilang masuk antrean
// offline dan otomatis terunggah saat koneksi kembali.
// ─────────────────────────────────────────────────────────────
import { useCallback, useEffect, useState } from 'react'
import { FaceScanner, type HasilVerifikasi } from '@/components/face-scanner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import {
  LogIn, LogOut, Wifi, WifiOff, CloudUpload, History, UserCheck, Clock,
  Search, ScanFace, ArrowLeft, UserRound,
} from 'lucide-react'
import {
  tambahAntrean, bacaAntrean, sinkronAntrean, deviceId, verifikasiLokal, bacaMaster,
  type EntriAntrean,
} from '@/lib/offline-queue'
import { tanggalWIB, jamMenitWIB } from '@/lib/absensi-utils'
import type { HasilAbsen, KaryawanDTO } from '@/lib/types'

type Mode = 'masuk' | 'keluar' | null
type Tahap = 'pilih' | 'mode' | 'scan' | 'hasil'

interface StatusHariIni {
  jamMasuk: string | null // HH:mm WIB
  jamKeluar: string | null
}

export function AbsensiView({
  onSyncChange,
  onKeDaftarWajah,
}: {
  onSyncChange?: (antrean: number) => void
  onKeDaftarWajah?: () => void
}) {
  const [tahap, setTahap] = useState<Tahap>('pilih')
  const [mode, setMode] = useState<Mode>(null)
  const [daftar, setDaftar] = useState<KaryawanDTO[]>([])
  const [cari, setCari] = useState('')
  const [pilih, setPilih] = useState<KaryawanDTO | null>(null)
  const [statusHariIni, setStatusHariIni] = useState<StatusHariIni | null>(null)
  const [hasil, setHasil] = useState<HasilAbsen | null>(null)
  const [riwayat, setRiwayat] = useState<HasilAbsen[]>([])
  const [offline, setOffline] = useState(false)
  const [antrean, setAntrean] = useState<EntriAntrean[]>([])
  const [sinkron, setSinkron] = useState(false)
  const [jam, setJam] = useState('')

  const perbaruiAntrean = useCallback(() => {
    setAntrean(bacaAntrean())
    onSyncChange?.(bacaAntrean().length)
  }, [onSyncChange])

  // jam realtime WIB
  useEffect(() => {
    const fmt = () =>
      setJam(new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(new Date()))
    fmt()
    const t = setInterval(fmt, 1000)
    return () => clearInterval(t)
  }, [])

  // daftar karyawan aktif untuk dipilih
  useEffect(() => {
    fetch('/api/karyawan')
      .then((r) => r.json())
      .then((d) => setDaftar(Array.isArray(d) ? d.filter((k: KaryawanDTO) => k.aktif) : []))
      .catch(() => toast.error('Gagal memuat daftar karyawan'))
  }, [])

  // status online + auto-sync antrean offline
  useEffect(() => {
    // tunda 1 tick agar tidak memicu setState sinkron di dalam effect
    const t = setTimeout(() => {
      perbaruiAntrean()
      setOffline(!navigator.onLine)
    }, 0)
    const upd = () => setOffline(!navigator.onLine)
    window.addEventListener('online', upd)
    window.addEventListener('offline', upd)
    const sinkronOtomatis = async () => {
      if (!navigator.onLine || bacaAntrean().length === 0) return
      setSinkron(true)
      const r = await sinkronAntrean()
      setSinkron(false)
      perbaruiAntrean()
      if (r.sukses > 0) toast.success(`${r.sukses} transaksi offline terunggah ke web`)
      if (r.gagal.length > 0) toast.error(`Sebagian gagal: ${r.gagal[0]}`)
    }
    const iv = setInterval(() => void sinkronOtomatis(), 20000)
    if (navigator.onLine) void sinkronOtomatis()
    window.addEventListener('online', () => void sinkronOtomatis())
    return () => {
      clearTimeout(t)
      window.removeEventListener('online', upd)
      window.removeEventListener('offline', upd)
      clearInterval(iv)
    }
  }, [perbaruiAntrean])

  // ── Langkah 1: pilih karyawan (wajib sebelum scan) ──
  const pilihKaryawan = useCallback(async (k: KaryawanDTO) => {
    if (!k.aktif) {
      toast.error('Karyawan nonaktif tidak bisa absen')
      return
    }
    if (!k.terdaftarWajah) {
      toast.error(`Wajah ${k.nama} belum terdaftar — buka menu "Daftar Wajah" dulu`)
      return
    }
    setPilih(k)
    setStatusHariIni(null)
    setTahap('mode')
    try {
      const res = await fetch(`/api/absensi?tanggal=${tanggalWIB(new Date())}`)
      const data = await res.json()
      const baris = (data.data ?? []).find((d: { karyawanId: string }) => d.karyawanId === k.id)
      setStatusHariIni({
        jamMasuk: baris?.jamMasuk ? jamMenitWIB(baris.jamMasuk) : null,
        jamKeluar: baris?.jamKeluar ? jamMenitWIB(baris.jamKeluar) : null,
      })
    } catch {
      setStatusHariIni(null) // gagal cek — biarkan server yang menolak duplikat
    }
  }, [])

  // ── Langkah 3: kirim hasil verifikasi (1:1) ke web ──
  const kirimAbsen = useCallback(
    async (tipe: 'MASUK' | 'KELUAR', foto: string, descriptor: number[]) => {
      if (!pilih) return
      const tr = {
        karyawanId: pilih.id,
        tipe,
        foto,
        descriptor,
        liveness: 1,
        deviceId: deviceId(),
        waktu: new Date().toISOString(),
        offlineSync: false,
      }
      const antrekanOffline = (alasan: string) => {
        tambahAntrean({ ...tr, offlineSync: true })
        perbaruiAntrean()
        setHasil({
          ok: true, nama: pilih.nama, nik: pilih.nik, tipe, tanggal: '',
          status: 'HADIR', jarakWajah: null, pesan: alasan,
        })
        setTahap('hasil')
      }

      if (!navigator.onLine) {
        const cek = verifikasiLokal(pilih.id, descriptor)
        if (!cek.ok) {
          toast.error(
            bacaMaster()
              ? `Wajah tidak cocok dengan ${pilih.nama} (cek offline)`
              : 'Mode offline: unduh "Data Master" dulu di menu Laporan'
          )
          setTahap('mode')
          return
        }
        antrekanOffline('Tidak ada koneksi — transaksi disimpan di HP dan otomatis terunggah ke web saat online.')
        return
      }

      try {
        const res = await fetch('/api/absensi', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(tr),
        })
        const data = await res.json()
        if (res.ok) {
          setHasil(data as HasilAbsen)
          setRiwayat((r) => [data as HasilAbsen, ...r].slice(0, 5))
          setTahap('hasil')
          toast.success(data.pesan)
        } else {
          toast.error(data.error ?? 'Absensi ditolak')
          setTahap('mode') // karyawan tetap terpilih — bisa coba scan ulang
        }
      } catch {
        // jaringan terputus di tengah proses → verifikasi lokal lalu antrekan
        const cek = verifikasiLokal(pilih.id, descriptor)
        if (cek.ok) {
          antrekanOffline('Koneksi terputus — transaksi disimpan di HP dan otomatis terunggah ke web saat online.')
        } else {
          toast.error('Koneksi terputus & verifikasi offline gagal — coba lagi saat online')
          setTahap('mode')
        }
      }
    },
    [pilih, perbaruiAntrean]
  )

  const onVerifikasi = useCallback(
    ({ descriptor, foto }: HasilVerifikasi) => {
      void kirimAbsen(mode === 'masuk' ? 'MASUK' : 'KELUAR', foto, descriptor)
    },
    [mode, kirimAbsen]
  )

  const ulang = () => {
    setMode(null)
    setHasil(null)
    setPilih(null)
    setTahap('pilih')
  }

  const sinkronSekarang = async () => {
    setSinkron(true)
    const r = await sinkronAntrean()
    setSinkron(false)
    perbaruiAntrean()
    if (r.sukses > 0) toast.success(`${r.sukses}/${r.total} transaksi terunggah ke web`)
    else if (r.gagal.length) toast.error(r.gagal[0])
    else toast.info('Antrean kosong')
  }

  const terfilter = daftar.filter(
    (k) =>
      k.nama.toLowerCase().includes(cari.toLowerCase()) ||
      k.nik.toLowerCase().includes(cari.toLowerCase())
  )

  return (
    <div className="space-y-4">
      {/* jam & status koneksi */}
      <div className="flex items-center justify-between rounded-xl border bg-card px-4 py-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="h-4 w-4 text-emerald-600" />
          <span className="font-mono text-lg font-bold text-foreground">{jam}</span>
          <span className="text-xs">WIB</span>
        </div>
        <div className="flex items-center gap-2">
          {offline ? (
            <Badge variant="outline" className="gap-1 border-amber-500 text-amber-600">
              <WifiOff className="h-3 w-3" /> Offline
            </Badge>
          ) : (
            <Badge variant="outline" className="gap-1 border-emerald-500 text-emerald-600">
              <Wifi className="h-3 w-3" /> Terhubung
            </Badge>
          )}
          {antrean.length > 0 && (
            <Button size="sm" variant="secondary" onClick={sinkronSekarang} disabled={sinkron} className="gap-1">
              <CloudUpload className="h-3.5 w-3.5" />
              {sinkron ? 'Mengunggah…' : `Unggah ${antrean.length}`}
            </Button>
          )}
        </div>
      </div>

      {/* ── TAHAP 1: pilih nama/NIK (wajib) ── */}
      {tahap === 'pilih' && (
        <Card>
          <CardContent className="space-y-3 p-4">
            <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
              <ScanFace className="h-4 w-4 shrink-0" />
              Pilih <strong>nama / NIK</strong> Anda terlebih dahulu, lalu ikuti perintah gerakan (tengok kanan/kiri) di kamera.
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Cari nama atau NIK…"
                value={cari}
                onChange={(e) => setCari(e.target.value)}
                className="pl-9"
                aria-label="Cari karyawan berdasarkan nama atau NIK"
              />
            </div>
            <div className="max-h-96 space-y-2 overflow-y-auto pr-1 scrollbar-thin">
              {terfilter.length === 0 && (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  {daftar.length === 0 ? 'Belum ada karyawan aktif. Tambahkan di menu Karyawan.' : 'Tidak ditemukan.'}
                </p>
              )}
              {terfilter.map((k) => (
                <div
                  key={k.id}
                  className={`flex items-center justify-between gap-2 rounded-xl border p-3 transition ${
                    k.terdaftarWajah ? 'hover:border-emerald-400 hover:bg-emerald-50/50' : 'opacity-60'
                  }`}
                >
                  <button
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                    onClick={() => void pilihKaryawan(k)}
                    aria-label={`Pilih ${k.nama} (NIK ${k.nik})`}
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                      <UserRound className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{k.nama}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        NIK {k.nik} · {k.jabatan} · {k.departemen}
                      </p>
                    </div>
                  </button>
                  {k.terdaftarWajah ? (
                    <Badge variant="outline" className="shrink-0 gap-1 border-emerald-500 text-emerald-600">
                      <ScanFace className="h-3 w-3" /> wajah ✓
                    </Badge>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      className="shrink-0 h-7 text-xs"
                      onClick={onKeDaftarWajah}
                    >
                      Daftar wajah
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── TAHAP 2: pilih masuk/keluar + status hari ini ── */}
      {tahap === 'mode' && pilih && (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2 rounded-xl border bg-card px-4 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{pilih.nama}</p>
              <p className="text-xs text-muted-foreground">
                NIK {pilih.nik} · {pilih.jabatan}
              </p>
            </div>
            <Button size="sm" variant="ghost" onClick={() => { setPilih(null); setTahap('pilih') }} className="gap-1 shrink-0">
              <ArrowLeft className="h-3.5 w-3.5" /> Ganti
            </Button>
          </div>

          <Card>
            <CardContent className="p-4">
              <p className="mb-3 text-center text-xs text-muted-foreground">
                {statusHariIni === null
                  ? 'Status hari ini tidak dapat diperiksa — server tetap memvalidasi.'
                  : !statusHariIni.jamMasuk
                    ? 'Anda belum absen masuk hari ini.'
                    : !statusHariIni.jamKeluar
                      ? `Masuk pukul ${statusHariIni.jamMasuk} — jangan lupa absen keluar.`
                      : `Absensi hari ini sudah lengkap (masuk ${statusHariIni.jamMasuk}, keluar ${statusHariIni.jamKeluar}).`}
              </p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => { setMode('masuk'); setTahap('scan') }}
                  disabled={statusHariIni?.jamMasuk != null}
                  className="group flex flex-col items-center gap-3 rounded-2xl border-2 border-emerald-200 bg-emerald-50 p-6 text-center transition hover:border-emerald-500 hover:shadow-md active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <span className="rounded-full bg-emerald-600 p-4 text-white shadow-lg transition group-hover:scale-110">
                    <LogIn className="h-7 w-7" />
                  </span>
                  <span className="text-base font-bold text-emerald-900">Absen Masuk</span>
                  <span className="text-xs text-emerald-700">Scan wajah + tengok kanan/kiri</span>
                </button>
                <button
                  onClick={() => { setMode('keluar'); setTahap('scan') }}
                  disabled={statusHariIni?.jamKeluar != null}
                  className="group flex flex-col items-center gap-3 rounded-2xl border-2 border-amber-200 bg-amber-50 p-6 text-center transition hover:border-amber-500 hover:shadow-md active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <span className="rounded-full bg-amber-600 p-4 text-white shadow-lg transition group-hover:scale-110">
                    <LogOut className="h-7 w-7" />
                  </span>
                  <span className="text-base font-bold text-amber-900">Absen Keluar</span>
                  <span className="text-xs text-amber-700">Jam kerja dihitung otomatis</span>
                </button>
              </div>
            </CardContent>
          </Card>

          {riwayat.length > 0 && (
            <Card>
              <CardContent className="p-4">
                <p className="mb-2 flex items-center gap-1.5 text-sm font-medium">
                  <History className="h-4 w-4 text-muted-foreground" /> Absensi terakhir di perangkat ini
                </p>
                <ul className="space-y-1.5">
                  {riwayat.map((h, i) => (
                    <li key={i} className="flex items-center justify-between rounded-lg bg-muted/60 px-3 py-2 text-sm">
                      <span className="font-medium">{h.nama}</span>
                      <span className="text-xs text-muted-foreground">
                        {h.tipe === 'MASUK' ? 'Masuk' : 'Keluar'} · {h.jamMasuk ?? h.jamKeluar ?? ''}
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ── TAHAP 3: scan wajah + liveness kanan/kiri ── */}
      {tahap === 'scan' && mode && pilih && (
        <div className="space-y-3">
          <div className="flex items-center justify-center gap-2">
            <Badge className={mode === 'masuk' ? 'bg-emerald-600 gap-1' : 'bg-amber-600 gap-1'}>
              {mode === 'masuk' ? <LogIn className="h-3 w-3" /> : <LogOut className="h-3 w-3" />}
              {mode === 'masuk' ? 'Absen Masuk' : 'Absen Keluar'} — {pilih.nama}
            </Badge>
          </div>
          <FaceScanner mode="verifikasi" onVerifikasi={onVerifikasi} onCancel={() => setTahap('mode')} />
        </div>
      )}

      {/* ── TAHAP 4: hasil ── */}
      {tahap === 'hasil' && hasil && (
        <Card className="mx-auto max-w-md border-emerald-200">
          <CardContent className="flex flex-col items-center gap-3 p-6 text-center">
            <span className="rounded-full bg-emerald-100 p-4 text-emerald-700">
              <UserCheck className="h-8 w-8" />
            </span>
            <p className="text-lg font-bold">{hasil.nama}</p>
            <p className="text-sm text-muted-foreground">{hasil.pesan}</p>
            {hasil.tanggal && (
              <div className="w-full rounded-xl bg-muted p-3 text-sm">
                <div className="flex justify-between py-0.5">
                  <span className="text-muted-foreground">Tanggal</span>
                  <span className="font-medium">{hasil.tanggal}</span>
                </div>
                {hasil.jamMasuk && (
                  <div className="flex justify-between py-0.5">
                    <span className="text-muted-foreground">Jam masuk</span>
                    <span className="font-medium">{hasil.jamMasuk}</span>
                  </div>
                )}
                {hasil.jamKeluar && (
                  <div className="flex justify-between py-0.5">
                    <span className="text-muted-foreground">Jam keluar</span>
                    <span className="font-medium">{hasil.jamKeluar}</span>
                  </div>
                )}
                {hasil.menitKerja != null && (
                  <div className="flex justify-between py-0.5">
                    <span className="text-muted-foreground">Total kerja</span>
                    <span className="font-semibold text-emerald-700">
                      {Math.floor(hasil.menitKerja / 60)} jam {hasil.menitKerja % 60} mnt
                    </span>
                  </div>
                )}
                <div className="flex justify-between py-0.5">
                  <span className="text-muted-foreground">Status</span>
                  <Badge variant={hasil.status === 'TERLAMBAT' ? 'destructive' : 'default'} className="h-5">
                    {hasil.status}
                  </Badge>
                </div>
              </div>
            )}
            <Button onClick={ulang} className="w-full bg-emerald-600 hover:bg-emerald-700">
              Selesai
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
