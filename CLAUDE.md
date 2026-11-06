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
  own `background: var(--bg)`. Code blocks use the raw `--dark-*` values.
- Big headings: `<SplitText text="…" by="word|char" />` (staggered rise), optionally `data-parallax="0.12"`.
- Cursor states: `data-cursor="view"` or `"drag"` on an element; links/buttons get the hover ring automatically.
- Liquid ripple: `data-liquid` on large display text only (SplitText adds it). `src/scripts/liquid.ts` moves one
  shared WebGL2 canvas into the hovered element and hands back to the DOM text once the ripples settle. Never on
  links or body copy.
- 3D tilt: `data-tilt="5"` (max degrees) plus optional `data-glare`; glare targets must be positioned. Tilt
  uses the CSS `rotate` property, so anything that is also moved must use `translate`, not `transform`
  (WinGravity windows, CV hover cards).
- Magnetic pull applies automatically to `.button`, nav links and WinGravity taskbar buttons.
- Home 3D scene: `src/scripts/hero3d.ts`, dynamically imported by `index.astro` after the wipe settles; renders
  only while visible, ~30fps when idle. Keep three.js out of every other page.
- `<html>` attributes are replaced on every navigation, so anything that adds classes to it (Lenis,
  `has-cursor`, `js`) re-adds them on `astro:after-swap`.
- `compressHTML` is off: it strips the space between a line-wrapped word and a following inline tag. The flip
  side: markup where whitespace would show as gaps (e.g. `SplitText`'s inline-block spans) must be on one line.
- `transition:persist` must go on an element inside a component (see `Cursor.astro`, `PageWipe.astro`); on a
  `<Component />` tag it is silently ignored and the element is replaced on every navigation.
- Avoid `mix-blend-mode`/`backdrop-filter` on full-screen fixed layers — they made scrolling and the cursor janky.
- Scroll reveal: add `data-reveal` (optional `style="--reveal-delay: 120"` in ms). Handled by `src/scripts/reveal.ts`.
- Page scripts run under the client router: initialise on `astro:page-load`, clean up on `astro:before-swap`.
- Site-wide details (name, email, links) live in `src/data/site.ts`.
- Projects are a content collection (`src/content/projects/*.md`, schema in `src/content.config.ts`).
  Normal projects render through `src/pages/projects/[id].astro`; `interactive: true` projects have their
  own page file instead (e.g. `src/pages/projects/wingravity.astro`).
- No journal/blog in the nav yet. When added, make it another content collection.

## WinGravity
`src/scripts/gravity/engine.ts` is a port of `UpdateEnginePhysics` from
https://github.com/AlbusAlbatron/WinGravity — keep its constants and collision rules matching the C.
`desktop.ts` is the DOM side (pointer drag = window hooks, transforms = SetWindowPos).

## CV — privacy
- `src/data/cv.ts` is public. Never add phone numbers or referee contact details.
- `public/cv.pdf` must be the redacted web copy. The download button only renders when that file exists.
- Hover cards: set `preview: { image, blurb }` on an entry; images go in `src/assets/cv/`.
