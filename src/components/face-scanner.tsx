'use client'

// ─────────────────────────────────────────────────────────────
// FaceScanner — komponen kamera pengenalan wajah.
// mode 'verifikasi'   : tantangan liveness acak (anti foto printout)
// mode 'pendaftaran'  : ambil 3 sampel wajah dengan panduan pose
//
// CATATAN ARAH: kamera user-facing mengambil frame "sebagai orang lain
// memotret" (tanpa mirror). Preview ditampilkan mirror (seperti cermin)
// agar natural. Maka: hidung di KIRI frame mentah = user nengok KANAN.
// ─────────────────────────────────────────────────────────────
import { useCallback, useEffect, useRef, useState } from 'react'
import { getFaceEngine, deteksiFrame, tangkapFrame, type HasilDeteksi } from '@/lib/face-engine'
import { EvaluatorLiveness, buatSesiTantangan, type Tantangan } from '@/lib/liveness'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Camera, CameraOff, RefreshCw, ShieldCheck, ScanFace } from 'lucide-react'

export interface SampelWajahCaptured {
  descriptor: number[]
  foto: string
}

export interface HasilVerifikasi {
  descriptor: number[]
  foto: string
}

interface Props {
  mode: 'verifikasi' | 'pendaftaran'
  onVerifikasi?: (hasil: HasilVerifikasi) => void
  onPendaftaran?: (sampel: SampelWajahCaptured[]) => void
  onCancel?: () => void
}

type Status = 'memuat' | 'siap' | 'berjalan' | 'memproses' | 'selesai' | 'error'

// Langkah pendaftaran: kondisi diperiksa pada FRAME MENTAH (tanpa mirror)
// 3 pose: hadap lurus → tengok kiri → tengok kanan (variasi pose untuk descriptor)
const LANGKAH_DAFTAR: { instruksi: string; ikon: string; cek: (d: HasilDeteksi) => boolean }[] = [
  { instruksi: 'Hadap kamera lurus, posisi stabil', ikon: '🙂', cek: (d) => d.terdeteksi && d.areaRatio > 0.04 },
  { instruksi: 'Tengok kepala sedikit ke kiri', ikon: '⬅️', cek: (d) => d.noseRatio > 0.56 },
  { instruksi: 'Tengok kepala sedikit ke kanan', ikon: '➡️', cek: (d) => d.noseRatio < 0.44 },
]

