/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      // wallpy-public R2 bucket (see lib/storage.js)
      { protocol: 'https', hostname: 'wallpy-cdn.siphyshu.me', pathname: '/**' },
    ],
  },
};

export default nextConfig;
