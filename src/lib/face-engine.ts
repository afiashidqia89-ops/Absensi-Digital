// Engine pengenalan wajah (client-side) — face-api.js via script statis
// agar tidak disentuh bundler Next.js/Turbopack (self-contained IIFE + TFJS).

declare global {
  interface Window {
    faceapi?: any
  }
}

let loadScriptPromise: Promise<any> | null = null
let modelsLoaded = false

/** Muat pustaka face-api (sekali saja) */
export function loadFaceApi(): Promise<any> {
  if (typeof window === 'undefined') return Promise.reject(new Error('Hanya di browser'))
  if (window.faceapi) return Promise.resolve(window.faceapi)
  if (!loadScriptPromise) {
    loadScriptPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script')
      s.src = '/vendor/face-api.js'
      s.async = true
      s.onload = () => resolve(window.faceapi)
      s.onerror = () => {
        loadScriptPromise = null
        reject(new Error('Gagal memuat pustaka pengenalan wajah'))
      }
      document.head.appendChild(s)
    })
  }
  return loadScriptPromise
}

/** Muat pustaka + model wajah (detektor, landmark, descriptor) */
export async function getFaceEngine(): Promise<any> {
  const faceapi = await loadFaceApi()
  if (!modelsLoaded) {
    const uri = '/models/face-api'
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(uri),
      faceapi.nets.faceLandmark68Net.loadFromUri(uri),
      faceapi.nets.faceRecognitionNet.loadFromUri(uri),
    ])
    modelsLoaded = true
  }
  return faceapi
}

export function detektorOptions(faceapi: any) {
  return new faceapi.TinyFaceDetectorOptions({
    inputSize: 320,
    scoreThreshold: 0.5,
  })
}

export interface HasilDeteksi {
  terdeteksi: boolean
  skor: number
  box: { x: number; y: number; width: number; height: number } | null
  descriptor: number[] | null
  ear: number // eye aspect ratio (kedip)
  happy: number // probabilitas senyum
  bukaanMulut: number // rasio bukaan mulut
  noseRatio: number // posisi hidung dalam box 0..1 (kiri..kanan)
  areaRatio: number // luas box / luas frame
}

/** Ambil jarak antar dua mata (EAR) dari landmark */
function hitungEAR(eye: any[]): number {
  const d = (a: any, b: any) => Math.hypot(a.x - b.x, a.y - b.y)
  const vert = d(eye[1], eye[5]) + d(eye[2], eye[4])
  const horiz = d(eye[0], eye[3])
  return horiz === 0 ? 0 : vert / (2 * horiz)
}

/** Deteksi lengkap 1 frame video: wajah + landmark + descriptor */
export async function deteksiFrame(faceapi: any, video: HTMLVideoElement): Promise<HasilDeteksi> {
  const kosong: HasilDeteksi = {
    terdeteksi: false, skor: 0, box: null, descriptor: null,
    ear: 0, happy: 0, bukaanMulut: 0, noseRatio: 0.5, areaRatio: 0,
  }
  if (!video.videoWidth) return kosong
  const opts = detektorOptions(faceapi)
  // liveness kini cukup gerakan tengok kanan/kiri — jaring ekspresi tidak dibutuhkan
  const hasil = await faceapi
    .detectSingleFace(video, opts)
    .withFaceLandmarks()
    .withFaceDescriptor()
  if (!hasil) return kosong

  const { detection, landmarks } = hasil
  const box = detection.box
  // EAR rata-rata dua mata
  const eyeL = landmarks.getLeftEye()
  const eyeR = landmarks.getRightEye()
  const ear = (hitungEAR(eyeL) + hitungEAR(eyeR)) / 2

  // Bukaan mulut: jarak bibir dalam atas-bawah / jarak hidung-dagu
  const pts = landmarks.positions
  const hidungDagu = Math.hypot(pts[33].x - pts[8].x, pts[33].y - pts[8].y)
  const bukaanMulut = hidungDagu === 0 ? 0 : Math.hypot(pts[62].x - pts[66].x, pts[62].y - pts[66].y) / hidungDagu

  // Posisi ujung hidung relatif dalam bounding box
  const noseRatio = (pts[30].x - box.x) / box.width

  const frameArea = video.videoWidth * video.videoHeight

  return {
    terdeteksi: true,
    skor: detection.score,
    box: { x: box.x, y: box.y, width: box.width, height: box.height },
    descriptor: Array.from(hasil.descriptor as Float32Array),
    ear,
    happy: 0, // jaring ekspresi dimatikan — liveness cukup gerakan kanan/kiri
    bukaanMulut,
    noseRatio,
    areaRatio: (box.width * box.height) / frameArea,
  }
}

/** Jarak Euclidean dua descriptor 128-d */
export function jarakDescriptor(a: number[], b: number[]): number {
  if (!a || !b || a.length !== b.length) return Infinity
  let sum = 0
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i]
    sum += d * d
  }
  return Math.sqrt(sum)
}

/** Tangkap frame video ke dataURL JPEG */
export function tangkapFrame(video: HTMLVideoElement, ukuran = 480, kualitas = 0.82): string {
  const scale = Math.min(1, ukuran / Math.max(video.videoWidth, video.videoHeight))
  const w = Math.round(video.videoWidth * scale)
  const h = Math.round(video.videoHeight * scale)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(video, 0, 0, w, h)
  return canvas.toDataURL('image/jpeg', kualitas)
}
