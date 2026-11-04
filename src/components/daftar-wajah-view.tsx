'use client'

// Halaman Pendaftaran Wajah — pilih karyawan → scan 3 sampel →
// upload ke web sebagai database wajah terpusat.
import { useCallback, useEffect, useState } from 'react'
import { FaceScanner, type SampelWajahCaptured } from '@/components/face-scanner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { ScanFace, Search, CheckCircle2, Loader2, Trash2 } from 'lucide-react'
import type { KaryawanDTO } from '@/lib/types'

export function DaftarWajahView() {
  const [daftar, setDaftar] = useState<KaryawanDTO[]>([])
  const [cari, setCari] = useState('')
  const [pilih, setPilih] = useState<KaryawanDTO | null>(null)
  const [tahap, setTahap] = useState<'pilih' | 'scan' | 'unggah' | 'selesai'>('pilih')
  const [sampel, setSampel] = useState<SampelWajahCaptured[]>([])
  const [memproses, setMemproses] = useState(false)

  const muat = useCallback(async () => {
    try {
      const res = await fetch('/api/karyawan')
      const data = await res.json()
      setDaftar(Array.isArray(data) ? data : [])
    } catch {
      toast.error('Gagal memuat daftar karyawan')
    }
  }, [])

  useEffect(() => {
    void muat()
  }, [muat])

  const terfilter = daftar.filter(
    (k) =>
      k.nama.toLowerCase().includes(cari.toLowerCase()) ||
      k.nik.toLowerCase().includes(cari.toLowerCase())
  )

  const onSampel = useCallback(
    async (hasil: SampelWajahCaptured[]) => {
      if (!pilih) return
      setSampel(hasil)
      setTahap('unggah')
      setMemproses(true)
      try {
        const res = await fetch(`/api/karyawan/${pilih.id}/wajah`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sampel: hasil, deviceId: localStorage.getItem('absensi-device-id') ?? 'web' }),
        })
        const data = await res.json()
        if (res.ok) {
          toast.success(data.pesan)
          setTahap('selesai')
          void muat()
        } else {
          toast.error(data.error ?? 'Gagal mengunggah wajah')
          setTahap('pilih')
          setPilih(null)
        }
      } catch {
        toast.error('Tidak ada koneksi ke server — coba lagi saat online')
        setTahap('pilih')
        setPilih(null)
      } finally {
        setMemproses(false)
      }
    },
    [pilih, muat]
  )

  const hapusWajah = async (k: KaryawanDTO) => {
    if (!confirm(`Hapus pendaftaran wajah ${k.nama}? Karyawan harus mendaftar ulang untuk bisa absen.`)) return
    const res = await fetch(`/api/karyawan/${k.id}/wajah`, { method: 'DELETE' })
    if (res.ok) {
      toast.success(`Data wajah ${k.nama} dihapus`)
      void muat()
    } else toast.error('Gagal menghapus data wajah')
  }

  const ulang = () => {
    setPilih(null)
    setSampel([])
    setTahap('pilih')
  }

  if (tahap === 'scan' && pilih) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between rounded-xl border bg-card px-4 py-3">
          <div>
            <p className="text-sm font-semibold">{pilih.nama}</p>
            <p className="text-xs text-muted-foreground">NIK {pilih.nik} · {pilih.jabatan}</p>
          </div>
          <Badge variant="outline" className="gap-1 border-emerald-500 text-emerald-600">
            <ScanFace className="h-3 w-3" /> Pendaftaran
          </Badge>
        </div>
        <FaceScanner mode="pendaftaran" onPendaftaran={onSampel} onCancel={ulang} />
      </div>
    )
  }

  if (tahap === 'unggah' || memproses) {
    return (
      <Card className="mx-auto max-w-md">
        <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
          <p className="text-sm text-muted-foreground">Mengunggah {sampel.length} sampel wajah ke database web…</p>
        </CardContent>
      </Card>
    )
  }

  if (tahap === 'selesai') {
    return (
      <Card className="mx-auto max-w-md border-emerald-200">
        <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
          <CheckCircle2 className="h-12 w-12 text-emerald-600" />
          <p className="text-lg font-bold">Wajah {pilih?.nama} terdaftar!</p>
          <p className="text-sm text-muted-foreground">
            {sampel.length} sampel (descriptor 128-d + foto) tersimpan di database web.
            Karyawan siap melakukan absensi.
          </p>
          <Button onClick={ulang} className="bg-emerald-600 hover:bg-emerald-700">Pendaftaran Berikutnya</Button>
        </CardContent>
      </Card>
    )
  }

  // tahap pilih karyawan
  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Cari nama atau NIK…"
              value={cari}
              onChange={(e) => setCari(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="max-h-96 space-y-2 overflow-y-auto pr-1 scrollbar-thin">
            {terfilter.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {daftar.length === 0 ? 'Belum ada karyawan. Tambahkan di tab Karyawan.' : 'Tidak ditemukan.'}
              </p>
            )}
            {terfilter.map((k) => (
              <div
                key={k.id}
                className={`flex items-center justify-between rounded-xl border p-3 transition ${k.aktif ? 'hover:border-emerald-400 hover:bg-emerald-50/50' : 'opacity-50'}`}
              >
                <button
                  className="flex-1 text-left"
                  onClick={() => {
                    if (!k.aktif) return toast.error('Karyawan nonaktif tidak bisa mendaftar wajah')
                    setPilih(k)
                    setTahap('scan')
                  }}
                >
                  <p className="text-sm font-semibold">{k.nama}</p>
                  <p className="text-xs text-muted-foreground">NIK {k.nik} · {k.jabatan} · {k.departemen}</p>
                </button>
                <div className="ml-2 flex items-center gap-2">
                  {k.terdaftarWajah ? (
                    <Badge variant="outline" className="gap-1 border-emerald-500 text-emerald-600">
                      <CheckCircle2 className="h-3 w-3" />
                      {k.dataWajah?.jumlahSampel ?? 0} sampel
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-muted-foreground">Belum daftar</Badge>
                  )}
                  {k.terdaftarWajah && (
                    <Button size="icon" variant="ghost" aria-label={`Hapus wajah ${k.nama}`} onClick={() => hapusWajah(k)}>
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      <p className="text-center text-xs text-muted-foreground">
        Pilih karyawan lalu ikuti 3 panduan pose. Data wajah langsung terunggah ke web sebagai database absensi.
      </p>
    </div>
  )
}
