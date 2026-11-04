// Service worker — cache shell + model wajah agar aplikasi tetap jalan di HP
const CACHE = 'absensi-wajah-v1'
const ASSETS = [
  '/',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/vendor/face-api.js',
  '/models/face-api/tiny_face_detector_model-weights_manifest.json',
  '/models/face-api/tiny_face_detector_model.bin',
  '/models/face-api/face_landmark_68_model-weights_manifest.json',
  '/models/face-api/face_landmark_68_model.bin',
  '/models/face-api/face_recognition_model-weights_manifest.json',
  '/models/face-api/face_recognition_model.bin',
  '/models/face-api/face_expression_model-weights_manifest.json',
  '/models/face-api/face_expression_model.bin',
]

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(ASSETS).catch(() => {})).then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url)
  if (e.request.method !== 'GET') return

  // API: network-first (data selalu fresh, cache cadangan offline)
  if (url.pathname.startsWith('/api/')) {
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          const copy = res.clone()
          caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {})
          return res
        })
        .catch(() => caches.match(e.request))
    )
    return
  }

  // Aset: cache-first
  e.respondWith(
    caches.match(e.request).then(
      (hit) =>
        hit ||
        fetch(e.request).then((res) => {
          if (res.ok && (url.origin === location.origin)) {
            const copy = res.clone()
            caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {})
          }
          return res
        })
    )
  )
})
