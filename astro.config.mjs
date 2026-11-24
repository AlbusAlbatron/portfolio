// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://alby.software',
  integrations: [sitemap({ filter: (page) => !page.includes('/404') })],
  prefetch: { prefetchAll: true, defaultStrategy: 'hover' },
  // Compression drops the space between a line-wrapped word and a following inline tag ("fall.<a>").
  compressHTML: false,
  markdown: { shikiConfig: { theme: 'github-dark' } },
});
