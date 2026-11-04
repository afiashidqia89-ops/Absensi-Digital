'use client'

// ─────────────────────────────────────────────────────────────
// Laporan Absensi — rekap lengkap dengan jam kerja per hari.
// SESUAI REVISI USER: menu ini juga menjadi tempat fitur
//  1) Unduh Data Master dari web ke HP (JSON + wajah / CSV)
//  2) Upload Transaksi absensi dari HP ke web (file JSON/CSV)
// ─────────────────────────────────────────────────────────────
import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { toast } from 'sonner'
import {
  Download, FileSpreadsheet, Loader2, Timer, Upload, Smartphone, CloudUpload, CheckCircle2, XCircle,
} from 'lucide-react'
import { tanggalWIB, tanggalMinDariN, formatDurasi, tanggalPanjang } from '@/lib/absensi-utils'
import { simpanMaster, bacaMaster, type MasterKaryawan } from '@/lib/offline-queue'
import type { BarisRekap, RingkasanKaryawan } from '@/lib/types'

interface HasilUpload {
  ok: boolean
  namaFile: string
  total: number
  sukses: number
  duplikat: number
  gagal: { baris: number; identitas: string; pesan: string }[]
}

export function LaporanView() {
  const [dari, setDari] = useState(tanggalMinDariN(6))
  const [sampai, setSampai] = useState(tanggalWIB(new Date()))
  const [karyawanId, setKaryawanId] = useState('semua')
  const [daftarKaryawan, setDaftarKaryawan] = useState<{ id: string; nama: string }[]>([])
  const [baris, setBaris] = useState<BarisRekap[]>([])
  const [ringkasan, setRingkasan] = useState<RingkasanKaryawan[]>([])
  const [totalMenit, setTotalMenit] = useState(0)
  const [muat, setMuat] = useState(false)

  // sinkronisasi (revisi)
  const [masterHp, setMasterHp] = useState<{ waktu: number; jumlah: number } | null>(null)
  const [mengunduh, setMengunduh] = useState(false)
  const [unggah, setUnggah] = useState(false)
  const [hasilUpload, setHasilUpload] = useState<HasilUpload | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const muatLaporan = useCallback(async () => {
    setMuat(true)
    try {
      const res = await fetch(`/api/laporan?dari=${dari}&sampai=${sampai}${karyawanId !== 'semua' ? `&karyawanId=${karyawanId}` : ''}`)
      const data = await res.json()
      setBaris(data.baris ?? [])
      setRingkasan(data.ringkasan ?? [])
      setTotalMenit(data.totalMenit ?? 0)
    } catch {
      toast.error('Gagal memuat laporan')
    } finally {
      setMuat(false)
    }
  }, [dari, sampai, karyawanId])

  useEffect(() => {
    void muatLaporan()
  }, [muatLaporan])

  useEffect(() => {
    fetch('/api/karyawan')
      .then((r) => r.json())
      .then((d) => setDaftarKaryawan(Array.isArray(d) ? d.map((k: { id: string; nama: string }) => ({ id: k.id, nama: k.nama })) : []))
      .catch(() => {})
    const m = bacaMaster()
    if (m) setMasterHp({ waktu: m.waktu, jumlah: m.karyawan.length })
  }, [])

  // ── Unduh Data Master dari web ke HP (fitur dipindah ke menu Laporan) ──
  const unduhMaster = async (format: 'json' | 'csv') => {
    setMengunduh(true)
    try {
      const res = await fetch('/api/karyawan/export?format=' + format)
      if (!res.ok) throw new Error()
      if (format === 'json') {
        const data = await res.json()
        // simpan cache master ke HP untuk absensi & verifikasi offline
        const karyawan: MasterKaryawan[] = (data.karyawan ?? []).map((k: MasterKaryawan) => ({
          id: k.id, nik: k.nik, nama: k.nama, jabatan: k.jabatan, departemen: k.departemen, aktif: k.aktif, wajah: k.wajah,
        }))
        simpanMaster(karyawan)
        setMasterHp({ waktu: Date.now(), jumlah: karyawan.length })
        // unduh file juga
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `master-karyawan-${new Date().toISOString().slice(0, 10)}.json`
        a.click()
        URL.revokeObjectURL(url)
        toast.success(`Data master (${karyawan.length} karyawan) diunduh & tersimpan di HP`)
      } else {
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `master-karyawan-${new Date().toISOString().slice(0, 10)}.csv`
        a.click()
        URL.revokeObjectURL(url)
        toast.success('Data master (CSV) diunduh ke perangkat')
      }
    } catch {
      toast.error('Gagal mengunduh data master')
    } finally {
      setMengunduh(false)
    }
  }

  // ── Upload Transaksi dari HP ke web (fitur baru di menu Laporan) ──
  const prosesFile = async (file: File) => {
    setUnggah(true)
    setHasilUpload(null)
    try {
      const isi = await file.text()
      const res = await fetch('/api/transaksi/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ namaFile: file.name, isi }),
      })
      const data = await res.json()
      if (res.ok) {
        setHasilUpload(data as HasilUpload)
        toast.success(`Upload "${file.name}": ${data.sukses} baru, ${data.duplikat} duplikat, ${data.gagal.length} gagal`)
        void muatLaporan()
      } else {
        toast.error(data.error ?? 'Gagal mengunggah transaksi')
      }
    } catch {
      toast.error('Gagal membaca/mengunggah file')
    } finally {
      setUnggah(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const exportCsv = () => {
    window.open(`/api/laporan/export?dari=${dari}&sampai=${sampai}${karyawanId !== 'semua' ? `&karyawanId=${karyawanId}` : ''}`, '_blank')
    toast.success('Laporan CSV diunduh')
  }

  const setRangeHariIni = () => {
    setDari(tanggalWIB(new Date()))
    setSampai(tanggalWIB(new Date()))
  }
  const setRange7Hari = () => {
    setDari(tanggalMinDariN(6))
    setSampai(tanggalWIB(new Date()))
  }
  const setRange30Hari = () => {
    setDari(tanggalMinDariN(29))
    setSampai(tanggalWIB(new Date()))
  }

  return (
    <div className="space-y-4">
      {/* ── SINKRONISASI HP ↔ WEB (unduh master + upload transaksi) ── */}
      <Card className="border-emerald-200 bg-emerald-50/50">
        <CardContent className="p-4">
          <p className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <Smartphone className="h-4 w-4 text-emerald-700" />
            Sinkronisasi HP ↔ Web
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            {/* unduh data master */}
            <div className="space-y-2 rounded-xl border bg-card p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium">1. Unduh Data Master ke HP</p>
                {masterHp && (
                  <Badge variant="outline" className="shrink-0 border-emerald-500 text-emerald-600">
                    tersimpan {new Date(masterHp.waktu).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Unduh daftar karyawan (lengkap data wajah) dari web ke HP — dipakai untuk absensi &amp; verifikasi offline.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={() => void unduhMaster('json')} disabled={mengunduh} className="bg-emerald-600 hover:bg-emerald-700 gap-1">
                  <Download className="h-3.5 w-3.5" /> JSON + Wajah
                </Button>
                <Button size="sm" variant="outline" onClick={() => void unduhMaster('csv')} disabled={mengunduh} className="gap-1">
                  <Download className="h-3.5 w-3.5" /> CSV Excel
                </Button>
              </div>
            </div>

            {/* upload transaksi */}
            <div className="space-y-2 rounded-xl border bg-card p-3">
              <p className="text-sm font-medium">2. Upload Transaksi ke Web</p>
              <p className="text-xs text-muted-foreground">
                Unggah file transaksi absensi (hasil HP/perangkat lain). Format JSON atau CSV — contoh:
                <code className="mt-1 block rounded bg-muted px-2 py-1 text-[10px] leading-relaxed">
                  nik,tanggal,tipe,jam<br />
                  00123,2026-10-30,MASUK,07:58
                </code>
              </p>
              <input
                ref={fileRef}
                type="file"
                accept=".json,.csv,text/csv,application/json"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) void prosesFile(f)
                }}
              />
              <Button size="sm" onClick={() => fileRef.current?.click()} disabled={unggah} className="gap-1 bg-emerald-600 hover:bg-emerald-700">
                {unggah ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CloudUpload className="h-3.5 w-3.5" />}
                {unggah ? 'Mengunggah…' : 'Pilih File (.json / .csv)'}
              </Button>
              {hasilUpload && (
                <div className="space-y-1 rounded-lg border bg-muted/40 p-2.5 text-xs">
                  <p className="font-medium">{hasilUpload.namaFile} — {hasilUpload.total} baris</p>
                  <div className="flex flex-wrap gap-1.5">
                    <Badge variant="outline" className="gap-1 border-emerald-500 text-emerald-600">
                      <CheckCircle2 className="h-3 w-3" /> {hasilUpload.sukses} baru
                    </Badge>
                    <Badge variant="outline" className="gap-1">{hasilUpload.duplikat} duplikat</Badge>
                    {hasilUpload.gagal.length > 0 && (
                      <Badge variant="outline" className="gap-1 border-red-400 text-red-600">
                        <XCircle className="h-3 w-3" /> {hasilUpload.gagal.length} gagal
                      </Badge>
                    )}
                  </div>
                  {hasilUpload.gagal.length > 0 && (
                    <ul className="max-h-24 space-y-0.5 overflow-y-auto text-[11px] text-red-600 scrollbar-thin">
                      {hasilUpload.gagal.slice(0, 10).map((g) => (
                        <li key={g.baris}>Baris {g.baris} ({g.identitas}): {g.pesan}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* filter */}
      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="dari">Dari tanggal</Label>
              <Input id="dari" type="date" value={dari} onChange={(e) => setDari(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="sampai">Sampai tanggal</Label>
              <Input id="sampai" type="date" value={sampai} onChange={(e) => setSampai(e.target.value)} />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label>Karyawan</Label>
            <Select value={karyawanId} onValueChange={setKaryawanId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="semua">Semua karyawan</SelectItem>
                {daftarKaryawan.map((k) => (
                  <SelectItem key={k.id} value={k.id}>{k.nama}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" onClick={setRangeHariIni}>Hari ini</Button>
            <Button size="sm" variant="secondary" onClick={setRange7Hari}>7 hari</Button>
            <Button size="sm" variant="secondary" onClick={setRange30Hari}>30 hari</Button>
            <Button size="sm" onClick={() => void muatLaporan()} disabled={muat} className="bg-emerald-600 hover:bg-emerald-700">
              {muat ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null} Tampilkan
            </Button>
            <Button size="sm" variant="outline" onClick={exportCsv} className="gap-1">
              <Download className="h-3.5 w-3.5" /> CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* total jam kerja */}
      <Card className="border-emerald-200">
        <CardContent className="flex items-center justify-between p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Timer className="h-5 w-5 text-emerald-600" />
            Total jam kerja periode ini
          </div>
          <p className="text-xl font-bold text-emerald-700">{formatDurasi(totalMenit)}</p>
        </CardContent>
      </Card>

      {/* ringkasan per karyawan */}
      {ringkasan.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <p className="mb-3 flex items-center gap-1.5 text-sm font-semibold">
              <FileSpreadsheet className="h-4 w-4 text-emerald-600" /> Rekap per karyawan
            </p>
            <div className="space-y-2">
              {ringkasan.map((r) => (
                <div key={r.karyawanId} className="flex items-center justify-between rounded-lg bg-muted/60 px-3 py-2 text-sm">
                  <div>
                    <p className="font-medium">{r.nama}</p>
                    <p className="text-xs text-muted-foreground">{r.departemen}</p>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <Badge variant="outline" className="gap-1">
                      {r.hariHadir} hari
                    </Badge>
                    {r.hariTerlambat > 0 && (
                      <Badge variant="outline" className="border-red-300 text-red-600">{r.hariTerlambat}x terlambat</Badge>
                    )}
                    <span className="font-semibold text-emerald-700">{formatDurasi(r.totalMenit)}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* detail harian */}
      <Card>
        <CardContent className="p-0">
          <p className="px-4 pt-4 text-sm font-semibold">Detail absensi harian</p>
          <div className="max-h-[26rem] overflow-auto scrollbar-thin">
            <Table>
              <TableHeader className="sticky top-0 bg-card">
                <TableRow>
                  <TableHead>Tanggal</TableHead>
                  <TableHead>Nama</TableHead>
                  <TableHead>Masuk</TableHead>
                  <TableHead>Keluar</TableHead>
                  <TableHead className="text-right">Jam Kerja</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {baris.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                      {muat ? 'Memuat…' : 'Belum ada data absensi pada periode ini.'}
                    </TableCell>
                  </TableRow>
                ) : (
                  baris.map((b, i) => (
                    <TableRow key={`${b.karyawanId}-${b.tanggal}-${i}`}>
                      <TableCell className="whitespace-nowrap text-xs">
                        {tanggalPanjang(`${b.tanggal}T00:00:00+07:00`).replace(/,/, ',')}
                      </TableCell>
                      <TableCell>
                        <p className="text-sm font-medium">{b.nama}</p>
                        <p className="text-xs text-muted-foreground">{b.departemen}</p>
                      </TableCell>
                      <TableCell className="font-mono text-sm">{b.jamMasuk ?? '—'}</TableCell>
                      <TableCell className="font-mono text-sm">{b.jamKeluar ?? '—'}</TableCell>
                      <TableCell className="whitespace-nowrap text-right text-sm font-semibold text-emerald-700">
                        {b.durasi}
                      </TableCell>
                      <TableCell>
                        {b.status === 'TERLAMBAT' ? (
                          <Badge variant="destructive" className="text-xs">
                            Terlambat {b.menitTerlambat}m
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="border-emerald-500 text-emerald-600 text-xs">Hadir</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* indikator upload berjalan */}
      {unggah && (
        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Upload className="h-4 w-4 animate-pulse" /> Mengunggah transaksi ke web…
        </div>
      )}
    </div>
  )
}
