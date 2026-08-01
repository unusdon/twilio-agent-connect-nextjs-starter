/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@tac-starter/shared"],
  experimental: {
    typedRoutes: true,
  },
};

export default nextConfig;
