/** @type {import('next').NextConfig} */
const nextConfig = {
  /// start
  experimental: {
    serverMinification: false,
    ppr: true,
  },
  compress: false,
  /// end

  poweredByHeader: false,
  output: 'standalone',
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
};

module.exports = nextConfig;
