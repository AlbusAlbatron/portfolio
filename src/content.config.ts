import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { sectionSlugs } from './data/journal';

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

// Journal entries (CareersLab portfolio). `section` is one of the slugs in src/data/journal.ts. Undated entries
// (e.g. a profile) sit at the top of their section; dated ones are grouped by week. `media` items with a `src`
// show the photo; without one they show a visible "Image to come" placeholder with the caption. Video slots
// (`type: video`) play the file in `video` (public/journal/) or show a "Video to come" placeholder until it's added.
// Photos go in src/assets/journal/, referenced relative to the md file (e.g. ../../assets/journal/tower.jpg).
const journal = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/journal' }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      section: z.enum(sectionSlugs),
      date: z.coerce.date().optional(),
      week: z.number().optional(),
      /** Who gave the talk or ran the session, shown under the title. */
      speaker: z.string().optional(),
      summary: z.string(),
      order: z.number().default(0),
      media: z
        .array(
          z.object({
            caption: z.string(),
            alt: z.string().optional(),
            /** A photo (path relative to the md file, in src/assets/journal/). */
            src: image().optional(),
            /** A video slot. Set `video` to a file in public/journal/ (e.g. /journal/fpv-crash.mp4) once it exists. */
            type: z.enum(['image', 'video']).default('image'),
            video: z.string().optional(),
            poster: image().optional(),
          }),
        )
        .default([]),
    }),
});

export const collections = { projects, journal };
