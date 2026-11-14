# Alby's portfolio (alby.software)

Graded portfolio for a first-year Immersive Software Engineering student at UL. Astro 7, static output,
TypeScript strict, plain CSS, vanilla TS for interactivity — no React/Tailwind. Deployed to GitHub Pages
via `.github/workflows/deploy.yml` on push to `main`; custom domain in `public/CNAME`.

See AGENTS.md for Astro dev-server commands. Check work with `npx astro check` and `npm run build`.

## Design rules
- Medium interactivity: page wipe between pages, smooth scroll (Lenis), parallax, split-text headings, custom
  cursor, scroll reveals, film grain. The WinGravity page is the one deliberate showpiece. Everything must
  respect `prefers-reduced-motion`, work at ~400px, and fall back to native behaviour on touch.
- Two surfaces, no bright accent colour: warm dark and warm white (`light`). The whole page eases between them
  as you scroll. Use the semantic tokens in `src/styles/global.css` (`--bg`, `--bg-raised`, `--text`, `--text-soft`,
  `--text-muted`, `--line`, …), never hard-coded colours. `--text-faint` fails contrast: decoration only.
- Fonts: Inter Tight (sans) + JetBrains Mono (labels), self-hosted via @fontsource.
- Copy is in Alby's voice, first person, plain and honest — no inflated claims.

## Conventions
- Surfaces: tag each top-level block `data-surface="dark"` or `"light"`; every page starts with a dark header.
  `src/scripts/surface.ts` switches `html[data-surface]` when a block crosses 25% down the viewport.
  Anything that must stay dark on a light page (WinGravity desktop, footer) gets `.theme-dark` and paints its
  own `background: var(--bg)`. Code blocks use literal dark palette values.
- Big headings: `<SplitText text="…" by="word|char" />` (staggered rise), optionally `data-parallax="0.12"`.
- Cursor states: `data-cursor="view"` or `"drag"` on an element; links/buttons get the hover ring automatically.
- Liquid ripple: `data-liquid` on large display text only (SplitText adds it). `src/scripts/liquid.ts` moves one
  shared WebGL2 canvas into the hovered element and hands back to the DOM text once the ripples settle. Never on
  links or body copy.
- 3D tilt: `data-tilt="5"` (max degrees) plus optional `data-glare`; glare targets must be positioned. Tilt
  uses the CSS `rotate` property, so anything that is also moved must use `translate`, not `transform`
  (WinGravity windows, CV hover cards).
- Magnetic pull applies automatically to `.button`, nav links and WinGravity taskbar buttons.
- Home 3D scene: `src/scripts/hero3d.ts`, dynamically imported by `index.astro` on the first interaction
  (pointer/scroll/keys, idle fallback) and never on phones, Save-Data or low-end devices; renders only while
  visible, ~30fps when idle. Use named three imports (tree-shaking) and avoid generated environment maps or
  physical materials — they froze the page for ~0.6s on mount. Keep three.js out of every other page.
- Section index + reading progress: tag sections `data-index="Label"` (prose `h2`s are picked up
  automatically); `src/scripts/progress.ts` builds the left-margin index (≥ 87.5rem wide only).
- Project titles' letter-weight effect needs the per-letter `.wl` spans in `ProjectList.astro` plus an
  `sr-only` copy of the title.
- Skills marquee: `<Marquee items={...} label="..." />`; speed and lean follow scroll velocity.
- `src/styles/desktop.css` is the shared WinGravity desktop shell (WinGravity page and `404.astro`).
  `data-autostart="ms"` on `[data-desktop]` turns gravity on by itself.
- Share image `public/og.png` (1200×630) and `public/apple-touch-icon.png` are rendered from HTML designs —
  regenerate them if the name, tagline or palette changes. Code highlighting uses Shiki's `css-variables`
  theme with the `--astro-code-*` palette, scoped to `.astro-code` in `global.css`. Keep custom properties
  off `:root` unless every element needs them: they are inherited everywhere and slow full-page restyles.
- Links prefetch on hover (`prefetch` in `astro.config.mjs`); fonts are preloaded in `Base.astro`.
- Home hero intro (`src/scripts/heroIntro.ts`): once the 3D scene is ready, each fact pops out of the static
  card as a lookalike window and flies onto its 3D twin (CSS homography onto `scene.project(i)`), then
  cross-fades into WebGL. Flyer colours in `global.css` match the lit 3D windows — retune if lighting changes.
- Quality bar: Lighthouse 97–100 on every page (desktop + mobile), axe clean, CLS 0.
- `<html>` attributes are replaced on every navigation, so anything that adds classes to it (Lenis,
  `has-cursor`, `js`) re-adds them on `astro:after-swap`.
