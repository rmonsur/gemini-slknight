/** @type {import('next').NextConfig} */
const nextConfig = {
    // Enable React Strict Mode for better debugging
    reactStrictMode: true,

    // Output standalone for Docker deployment
    output: 'standalone',

    // Image optimization with remotePatterns (Next.js 16+)
    images: {
        remotePatterns: [
            {
                protocol: 'https',
                hostname: 'firebasestorage.googleapis.com',
            },
        ],
    },

    // Environment variables exposed to browser
    env: {
        NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
        NEXT_PUBLIC_MAPBOX_TOKEN: process.env.NEXT_PUBLIC_MAPBOX_TOKEN,
    },

    // Proxy API requests to Express backend (critical for Cloud Run)
    async rewrites() {
        return [
            {
                source: '/api/:path*',
                destination: 'http://localhost:3001/api/:path*',
            },
        ];
    },

    // Empty turbopack config to silence Next.js 16 warning
    turbopack: {},

    // Webpack config for Three.js (used when running with --webpack flag)
    webpack: (config) => {
        config.externals = [...(config.externals || []), { canvas: 'canvas' }];
        return config;
    },
};

export default nextConfig;

