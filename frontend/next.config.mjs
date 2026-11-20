import path from "node:path";
import { fileURLToPath } from "node:url";

/** @type {import('next').NextConfig} */

const isDev = process.env.NODE_ENV !== "production";
const appDir = path.dirname(fileURLToPath(import.meta.url));

const nextConfig = {
  ...(isDev ? {} : { output: "export" }),
  // Keep tracing rooted on the frontend app even when a parent yarn.lock exists
  // (Frappe Cloud runs yarn at the app root during install).
  outputFileTracingRoot: appDir,
  basePath: "/transport",
  assetPrefix: isDev ? "" : "/assets/ultrafreight/frontend",
  typescript: { ignoreBuildErrors: true },
  images: { unoptimized: true },
  ...(isDev
    ? {
        async rewrites() {
          const frappeUrl = process.env.FRAPPE_URL || "http://localhost:8000";
          return [
            { source: "/api/:path*", destination: `${frappeUrl}/api/:path*` },
            {
              source: "/files/:path*",
              destination: `${frappeUrl}/files/:path*`,
            },
            {
              source: "/assets/ultrafreight/:path*",
              destination: `${frappeUrl}/assets/ultrafreight/:path*`,
            },
          ];
        },
      }
    : {}),
};

export default nextConfig;
