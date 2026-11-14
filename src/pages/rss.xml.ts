import rss from '@astrojs/rss';
import type { APIRoute } from 'astro';
import { getPosts } from '../data/journal';
import { site as siteData } from '../data/site';

export const GET: APIRoute = async ({ site }) => {
  const posts = await getPosts();
  return rss({
    title: `${siteData.name} — Journal`,
    description: 'Short notes on what I’m building and learning as a software engineering student at UL.',
    site: site!,
    items: posts.map((p) => ({
      title: p.data.title,
      pubDate: p.data.date,
      description: p.data.summary,
      link: `/journal/${p.id}/`,
      categories: p.data.tags,
    })),
    customData: '<language>en-ie</language>',
  });
};
