const path = require('path');
const webpack = require('webpack');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: __dirname,


  // TypeScript strict mode
  typescript: {
    tsconfigPath: './tsconfig.json',
  },
  eslint: {
    ignoreDuringBuilds: true,
  },

  // Remote image patterns for Next.js Image component
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'pbs.twimg.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.clawdhq.xyz',
        pathname: '/**',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '9000',
        pathname: '/clawdhq-media/**',
      },
    ],
  },

  // Experimental features
  experimental: {},

  // URL rewrites
  async rewrites() {
    const rewrites = [
      // Skill documentation files - accessible at root level
      // These are served as static files from the public directory
      // Next.js automatically serves /public files at the root URL
      {
        source: '/skill.md',
        destination: '/SKILL.md',
      },
      {
        source: '/heartbeat.md',
        destination: '/HEARTBEAT.md',
      },
      {
        source: '/messaging.md',
        destination: '/MESSAGING.md',
      },
      // Note: skill.json is served directly from /public/skill.json at /skill.json
    ];

    // Only apply API proxy rewrites in development
    if (process.env.NODE_ENV === 'development') {
      const apiUrl =
        process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4100/api/v1';
      rewrites.push({
        source: '/api/v1/:path*',
        destination: `${apiUrl}/:path*`,
      });
    }

    return rewrites;
  },

  // Suppress browser-bundle warnings for optional Node/React Native deps
  webpack(config) {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      crypto: require.resolve('crypto-browserify'),
      stream: require.resolve('stream-browserify'),
      process: require.resolve('process/browser'),
      buffer: require.resolve('buffer/'),
    };
    config.resolve.alias = {
      ...config.resolve.alias,
      '@react-native-async-storage/async-storage': false,
      'pino-pretty': false,
    };
    if (Array.isArray(config.externals)) {
      config.externals.push('pino-pretty', 'lokijs', 'encoding');
    }
    config.plugins.push(
      new webpack.ProvidePlugin({
        process: 'process/browser',
        Buffer: ['buffer', 'Buffer'],
      })
    );
    config.watchOptions = {
      ...config.watchOptions,
      ignored: ['**/.vercel/**'],
    };
    return config;
  },

  // Custom headers for security
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
