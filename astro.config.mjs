// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://alby.software',
  integrations: [sitemap({ filter: (page) => !page.includes('/404') })],
  // Fetch the next page while the cursor is on its link, so the page wipe never waits on the network.
  prefetch: { prefetchAll: true, defaultStrategy: 'hover' },
  // Compression drops the space between a line-wrapped word and a following inline tag ("fall.<a>").
  compressHTML: false,
  // Code colours come from --astro-code-* in global.css (warm palette, all >= 6:1 contrast).
  markdown: { shikiConfig: { theme: 'css-variables' } },
  // three.js is its own chunk, lazy-loaded only by the home hero.
  vite: { build: { chunkSizeWarningLimit: 800 } },
});
