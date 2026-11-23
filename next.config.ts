import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  compress: true,
  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "recharts",
      "framer-motion",
      "xlsx",
      "@dnd-kit/core",
      "@dnd-kit/sortable",
    ],
  },
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "www.spindo.com",
        port: "",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "irp.cdn-website.com",
        port: "",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
