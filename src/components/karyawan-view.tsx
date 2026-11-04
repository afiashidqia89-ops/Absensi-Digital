'use client'

// Master Data Karyawan — CRUD (tambah/edit/hapus).
// Catatan: fitur "Unduh Data Master" & "Upload Transaksi" kini berada di menu LAPORAN
// sesuai revisi user.
import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { toast } from 'sonner'
import {
  Plus, Search, Pencil, Trash2, UserRound, Loader2,
} from 'lucide-react'
import type { KaryawanDTO } from '@/lib/types'

interface FormKaryawan {
  nik: string
  nama: string
  jabatan: string
  departemen: string
  telepon: string
}

const KOSONG: FormKaryawan = { nik: '', nama: '', jabatan: '', departemen: '', telepon: '' }

export function KaryawanView() {
  const [daftar, setDaftar] = useState<KaryawanDTO[]>([])
  const [cari, setCari] = useState('')
  const [sedangMuat, setSedangMuat] = useState(true)
  const [dialogTerbuka, setDialogTerbuka] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState<FormKaryawan>(KOSONG)
  const [menyimpan, setMenyimpan] = useState(false)
  const [hapusTarget, setHapusTarget] = useState<KaryawanDTO | null>(null)

  const muat = useCallback(async () => {
    setSedangMuat(true)
    try {
      const res = await fetch('/api/karyawan')
      setDaftar(await res.json())
    } catch {
      toast.error('Gagal memuat data karyawan')
    } finally {
      setSedangMuat(false)
    }
  }, [])

  useEffect(() => {
    void muat()
  }, [muat])

  const terfilter = daftar.filter(
    (k) =>
      k.nama.toLowerCase().includes(cari.toLowerCase()) ||
      k.nik.toLowerCase().includes(cari.toLowerCase()) ||
      k.departemen.toLowerCase().includes(cari.toLowerCase())
  )

  const bukaTambah = () => {
    setEditId(null)
    setForm(KOSONG)
    setDialogTerbuka(true)
  }

  const bukaEdit = (k: KaryawanDTO) => {
    setEditId(k.id)
    setForm({ nik: k.nik, nama: k.nama, jabatan: k.jabatan, departemen: k.departemen, telepon: k.telepon ?? '' })
    setDialogTerbuka(true)
  }

  const simpan = async () => {
    if (!form.nik.trim() || !form.nama.trim()) {
      toast.error('NIK dan nama wajib diisi')
      return
    }
    setMenyimpan(true)
    try {
      const res = await fetch(editId ? `/api/karyawan/${editId}` : '/api/karyawan', {
        method: editId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success(editId ? 'Data karyawan diperbarui' : `Karyawan ${form.nama} ditambahkan`)
        setDialogTerbuka(false)
        void muat()
      } else {
        toast.error(data.error ?? 'Gagal menyimpan')
      }
    } catch {
      toast.error('Tidak ada koneksi ke server')
    } finally {
      setMenyimpan(false)
    }
  }

  const konfirmHapus = async () => {
    if (!hapusTarget) return
    const res = await fetch(`/api/karyawan/${hapusTarget.id}`, { method: 'DELETE' })
    if (res.ok) {
      toast.success(`${hapusTarget.nama} dihapus`)
      void muat()
    } else toast.error('Gagal menghapus')
    setHapusTarget(null)
  }

  return (
    <div className="space-y-4">
      {/* daftar */}
      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Cari nama, NIK, departemen…" value={cari} onChange={(e) => setCari(e.target.value)} className="pl-9" />
            </div>
            <Button onClick={bukaTambah} className="bg-emerald-600 hover:bg-emerald-700 gap-1">
              <Plus className="h-4 w-4" /> Tambah
            </Button>
          </div>

          <div className="max-h-[28rem] space-y-2 overflow-y-auto pr-1 scrollbar-thin">
            {sedangMuat ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : terfilter.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {daftar.length === 0 ? 'Belum ada karyawan — tekan Tambah untuk memulai.' : 'Tidak ditemukan.'}
              </p>
            ) : (
              terfilter.map((k) => (
                <div key={k.id} className="flex items-center justify-between gap-2 rounded-xl border p-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                      <UserRound className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">
                        {k.nama}
                        {!k.aktif && <Badge variant="outline" className="ml-2 text-xs text-red-500 border-red-300">nonaktif</Badge>}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        NIK {k.nik} · {k.jabatan} · {k.departemen}
                        {k.terdaftarWajah && <span className="text-emerald-600"> · wajah ✓ {k.dataWajah?.jumlahSampel ?? 0}x</span>}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button size="icon" variant="ghost" aria-label={`Edit ${k.nama}`} onClick={() => bukaEdit(k)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" aria-label={`Hapus ${k.nama}`} onClick={() => setHapusTarget(k)}>
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
          <p className="text-center text-xs text-muted-foreground">{daftar.length} karyawan terdaftar di web</p>
        </CardContent>
      </Card>

      {/* dialog tambah/edit */}
      <Dialog open={dialogTerbuka} onOpenChange={setDialogTerbuka}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editId ? 'Edit Karyawan' : 'Tambah Karyawan'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid gap-1.5">
              <Label htmlFor="nik">NIK *</Label>
              <Input id="nik" placeholder="mis. 00123" value={form.nik} onChange={(e) => setForm({ ...form, nik: e.target.value })} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="nama">Nama Lengkap *</Label>
              <Input id="nama" placeholder="mis. Budi Santoso" value={form.nama} onChange={(e) => setForm({ ...form, nama: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="jabatan">Jabatan</Label>
                <Input id="jabatan" placeholder="Operator" value={form.jabatan} onChange={(e) => setForm({ ...form, jabatan: e.target.value })} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="departemen">Departemen</Label>
                <Input id="departemen" placeholder="Produksi" value={form.departemen} onChange={(e) => setForm({ ...form, departemen: e.target.value })} />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="telepon">No. Telepon</Label>
              <Input id="telepon" placeholder="0812…" value={form.telepon} onChange={(e) => setForm({ ...form, telepon: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogTerbuka(false)}>Batal</Button>
            <Button onClick={simpan} disabled={menyimpan} className="bg-emerald-600 hover:bg-emerald-700">
              {menyimpan && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* konfirmasi hapus */}
      <AlertDialog open={!!hapusTarget} onOpenChange={(o) => !o && setHapusTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus {hapusTarget?.nama}?</AlertDialogTitle>
            <AlertDialogDescription>
              Semua data absensi dan pendaftaran wajah karyawan ini juga akan dihapus permanen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={konfirmHapus} className="bg-red-600 hover:bg-red-700">Hapus</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
