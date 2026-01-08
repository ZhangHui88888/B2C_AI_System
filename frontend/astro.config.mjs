// @ts-check
import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import cloudflare from '@astrojs/cloudflare';

const publicApiUrl = process.env.PUBLIC_API_URL || '';
const devApiTarget = (process.env.DEV_API_TARGET || (/localhost|127\.0\.0\.1/i.test(publicApiUrl) ? publicApiUrl : 'http://localhost:8787')).replace(/\/$/, '');

// https://astro.build/config
export default defineConfig({
  integrations: [tailwind()],
  output: 'server',
  adapter: cloudflare(),
  site: process.env.PUBLIC_SITE_URL || 'https://your-domain.com',
  vite: {
    server: {
      proxy: {
        '/api': {
          target: devApiTarget,
          changeOrigin: true,
          secure: false,
        },
      },
    },
    build: {
      cssMinify: true,
    },
  },
  image: {
    domains: ['your-cdn.com'],
  },
});
