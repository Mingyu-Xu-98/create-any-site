import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "50mb",
    },
  },
  async rewrites() {
    return [
      {
        source: "/drafts/:path*",
        destination: "http://localhost:3002/drafts/:path*",
      },
      {
        source: "/:siteId([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/:path*",
        destination: "http://localhost:3002/:siteId/:path*",
      },
      {
        source: "/:siteId([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})",
        destination: "http://localhost:3002/:siteId",
      },
    ];
  },
};
export default nextConfig;
