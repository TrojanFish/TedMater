import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",  // Required for Docker deployment
  // turbopack: {} tells Next.js 16 that Turbopack is intentional for `dev`
  turbopack: {},
  webpack: (config) => {
    // Required for onnxruntime-web (used by @huggingface/transformers) in Web Workers
    // (applies to `next build` which still uses webpack)
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
      layers: true,
    };
    return config;
  },
};

export default nextConfig;
