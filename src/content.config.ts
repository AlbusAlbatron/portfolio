import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

// Images live in src/assets/projects/<id>/ and are referenced relative to the markdown file,
// e.g. `cover: ../../assets/projects/wingravity/cover.png`. Both image fields are optional.
const projects = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/projects' }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      /** Short caption under the title in lists, e.g. "Desktop physics engine". */
      kind: z.string(),
      summary: z.string(),
      year: z.number(),
      tech: z.array(z.string()),
      repo: z.url(),
      order: z.number(),
      cover: image().optional(),
      gallery: z.array(z.object({ src: image(), alt: z.string(), caption: z.string().optional() })).optional(),
    }),
});

export const collections = { projects };
