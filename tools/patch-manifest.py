#!/usr/bin/env python3
"""Menambahkan android:screenOrientation="sensorLandscape" ke MainActivity
di AndroidManifest.xml hasil generate Capacitor, agar game selalu landscape.

Dipanggil oleh GitHub Actions setelah `npx cap add android`.
Aman dijalankan berulang (idempoten).
"""
import re
import sys


def main(path: str) -> None:
    with open(path, "r", encoding="utf-8") as f:
        src = f.read()

    if 'android:screenOrientation' in src:
        print("[patch-manifest] screenOrientation sudah ada, lewati.")
        return

    def repl(m: "re.Match[str]") -> str:
        tag = m.group(0)
        if 'android:name=".MainActivity"' in tag and "screenOrientation" not in tag:
            return tag[:-1] + ' android:screenOrientation="sensorLandscape">'
        return tag

    out, n = re.subn(r"<activity[^>]*>", repl, src)
    if out == src:
        print("[patch-manifest] PERINGATAN: tidak ada perubahan (tag activity tidak ditemukan).")
    else:
        with open(path, "w", encoding="utf-8") as f:
            f.write(out)
        print(f"[patch-manifest] OK: {n} tag activity diperiksa, MainActivity dikunci landscape.")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Pemakaian: python3 tools/patch-manifest.py <path/AndroidManifest.xml>")
        sys.exit(1)
    main(sys.argv[1])
