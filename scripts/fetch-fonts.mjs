// Downloads Fontshare fonts into public/fonts/ before dev/build.
//
// Fontshare's free licence (ITF FFL) allows self-hosting on your own website but not redistributing the files
// through a public repository, so they are fetched here instead of committed (public/fonts/ is git-ignored).
// If the download fails (offline), the build carries on and the CSS falls back to the next font in the stack.
import { mkdir, writeFile, access } from 'node:fs/promises';

const FONTS = [{ slug: 'tanker', weight: 400, file: 'tanker-400.woff2' }];
const outDir = new URL('../public/fonts/', import.meta.url);

await mkdir(outDir, { recursive: true });
for (const font of FONTS) {
  const target = new URL(font.file, outDir);
  try {
    await access(target);
    continue; // already downloaded
  } catch {
    /* not there yet */
  }
  try {
    const css = await (await fetch(`https://api.fontshare.com/v2/css?f[]=${font.slug}@${font.weight}&display=swap`)).text();
    const match = css.match(/url\('([^']+\.woff2)'\)/);
    if (!match) throw new Error('no woff2 in Fontshare CSS');
    const url = match[1].startsWith('//') ? `https:${match[1]}` : match[1];
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    await writeFile(target, Buffer.from(await res.arrayBuffer()));
    console.log(`fonts: downloaded ${font.file}`);
  } catch (err) {
    console.warn(`fonts: could not download ${font.slug} (${err.message}); falling back`);
  }
}
