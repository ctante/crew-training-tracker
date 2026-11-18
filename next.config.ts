import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Schedules and checkboxes come from a live SQLite file, so pages render
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
};

export default nextConfig;