export function FaceScanner({ mode, onVerifikasi, onPendaftaran, onCancel }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const jalanRef = useRef(false)
  const streamRef = useRef<MediaStream | null>(null)
  const faceapiRef = useRef<unknown>(null)
  const evaluatorRef = useRef<EvaluatorLiveness | null>(null)
  const langkahRef = useRef(0)
  const frameStabilRef = useRef(0)
  const wajahAdaRef = useRef(false)
  const sampelRef = useRef<SampelWajahCaptured[]>([])

  const [status, setStatus] = useState<Status>('memuat')
  const [error, setError] = useState('')
  const [pesan, setPesan] = useState('')
  const [tantangan, setTantangan] = useState<Tantangan | null>(null)
  const [progress, setProgress] = useState(0)
  const [progressLangkah, setProgressLangkah] = useState(0)
  const [langkahAktif, setLangkahAktif] = useState(0)
  const [wajahAda, setWajahAda] = useState(false)
  const [menghadapUser, setMenghadapUser] = useState(true)

  // ── Overlay: gambar bingkai pemindai pada wajah ──
  const gambarOverlay = useCallback((det: HasilDeteksi) => {
    const canvas = canvasRef.current
    const video = videoRef.current
    if (!canvas || !video) return
    if (canvas.width !== video.videoWidth) {
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
    }
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    if (det.terdeteksi && det.box) {
      const { x, y, width, height } = det.box
      ctx.strokeStyle = 'rgba(16, 185, 129, 0.95)'
      ctx.lineWidth = 4
      ctx.beginPath()
      const c = Math.min(34, width / 4)
      ctx.moveTo(x, y + c); ctx.lineTo(x, y); ctx.lineTo(x + c, y)
      ctx.moveTo(x + width - c, y); ctx.lineTo(x + width, y); ctx.lineTo(x + width, y + c)
      ctx.moveTo(x + width, y + height - c); ctx.lineTo(x + width, y + height); ctx.lineTo(x + width - c, y + height)
      ctx.moveTo(x + c, y + height); ctx.lineTo(x, y + height); ctx.lineTo(x, y + height - c)
      ctx.stroke()
    }
  }, [])

  // ── Kamera ──
  const mulaiKamera = useCallback(async () => {
    setStatus('memuat')
    setError('')
    try {
      const faceapi = await getFaceEngine()
      faceapiRef.current = faceapi
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: menghadapUser ? 'user' : 'environment', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      })
      streamRef.current = stream
      const video = videoRef.current!
      video.srcObject = stream
      await video.play()
      setStatus('siap')
    } catch (e) {
      console.error(e)
      setError(
        e instanceof Error && e.name === 'NotAllowedError'
          ? 'Akses kamera ditolak. Izinkan kamera di pengaturan browser, lalu coba lagi.'
          : 'Gagal membuka kamera. Pastikan tidak ada aplikasi lain yang sedang memakai kamera.'
      )
      setStatus('error')
    }
  }, [menghadapUser])

  // (Re)start kamera saat sisi kamera berubah
  useEffect(() => {
    jalanRef.current = false
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    const t = setTimeout(() => void mulaiKamera(), 0)
    return () => {
      clearTimeout(t)
      jalanRef.current = false
      streamRef.current?.getTracks().forEach((tr) => tr.stop())
    }
  }, [mulaiKamera])

  const selesaiVerifikasi = useCallback(
    (det: HasilDeteksi) => {
      jalanRef.current = false
      setStatus('memproses')
      setPesan('Memverifikasi keaslian wajah…')
      const foto = tangkapFrame(videoRef.current!, 480)
      setTimeout(() => {
        onVerifikasi?.({ descriptor: det.descriptor!, foto })
        setStatus('selesai')
        setPesan('Wajah asli terkonfirmasi!')
      }, 400)
    },
    [onVerifikasi]
  )

  // ── Loop deteksi utama ──
  const loopDeteksi = useCallback(async () => {
    while (jalanRef.current) {
      const video = videoRef.current
      const faceapi = faceapiRef.current
      if (!video || !faceapi) break
      let det: HasilDeteksi
      try {
        det = await deteksiFrame(faceapi, video)
      } catch {
        break
      }
      if (!jalanRef.current) break
      gambarOverlay(det)

      // update state wajah hanya saat berubah (hemat re-render)
      if (det.terdeteksi !== wajahAdaRef.current) {
        wajahAdaRef.current = det.terdeteksi
        setWajahAda(det.terdeteksi)
      }

      if (mode === 'verifikasi' && evaluatorRef.current) {
        const hasil = evaluatorRef.current.proses(det)
        setTantangan(hasil.tantanganAktif)
        setProgress(hasil.progress)
        if (hasil.pesan) setPesan(hasil.pesan)
        if (hasil.selesai) {
          if (hasil.gagal) {
            jalanRef.current = false
            setStatus('error')
            setError(hasil.pesan)
          } else if (det.terdeteksi && det.descriptor) {
            selesaiVerifikasi(det)
            break
          }
        }
      } else if (mode === 'pendaftaran') {
        const idx = langkahRef.current
        const langkah = LANGKAH_DAFTAR[idx]
        if (!langkah) break
        if (det.terdeteksi && langkah.cek(det)) {
          frameStabilRef.current++
          setProgressLangkah(Math.min(1, frameStabilRef.current / 8))
          if (frameStabilRef.current >= 8 && det.descriptor) {
            sampelRef.current.push({ descriptor: det.descriptor, foto: tangkapFrame(video, 480) })
            frameStabilRef.current = 0
            langkahRef.current++
            setProgressLangkah(0)
            if (langkahRef.current >= LANGKAH_DAFTAR.length) {
              jalanRef.current = false
              setStatus('memproses')
              setPesan('Mengunggah sampel wajah ke database web…')
              const sampel = [...sampelRef.current]
              sampelRef.current = []
              setTimeout(() => {
                onPendaftaran?.(sampel)
                setStatus('selesai')
                setPesan('Sampel wajah lengkap!')
              }, 300)
              break
            }
            setLangkahAktif(langkahRef.current)
            setPesan(LANGKAH_DAFTAR[langkahRef.current].instruksi)
          }
        } else {
          frameStabilRef.current = Math.max(0, frameStabilRef.current - 1)
          setProgressLangkah(Math.min(0.9, frameStabilRef.current / 8))
        }
      }

      // jeda antar frame — hemat CPU di HP
      await new Promise((r) => setTimeout(r, 70))
    }
  }, [mode, gambarOverlay, selesaiVerifikasi, onPendaftaran])

  // ── Mulai sesi pemindaian setelah kamera siap ──
  const mulaiSesi = useCallback(() => {
    if (status !== 'siap') return
    wajahAdaRef.current = false
    setWajahAda(false)
    if (mode === 'verifikasi') {
      evaluatorRef.current = new EvaluatorLiveness(buatSesiTantangan())
      setTantangan(evaluatorRef.current.tantanganAktif)
      setProgress(0)
      setPesan('Ikuti perintah tengok kanan/kiri di layar — foto tidak bisa lolos')
    } else {
      langkahRef.current = 0
      frameStabilRef.current = 0
      sampelRef.current = []
      setLangkahAktif(0)
      setProgressLangkah(0)
      setPesan(LANGKAH_DAFTAR[0].instruksi)
    }
    setStatus('berjalan')
    void loopDeteksi()
  }, [status, mode, loopDeteksi])

  const gantiKamera = () => setMenghadapUser((v) => !v)

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-slate-900 shadow-lg">
        <video
          ref={videoRef}
          playsInline
          muted
          className={`absolute inset-0 h-full w-full object-cover ${menghadapUser ? 'scale-x-[-1]' : ''}`}
        />
        <canvas ref={canvasRef} className={`absolute inset-0 h-full w-full ${menghadapUser ? 'scale-x-[-1]' : ''}`} />

        {/* status atas */}
        <div className="absolute left-3 top-3 flex flex-wrap items-center gap-2">
          {status === 'memuat' && (
            <Badge className="bg-slate-900/80 text-white gap-1">
              <RefreshCw className="h-3 w-3 animate-spin" /> Memuat engine wajah…
            </Badge>
          )}
          {status === 'berjalan' && mode === 'verifikasi' && (
            <Badge className="bg-emerald-600/90 text-white gap-1">
              <ShieldCheck className="h-3 w-3" /> Deteksi keaslian aktif
            </Badge>
          )}
          {status === 'berjalan' && mode === 'pendaftaran' && (
            <Badge className="bg-emerald-600/90 text-white gap-1">
              <ScanFace className="h-3 w-3" /> Sampel {langkahAktif + 1}/3
            </Badge>
          )}
          {status === 'berjalan' && !wajahAda && (
            <Badge className="bg-amber-500/90 text-white">Wajah tidak terlihat</Badge>
          )}
        </div>

        {/* ganti kamera */}
        <button
          onClick={gantiKamera}
          aria-label="Ganti kamera depan/belakang"
          className="absolute right-3 top-3 rounded-full bg-slate-900/70 p-2 text-white hover:bg-slate-900"
        >
          <Camera className="h-4 w-4" />
        </button>

        {/* panel perintah bergerak */}
        {(status === 'berjalan' || status === 'memproses') && (
          <div className="absolute inset-x-0 bottom-0 space-y-2 bg-gradient-to-t from-slate-950/95 via-slate-950/70 to-transparent p-4 pt-10 text-center">
            {mode === 'verifikasi' && tantangan && (
              <p className="text-2xl font-bold tracking-wide text-white">
                <span className="mr-2">{tantangan.ikon}</span>
                {tantangan.instruksi}
              </p>
            )}
            {mode === 'pendaftaran' && (
              <p className="text-lg font-bold text-white">
                <span className="mr-2">{LANGKAH_DAFTAR[langkahAktif].ikon}</span>
                {LANGKAH_DAFTAR[langkahAktif].instruksi}
              </p>
            )}
            {pesan && <p className="text-xs text-emerald-300">{pesan}</p>}
            <Progress
              value={(mode === 'verifikasi' ? progress : progressLangkah) * 100}
              className="h-2 bg-white/20 [&>div]:bg-emerald-400"
            />
          </div>
        )}

        {/* state non-aktif */}
        {(status === 'memuat' || status === 'siap' || status === 'error' || status === 'selesai') && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-950/85 p-6 text-center">
            {status === 'error' ? (
              <>
                <CameraOff className="h-10 w-10 text-red-400" />
                <p className="text-sm text-red-200">{error}</p>
              </>
            ) : status === 'selesai' ? (
              <>
                <ShieldCheck className="h-10 w-10 text-emerald-400" />
                <p className="text-sm font-medium text-emerald-200">{pesan}</p>
              </>
            ) : status === 'siap' ? (
              <>
                <ScanFace className="h-10 w-10 text-emerald-400" />
                <p className="text-sm text-slate-200">
                  {mode === 'verifikasi'
                    ? 'Sistem akan memberi SATU perintah acak: tengok kepala ke kanan atau ke kiri — untuk memastikan wajah asli, bukan foto cetak.'
                    : 'Kamera siap. 3 sampel wajah akan diambil dengan panduan pose.'}
                </p>
              </>
            ) : (
              <RefreshCw className="h-10 w-10 animate-spin text-emerald-400" />
            )}
            {(status === 'siap' || status === 'error' || status === 'selesai') && (
              <div className="flex gap-2">
                {status !== 'selesai' && (
                  <Button onClick={mulaiSesi} className="bg-emerald-600 hover:bg-emerald-700">
                    {status === 'siap' ? 'Mulai Pindai' : 'Coba Lagi'}
                  </Button>
                )}
                {onCancel && (
                  <Button
                    variant="outline"
                    onClick={onCancel}
                    className="border-white/30 bg-white/10 text-white hover:bg-white/20"
                  >
                    Tutup
                  </Button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="mt-3 flex items-center justify-center gap-2 text-xs text-muted-foreground">
        <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
        {mode === 'verifikasi'
          ? 'Validasi gerakan kanan/kiri mencegah absensi memakai foto cetak atau rekaman.'
          : 'Sampel wajah akan diunggah ke database web sebagai acuan absensi.'}
      </div>
    </div>
  )
}
