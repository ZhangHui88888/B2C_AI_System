// @ts-check
import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import cloudflare from '@astrojs/cloudflare';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const publicApiUrl = process.env.PUBLIC_API_URL || '';
const devApiTarget = (process.env.DEV_API_TARGET || (/localhost|127\.0\.0\.1/i.test(publicApiUrl) ? publicApiUrl : 'http://localhost:8787')).replace(/\/$/, '');

// https://astro.build/config
export default defineConfig({
  integrations: [tailwind()],
  output: 'server',
  adapter: cloudflare(),
  site: process.env.PUBLIC_SITE_URL || 'https://your-domain.com',
  vite: {
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        '@components': path.resolve(__dirname, './src/components'),
        '@layouts': path.resolve(__dirname, './src/layouts'),
        '@styles': path.resolve(__dirname, './src/styles'),
        '@lib': path.resolve(__dirname, './src/lib'),
        '@assets': path.resolve(__dirname, './src/assets'),
      },
    },
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
