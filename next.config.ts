import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'www.spindo.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'irp.cdn-website.com',
        port: '',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
