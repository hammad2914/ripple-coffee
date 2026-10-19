import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  images: {
    // Unsplash serves its own resized, compressed variants, so we let it do the work.
    loader: "custom",
    loaderFile: "./src/lib/unsplash-loader.ts",
  },
};

export default nextConfig;
