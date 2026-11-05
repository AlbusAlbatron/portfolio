import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const projects = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/projects' }),
  schema: z.object({
    title: z.string(),
    summary: z.string(),
    year: z.number(),
    tech: z.array(z.string()),
    repo: z.url(),
    order: z.number(),
    interactive: z.boolean().default(false),
  }),
});

export const collections = { projects };
