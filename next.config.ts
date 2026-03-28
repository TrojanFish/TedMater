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
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://static.cloudflareinsights.com",
      // Inline styles (Next.js emotion / tailwind)
      "style-src 'self' 'unsafe-inline'",
      // TED CDN, YouTube, Vimeo, Google, etc. (Allow both http/https for local/proxied environments)
      "img-src 'self' data: blob: *.ted.com *.tedcdn.com *.akamaihd.net *.ytimg.com *.vimeocdn.com *.googleusercontent.com *.cloudfront.net",
      // HLS/MP4 media sources
      "media-src 'self' blob: *.ted.com *.tedcdn.com *.akamaihd.net *.vimeocdn.com",
      // API connections (Gemini, Cloudflare, etc.)
      "connect-src 'self' https://generativelanguage.googleapis.com https://cloudflareinsights.com *.ted.com *.tedcdn.com *.akamaihd.net",
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
