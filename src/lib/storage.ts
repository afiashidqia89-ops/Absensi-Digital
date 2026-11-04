// ─────────────────────────────────────────────────────────────
// Penyimpanan foto absensi & pendaftaran wajah.
// FOTO DISIMPAN DI DATABASE (dataURL base64 pada kolom TEXT),
// BUKAN di filesystem — agar kompatibel dengan Vercel
// (filesystem read-only pada serverless) dan Neon Postgres.
// Foto dikompres di sisi client (JPEG ±480px, ±20-50KB).
// ─────────────────────────────────────────────────────────────

/** Validasi dataURL JPEG/PNG → kembalikan dataURL untuk disimpan di DB (TEXT). */
export async function simpanFoto(dataUrl: string): Promise<string> {
  const m = /^data:image\/(jpeg|png|jpg);base64,(.+)$/.exec(dataUrl)
  if (!m) throw new Error('Format foto tidak valid')
  const buf = Buffer.from(m[2], 'base64')
  if (buf.length > 5 * 1024 * 1024) throw new Error('Ukuran foto terlalu besar (maks 5MB)')
  if (buf.length === 0) throw new Error('Foto kosong')
  return dataUrl
}

/** Ambil keterangan setting, dengan default bila belum diatur */
export const SETTING_KEYS = {
  jamMasuk: 'jamMasuk',
  jamKeluar: 'jamKeluar',
} as const
