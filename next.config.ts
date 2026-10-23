import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin();

const svgrOptions = {
  svgoConfig: {
    plugins: [
      {
        name: "preset-default",
        params: {
          overrides: {
            removeViewBox: false,
          },
        },
      },
    ],
  },
};

const nextConfig: NextConfig = {
  /* config options here */
  logging: {
    incomingRequests: {
      ignore: [
        /^\/api\/auth\/google\/callback(?:\?|$)/,
        /^\/reset-password(?:\?|$)/,
        /^\/verify-email(?:\?|$)/,
      ],
    },
  },
  webpack(config) {
    config.module.rules.push({
      test: /\.svg$/,
      use: [
        {
          loader: "@svgr/webpack",
          options: svgrOptions,
        },
      ],
    });
    return config;
  },
  images: {
    localPatterns: [
      {
        pathname: "/**",
      },
    ],
  },
  turbopack: {
    root: __dirname,
    rules: {
      "*.svg": {
        loaders: [
          {
            loader: "@svgr/webpack",
            options: svgrOptions,
          },
        ],
        as: "*.js",
      },
    },
  },
};

export default withNextIntl(nextConfig);
