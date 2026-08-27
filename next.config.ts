import type { NextConfig } from "next";
import path from "node:path";

const config: NextConfig = {
  // Pin the workspace root: a stray package-lock.json in the user's home
  // directory otherwise makes Next infer C:\Users\Dennis as the root.
  outputFileTracingRoot: path.join(__dirname),
  experimental: { serverActions: { bodySizeLimit: "12mb" } },
};

export default config;
