import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [],
  async rewrites() {
    return [
      { source: "/cuciin", destination: "/cuciin/index.html" },
      { source: "/cuciin/", destination: "/cuciin/index.html" },
    ];
  },
};

export default nextConfig;
