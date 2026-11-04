'use client'

// Beranda — ringkasan hari ini, tren kehadiran, log terbaru, jam kantor
import { useCallback, useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import {
  Users, ScanFace, UserCheck, Clock3, AlertCircle, Settings2, Loader2,
} from 'lucide-react'
import type { DashboardDTO } from '@/lib/types'
import { tanggalPanjang } from '@/lib/absensi-utils'

function FotoAbsen({ src, nama }: { src: string; nama: string }) {
  const [err, setErr] = useState(false)
  // tanpa foto / foto gagal dimuat → tampilkan ikon wajah (hindari src="")
  if (err || !src) {
    return (
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100">
        <ScanFace className="h-4 w-4 text-emerald-700" />
      </span>
    )
  }
  return <img src={src} alt={`Foto absen ${nama}`} className="h-8 w-8 rounded-full object-cover" onError={() => setErr(true)} />
}

export function DashboardView({ refreshKey }: { refreshKey: number }) {
  const [data, setData] = useState<DashboardDTO | null>(null)
  const [jamMasuk, setJamMasuk] = useState('08:00')
  const [jamKeluar, setJamKeluar] = useState('17:00')
  const [simpanJam, setSimpanJam] = useState(false)

  const muat = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard')
      const d: DashboardDTO = await res.json()
      setData(d)
      setJamMasuk(d.jamKantor.masuk)
      setJamKeluar(d.jamKantor.keluar)
    } catch {
      toast.error('Gagal memuat dashboard')
    }
  }, [])

  useEffect(() => {
    void muat()
  }, [muat, refreshKey])

  const simpanJamKantor = async () => {
    setSimpanJam(true)
    try {
      const res = await fetch('/api/setting', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jamMasuk, jamKeluar }),
      })
      const d = await res.json()
      if (res.ok) toast.success('Jam kantor tersimpan')
      else toast.error(d.error ?? 'Gagal menyimpan')
    } catch {
      toast.error('Tidak ada koneksi')
    } finally {
      setSimpanJam(false)
    }
  }

  if (!data) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-7 w-7 animate-spin text-emerald-600" />
      </div>
    )
  }

  const maksTren = Math.max(1, ...data.rekap7Hari.map((t) => t.hadir))

  return (
    <div className="space-y-4">
      {/* judul */}
      <div>
        <h2 className="text-lg font-bold">Beranda Absensi</h2>
        <p className="text-xs capitalize text-muted-foreground">{tanggalPanjang(new Date())}</p>
      </div>

      {/* kartu statistik */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card className="border-emerald-200 bg-emerald-50/60">
          <CardContent className="flex items-center gap-3 p-4">
            <span className="rounded-xl bg-emerald-600 p-2.5 text-white"><UserCheck className="h-5 w-5" /></span>
            <div>
              <p className="text-2xl font-bold">{data.hadirHariIni}</p>
              <p className="text-xs text-muted-foreground">Hadir hari ini</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-amber-200 bg-amber-50/60">
          <CardContent className="flex items-center gap-3 p-4">
            <span className="rounded-xl bg-amber-600 p-2.5 text-white"><AlertCircle className="h-5 w-5" /></span>
            <div>
              <p className="text-2xl font-bold">{data.terlambatHariIni}</p>
              <p className="text-xs text-muted-foreground">Terlambat</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <span className="rounded-xl bg-slate-700 p-2.5 text-white"><Clock3 className="h-5 w-5" /></span>
            <div>
              <p className="text-2xl font-bold">{data.sedangBekerja}</p>
              <p className="text-xs text-muted-foreground">Sedang bekerja</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <span className="rounded-xl bg-slate-200 p-2.5 text-slate-700"><Users className="h-5 w-5" /></span>
            <div>
              <p className="text-2xl font-bold">{data.belumAbsen}</p>
              <p className="text-xs text-muted-foreground">Belum absen</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* tren 7 hari */}
        <Card>
          <CardContent className="p-4">
            <p className="mb-4 text-sm font-semibold">Kehadiran 7 hari terakhir</p>
            <div className="flex h-40 items-end justify-between gap-2">
              {data.rekap7Hari.map((t) => (
                <div key={t.tanggal} className="flex flex-1 flex-col items-center gap-1">
                  <div className="relative flex w-full flex-col justify-end" style={{ height: '8rem' }}>
                    {t.terlambat > 0 && (
                      <div
                        className="w-full rounded-t bg-amber-400"
                        style={{ height: `${(t.terlambat / maksTren) * 100}%` }}
                      />
                    )}
                    <div
                      className={`w-full ${t.terlambat > 0 ? '' : 'rounded-t'} bg-emerald-500`}
                      style={{ height: `${(t.hadir / maksTren) * 100}%` }}
                    />
                    <span className="absolute -top-5 w-full text-center text-[10px] font-semibold text-muted-foreground">
                      {t.hadir > 0 ? t.hadir : ''}
                    </span>
                  </div>
                  <span className="text-[10px] text-muted-foreground">{t.tanggal.slice(8)}</span>
                </div>
              ))}
            </div>
            <div className="mt-2 flex gap-3 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded bg-emerald-500" /> Hadir</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded bg-amber-400" /> Terlambat</span>
            </div>
          </CardContent>
        </Card>

        {/* aktivitas terbaru */}
        <Card>
          <CardContent className="p-4">
            <p className="mb-3 text-sm font-semibold">Aktivitas absensi terbaru</p>
            {data.logTerbaru.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted-foreground">Belum ada transaksi absensi.</p>
            ) : (
              <ul className="space-y-2">
                {data.logTerbaru.map((l) => (
                  <li key={l.id} className="flex items-center justify-between rounded-lg bg-muted/60 px-3 py-2">
                    <div className="flex items-center gap-2">
                      <FotoAbsen src={l.foto ?? ''} nama={l.nama} />
                      <div>
                        <p className="text-sm font-medium">{l.nama}</p>
                        <p className="text-[10px] text-muted-foreground">{l.tipe === 'MASUK' ? 'Absen masuk' : 'Absen keluar'}</p>
                      </div>
                    </div>
                    <Badge variant="outline" className="font-mono text-[10px]">{l.waktu}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* pengaturan jam kantor */}
      <Card>
        <CardContent className="p-4">
          <p className="mb-3 flex items-center gap-1.5 text-sm font-semibold">
            <Settings2 className="h-4 w-4 text-emerald-600" /> Jam Kantor
          </p>
          <div className="flex flex-wrap items-end gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="jm" className="text-xs">Jam masuk (batas terlambat +15 mnt)</Label>
              <Input id="jm" type="time" value={jamMasuk} onChange={(e) => setJamMasuk(e.target.value)} className="w-32" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="jk" className="text-xs">Jam keluar</Label>
              <Input id="jk" type="time" value={jamKeluar} onChange={(e) => setJamKeluar(e.target.value)} className="w-32" />
            </div>
            <Button onClick={simpanJamKantor} disabled={simpanJam} size="sm" className="bg-emerald-600 hover:bg-emerald-700">
              {simpanJam && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />} Simpan
            </Button>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            {data.totalKaryawan} karyawan aktif · {data.terdaftarWajah} sudah mendaftar wajah
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
