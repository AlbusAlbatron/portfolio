# Alby's portfolio (alby.software)

Graded portfolio for a first-year Immersive Software Engineering student at UL. Astro 7, static output,
TypeScript strict, plain CSS, vanilla TS for interactivity — no React/Tailwind. Deployed to GitHub Pages
via `.github/workflows/deploy.yml` on push to `main`; custom domain in `public/CNAME`.

See AGENTS.md for Astro dev-server commands. Check work with `npx astro check` and `npm run build`.

## Design rules
- Medium interactivity only: View Transitions (`ClientRouter`), scroll reveals, subtle hovers. The WinGravity
  page is the one deliberate showpiece. Everything must respect `prefers-reduced-motion` and work at ~400px.
- Dark warm palette, no bright accent colour. Use the tokens in `src/styles/global.css` (`--bg`, `--text`,
  `--text-muted`, `--line`, …), never new hard-coded colours.
- Fonts: Inter Tight (sans) + JetBrains Mono (labels), self-hosted via @fontsource.
- Copy is in Alby's voice, first person, plain and honest — no inflated claims.

## Conventions
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
