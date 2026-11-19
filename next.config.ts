import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Schedules and checkboxes come from the live database, so pages render
  // per request instead of a cached shell.
  cacheComponents: false,
  serverExternalPackages: ["@prisma/client", "prisma"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: "frame-src 'self' https://drive.google.com https://docs.google.com https://accounts.google.com;",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
