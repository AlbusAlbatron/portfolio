import { getCollection, type CollectionEntry } from 'astro:content';

export type Post = CollectionEntry<'journal'>;

/** Published posts, newest first. Drafts are included in `astro dev` only. */
export async function getPosts(): Promise<Post[]> {
  const posts = await getCollection('journal', (p) => import.meta.env.DEV || !p.data.draft);
  return posts.sort((a, b) => b.data.date.getTime() - a.data.date.getTime());
}

export function readingTime(body: string | undefined): number {
  const words = (body ?? '').split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 220));
}

export const dateFormat = new Intl.DateTimeFormat('en-IE', { day: 'numeric', month: 'long', year: 'numeric' });
