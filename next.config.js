/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: { appDir: true },
  images: {
    domains: ['localhost', 'avatars.githubusercontent.com'],
    remotePatterns: [{ protocol: 'https', hostname: '**.supabase.co' }]
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = { fs: false, net: false, tls: false };
    }
    return config;
  }
};
module.exports = nextConfig;
