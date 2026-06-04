import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@meetflow/shared-types"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" },
    ],
  },
};

export default nextConfig;
