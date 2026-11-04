import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // output "standalone" hanya untuk preview sandbox;
  // di Vercel memakai output default platform (@vercel/next).
  ...(process.env.VERCEL ? {} : { output: "standalone" as const }),
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
