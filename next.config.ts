import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone output produces a self-contained server bundle in
  // `.next/standalone/` with only the runtime deps it actually uses. Cuts
  // the App Service zip from ~hundreds of MB (full node_modules) to single
  // digits and skips post-deploy `npm install`.
  output: "standalone",
};

export default nextConfig;
