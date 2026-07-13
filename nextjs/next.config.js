/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",

  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: process.env.WP_API_HOSTNAME ?? "api.example.com",
        pathname: "/wp-content/uploads/**",
      },
    ],
  },

  // Strict mode for better debugging
  reactStrictMode: true,
};

module.exports = nextConfig;
