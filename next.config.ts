import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-XSS-Protection", value: "1; mode=block" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      // Next.js inline scripts + HMR
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      // Inline styles (Next.js emotion / tailwind)
      "style-src 'self' 'unsafe-inline'",
      // TED CDN thumbnails + video segments
      "img-src 'self' data: blob: https://*.ted.com https://*.tedcdn.com https://*.akamaihd.net",
      // HLS/MP4 from TED CDN; Web Worker blob URLs
      "media-src 'self' blob: https://*.ted.com https://*.tedcdn.com https://*.akamaihd.net",
      // HLS.js XHR to TED CDN segments + Gemini API
      "connect-src 'self' https://*.ted.com https://*.tedcdn.com https://*.akamaihd.net https://generativelanguage.googleapis.com",
      // Web Workers (Whisper / HLS.js)
      "worker-src 'self' blob:",
      // Fonts
      "font-src 'self' data:",
      "frame-ancestors 'none'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  output: "standalone",
  turbopack: {},
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
  webpack: (config) => {
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
      layers: true,
    };
    return config;
  },
};

export default nextConfig;
