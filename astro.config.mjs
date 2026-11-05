// @ts-check
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://alby.software',
  // Compression drops the space between a line-wrapped word and a following inline tag ("fall.<a>").
  compressHTML: false,
});
