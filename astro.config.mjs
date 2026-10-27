// @ts-check
import { defineConfig, fontProviders } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

// Served from the omron-sinicx/projects repo → https://omron-sinicx.github.io/projects/
export default defineConfig({
  site: 'https://omron-sinicx.github.io',
  base: '/projects',
  trailingSlash: 'always',
  output: 'static',
  image: { domains: ['omron-sinicx.github.io'] },
  vite: { plugins: [tailwindcss()] },
  fonts: [
    {
      name: 'Inter',
      cssVariable: '--font-inter',
      provider: fontProviders.fontsource(),
      weights: [400, 500, 600, 700],
      subsets: ['latin'],
      fallbacks: ['sans-serif'],
    },
    {
      name: 'Krona One',
      cssVariable: '--font-krona',
      provider: fontProviders.fontsource(),
      weights: [400],
      subsets: ['latin'],
      fallbacks: ['sans-serif'],
    },
  ],
});
