import { NextResponse } from "next/server";

/** Health-check sederhana untuk verifikasi deploy (Vercel) */
export async function GET() {
  return NextResponse.json({
    message: "API Absensi Wajah aktif",
    waktu: new Date().toISOString(),
  });
}