- `compressHTML` is off: it strips the space between a line-wrapped word and a following inline tag. The flip
  side: markup where whitespace would show as gaps (e.g. `SplitText`'s inline-block spans) must be on one line.
- `transition:persist` must go on an element inside a component (see `Cursor.astro`, `PageWipe.astro`); on a
  `<Component />` tag it is silently ignored and the element is replaced on every navigation.
- Avoid `mix-blend-mode`/`backdrop-filter` on full-screen fixed layers — they made scrolling and the cursor janky.
- Title morphs (`src/scripts/morph.ts`): project row ↔ project page navigations (click, "← All projects",
  browser Back) skip the page wipe and morph the title with a native view transition. Both ends carry
  `data-vt="project-<id>"`; the `view-transition-name` is set only on the pair being morphed, never statically
  (named elements would fly over the wipe on other navigations).
- Home field (`src/scripts/field/`): WebGPU stable-fluids sim + 2D radiance-cascade light on a fixed canvas at
  z-index -1, home page only, loaded after the hero 3D scene. `data-field` marks what blocks the fluid and
  casts shadows (text line boxes; `data-field="box"` for the element's own box, e.g. cards). Everything is a
  mix of `--bg` toward `--text`, capped at 14% (dark) / 10% (light) so `--text-muted` keeps 4.5:1 — keep the
  caps in `shaders.ts` if retuning. Off without WebGPU, on touch, reduced motion, Save-Data or low-end devices.
- Scroll reveal: add `data-reveal` (optional `style="--reveal-delay: 120"` in ms). Handled by `src/scripts/reveal.ts`.
- Page scripts run under the client router: initialise on `astro:page-load`, clean up on `astro:before-swap`.
- Site-wide details (name, email, links) live in `src/data/site.ts`.
- Projects are a content collection (`src/content/projects/*.md`, schema in `src/content.config.ts`).
  Normal projects render through `src/pages/projects/[id].astro`; `interactive: true` projects have their
  own page file instead (`wingravity.astro`, `procedural-animation.astro`, `this-site.astro` = the colophon).
  `badge` is the pill on the project row ("Playable", "Colophon").
- Project media: optional `cover`, `gallery[]` and `video {webm|mp4, poster}` frontmatter (`image()` fields,
  paths relative to the md file). Files live in `src/assets/projects/<id>/`; videos are resolved by a glob in
  `ProjectLayout.astro`. Nothing renders when the fields are absent. Video autoplays muted only in view and
  never under reduced motion (a Play button appears instead). Rows with a cover get a floating preview on fine
  pointers via `hovercards.ts` (`data-hentry` / `data-htrigger` / `data-hcard`), shared with the CV cards.
- Journal: content collection `src/content/journal/*.md` (`title, date, summary, tags, draft`). Pages
  `/journal`, `/journal/[slug]`, feed at `/rss.xml` (`@astrojs/rss`). Drafts render in dev only
  (`src/data/journal.ts`). Prose `h2`s feed the section index.
- Share images: `src/pages/og/[...slug].png.ts` renders one per page/project/post at build time (satori → sharp,
  fonts read from the fontsource packages' `.woff` files). Pages pass `ogImage="/og/<slug>.png"` to `Base`;
  `public/og.png` is the fallback. JSON-LD goes through `JsonLd.astro` (Person + WebSite on home,
  BreadcrumbList + SoftwareSourceCode on projects, BlogPosting on posts).
- Command palette (`Palette.astro` + `src/scripts/palette.ts`): ⌘K / Ctrl+K, `?` for the shortcut sheet,
  `g` then `h/p/j/a/c` chords. Items are built at build time into an inline JSON tag. Programmatic navigation
  must use `navigate()` from `astro:transitions/client` so the wipe plays. Add new routes to the `labels` map
  in `PageWipe.astro` or the wipe shows the fallback name.
- Lights preference (`src/scripts/lights.ts`): `localStorage['lights']` = auto|dark|light. Applied before paint
  by the inline head script in `Base.astro`, re-applied on `astro:after-swap`, respected by `surface.ts` (a pin
  skips the scroll observer). `.theme-dark` blocks stay dark either way. Footer button + palette actions set it.
- Copy buttons: `<button data-copy="text" hidden>`; `src/scripts/copy.ts` un-hides them when the clipboard
  API exists and announces via `[data-copy-status]`.
- Print: `@media print` in `global.css` strips the chrome; the CV page has its own print layout and a Print
  button. `[data-print-hide]` hides anything else.
- `src/data/site.ts` has `status` (hero + footer line); `src/data/now.ts` feeds the home "Now" block.

## WinGravity
`src/scripts/gravity/engine.ts` is a port of `UpdateEnginePhysics` from
https://github.com/AlbusAlbatron/WinGravity — keep its constants and collision rules matching the C.
`desktop.ts` is the DOM side (pointer drag = window hooks, transforms = SetWindowPos). The only addition is
tilt gravity for phones (`gravity/tilt.ts`): `accel` can point gravity sideways, and the wall/ceiling rules
mirror the floor rule *only* when it does, so with `accel` at zero the C path is unchanged.

## Procedural animation
`src/scripts/snake/engine.ts` ports `procedural_snake.c` (github.com/AlbusAlbatron/procedural_animation):
40 segments, 3% lerp per tick at 600 Hz, radii truncated to integers (the tail collapses to 0 after 13 —
keep that faithful; the page's sliders are the "fix"). `canvas.ts` is the DOM side: fixed-step accumulator,
tokens read via `getComputedStyle` each frame so it follows the surface fade, touch follows only while pressed.

## CV — privacy
- `src/data/cv.ts` is public. Never add phone numbers or referee contact details.
- `public/cv.pdf` must be the redacted web copy. The download button only renders when that file exists.
- Hover cards: set `preview: { image, blurb }` on an entry; images go in `src/assets/cv/`.
