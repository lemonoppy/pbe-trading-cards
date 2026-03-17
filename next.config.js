module.exports = {
  swcMinify: true,
  transpilePackages: ['crypto-js', 'react-slick'],
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'sim-football.com',
        port: '',
        pathname: '/dotts/**',
      },
      {
        protocol: 'https',
        hostname: 'sim-football.com',
        port: '',
        pathname: '/uploads/avatars/**',
      },
      {
        protocol: 'https',
        hostname: 'cdn.discordapp.com',
        port: '',
        pathname: '/attachments/**',
      },
    ],
  },
  webpack: (config, { isServer, dev }) => {
    config.module.rules.push({
      test: /\.svg$/i,
      issuer: /\.[jt]sx?$/,
      use: [
        {
          loader: '@svgr/webpack',
          options: {
            svgoConfig: {
              plugins: ['preset-default'],
            },
            dimensions: false,
            memo: true,
            svgProps: {
              role: 'img',
            },
          },
        },
      ],
    })

    // Fix for slick-carousel CSS on Vercel
    config.resolve.alias = {
      ...config.resolve.alias,
    }

    return config
  },
  i18n: {
    locales: ['en'],
    defaultLocale: 'en',
  },
}
