// Jarak antar descriptor wajah — dipakai client & server (tanpa API browser)
export function jarakDescriptor(a: number[], b: number[]): number {
  if (!a || !b || a.length !== b.length) return Infinity
  let sum = 0
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i]
    sum += d * d
  }
  return Math.sqrt(sum)
}

export const AMBANG_MATCH_WAJAH = 0.55
