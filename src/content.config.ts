import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

// Project media lives in src/assets/projects/<id>/ and is referenced relative to the markdown file
// (e.g. `cover: ../../assets/projects/wingravity/cover.png`). Every media field is optional: the layout
// renders nothing for a project without any.
const projects = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/projects' }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      summary: z.string(),
      year: z.number(),
      tech: z.array(z.string()),
      repo: z.url(),
      order: z.number(),
      interactive: z.boolean().default(false),
      /** Small pill on the project row, e.g. "Playable" or "Colophon". */
      badge: z.string().optional(),
      /** Shown at the top of the project page (unless there is a video) and as the hover preview in lists. */
      cover: image().optional(),
      /** Screenshots under the header, each with alt text and an optional caption. */
      gallery: z.array(z.object({ src: image(), alt: z.string(), caption: z.string().optional() })).optional(),
      /** A real recording. Filenames inside src/assets/projects/<id>/; the poster is an image import. */
      video: z
        .object({ webm: z.string().optional(), mp4: z.string().optional(), poster: image() })
        .refine((v) => v.webm || v.mp4, 'video needs a webm or an mp4 file')
        .optional(),
    }),
});

const journal = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/journal' }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    summary: z.string(),
    tags: z.array(z.string()).default([]),
    /** Drafts render in `astro dev` only. */
    draft: z.boolean().default(false),
  }),
});

export const collections = { projects, journal };
