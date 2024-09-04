/** @type {import('next').NextConfig} */
const nextConfig = {
  /// start
  experimental: {
    serverMinification: false,
    ppr: true,
  },
  webpack: (config) => {
    config.optimization.minimize = false;
    return config;
  },
  compress: false,
  /// end

  poweredByHeader: false,
  output: 'standalone',
  eslint: {
    ignoreDuringBuilds: true,
  },
};

module.exports = nextConfig;
