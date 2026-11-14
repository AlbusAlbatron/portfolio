// Share images, rendered at build time: one per page, project and journal post. Satori lays out a plain
// object tree (no React) into SVG with text as paths; sharp rasterises it. Fonts come from the fontsource
// packages already installed (satori reads woff, not woff2). public/og.png stays as the generic fallback.
import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import satori from 'satori';
import sharp from 'sharp';
import { site } from '../../data/site';

interface Props {
  title: string;
  kicker: string;
  sub?: string;
}

const fontDir = (pkg: string) => join(process.cwd(), 'node_modules', '@fontsource', pkg, 'files');
const sans = readFileSync(join(fontDir('inter-tight'), 'inter-tight-latin-500-normal.woff'));
const mono = readFileSync(join(fontDir('jetbrains-mono'), 'jetbrains-mono-latin-400-normal.woff'));

export async function getStaticPaths() {
  const projects = await getCollection('projects');
  const posts = await getCollection('journal', (p) => !p.data.draft);
  const page = (slug: string, title: string, kicker: string, sub?: string) => ({
    params: { slug },
    props: { title, kicker, sub } satisfies Props,
  });
  return [
    page('home', site.name, 'Software engineering student · University of Limerick', site.status),
    page('projects', 'Things I’ve built', 'Projects'),
    page('journal', 'Notes as I go', 'Journal'),
    page('about', 'Hi, I’m Alby.', 'About'),
    page('cv', site.name, 'Curriculum vitae', 'First-year Immersive Software Engineering, UL'),
    ...projects.map((p) => page(`projects/${p.id}`, p.data.title, 'Project', p.data.tech.join(' · '))),
    ...posts.map((p) => page(`journal/${p.id}`, p.data.title, 'Journal', p.data.summary)),
  ];
}

const el = (type: string, style: Record<string, unknown>, children?: unknown) => ({
  type,
  props: { style, children },
});

// Three stacked "windows" in the corner: the site's motif.
const windows = el(
  'div',
  { position: 'absolute', right: 72, top: 72, display: 'flex', flexDirection: 'column', gap: 14 },
  [
    [0, 200],
    [28, 160],
    [56, 120],
  ].map(([offset, width]) =>
    el(
      'div',
      {
        display: 'flex',
        marginLeft: offset,
        width,
        height: 44,
        border: '2px solid #857a6c',
        borderRadius: 8,
        overflow: 'hidden',
      },
      [el('div', { width: '100%', height: 12, background: '#857a6c' })],
    ),
  ),
);

export const GET: APIRoute = async ({ props }) => {
  const { title, kicker, sub } = props as Props;
  const long = title.length > 22;
  const svg = await satori(
    el(
      'div',
      {
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        width: 1200,
        height: 630,
        padding: 72,
        background: '#26201b',
        color: '#f7f4ef',
        fontFamily: 'Inter Tight',
      },
      [
        windows,
        el('div', { fontFamily: 'JetBrains Mono', fontSize: 24, letterSpacing: 1, color: '#b1a89c', textTransform: 'uppercase' }, kicker),
        el(
          'div',
          {
            marginTop: 18,
            fontSize: long ? 76 : 104,
            lineHeight: 0.95,
            letterSpacing: long ? -3 : -5,
            maxWidth: 1000,
          },
          title,
        ),
        sub
          ? el('div', { marginTop: 28, fontSize: 28, lineHeight: 1.3, color: '#b1a89c', maxWidth: 900 }, sub.length > 110 ? `${sub.slice(0, 107)}…` : sub)
          : el('div', {}),
        el(
          'div',
          { display: 'flex', justifyContent: 'space-between', marginTop: 44, paddingTop: 24, borderTop: '1px solid #463d35', fontFamily: 'JetBrains Mono', fontSize: 22, color: '#b1a89c' },
          [el('div', {}, 'alby.software'), el('div', {}, 'Limerick, Ireland')],
        ),
      ],
    ),
    {
      width: 1200,
      height: 630,
      fonts: [
        { name: 'Inter Tight', data: sans, weight: 500, style: 'normal' },
        { name: 'JetBrains Mono', data: mono, weight: 400, style: 'normal' },
      ],
    },
  );
  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  return new Response(png, { headers: { 'Content-Type': 'image/png' } });
};
