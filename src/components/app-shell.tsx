'use client'

// Shell aplikasi: bottom-nav (HP) + sidebar (desktop)
import { useState } from 'react'
import { AbsensiView } from '@/components/absensi-view'
import { DaftarWajahView } from '@/components/daftar-wajah-view'
import { KaryawanView } from '@/components/karyawan-view'
import { LaporanView } from '@/components/laporan-view'
import { DashboardView } from '@/components/dashboard-view'
import { CloudUpload } from 'lucide-react'
import { bacaAntrean } from '@/lib/offline-queue'
import {
  Home, LogIn, ScanFace, Users, FileBarChart2,
} from 'lucide-react'

type Tab = 'beranda' | 'absen' | 'daftar' | 'karyawan' | 'laporan'

const TABS: { id: Tab; label: string; ikon: typeof Home }[] = [
  { id: 'beranda', label: 'Beranda', ikon: Home },
  { id: 'absen', label: 'Absen', ikon: LogIn },
  { id: 'daftar', label: 'Daftar Wajah', ikon: ScanFace },
  { id: 'karyawan', label: 'Karyawan', ikon: Users },
  { id: 'laporan', label: 'Laporan', ikon: FileBarChart2 },
]

export function AppShell() {
  const [tab, setTab] = useState<Tab>('beranda')
  const [refreshKey, setRefreshKey] = useState(0)
  const [antreanCount, setAntreanCount] = useState(bacaAntrean().length)

  const pindah = (t: Tab) => {
    setTab(t)
    if (t === 'beranda') setRefreshKey((k) => k + 1)
    if (t === 'absen') setAntreanCount(bacaAntrean().length)
    window.scrollTo({ top: 0 })
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      {/* header */}
      <header className="sticky top-0 z-40 border-b bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm">
              <ScanFace className="h-5 w-5" />
            </span>
            <div>
              <h1 className="text-base font-bold leading-tight">Absensi Wajah</h1>
              <p className="text-[11px] leading-tight text-muted-foreground">Presensi karyawan · anti-foto</p>
            </div>
          </div>
          {antreanCount > 0 && (
            <span className="flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-700">
              <CloudUpload className="h-3 w-3" /> {antreanCount} menunggu unggah
            </span>
          )}
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-5xl flex-1 gap-6 px-4 py-5">
        {/* sidebar desktop */}
        <nav className="hidden w-52 shrink-0 lg:block" aria-label="Menu utama">
          <ul className="sticky top-20 space-y-1">
            {TABS.map(({ id, label, ikon: Ikon }) => (
              <li key={id}>
                <button
                  onClick={() => pindah(id)}
                  className={`flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium transition ${
                    tab === id
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-slate-600 hover:bg-emerald-50 hover:text-emerald-700'
                  }`}
                >
                  <Ikon className="h-4.5 w-4.5" /> {label}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        {/* konten */}
        <main className="min-w-0 flex-1 pb-24 lg:pb-6">
          {tab === 'beranda' && <DashboardView refreshKey={refreshKey} />}
          {tab === 'absen' && <AbsensiView onSyncChange={setAntreanCount} onKeDaftarWajah={() => pindah('daftar')} />}
          {tab === 'daftar' && <DaftarWajahView />}
          {tab === 'karyawan' && <KaryawanView />}
          {tab === 'laporan' && <LaporanView />}
        </main>
      </div>

      {/* bottom nav mobile */}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t bg-white/95 backdrop-blur lg:hidden"
        aria-label="Menu utama"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <ul className="mx-auto grid max-w-lg grid-cols-5">
          {TABS.map(({ id, label, ikon: Ikon }) => (
            <li key={id}>
              <button
                onClick={() => pindah(id)}
                className={`flex w-full flex-col items-center gap-0.5 py-2.5 text-[10px] font-medium transition ${
                  tab === id ? 'text-emerald-600' : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                <span className={`relative rounded-xl px-3 py-1 ${tab === id ? 'bg-emerald-50' : ''}`}>
                  <Ikon className="h-5 w-5" />
                </span>
                {label}
              </button>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}
