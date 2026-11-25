# Alby's portfolio (alby.software)

Professional portfolio for a first-year Immersive Software Engineering student at UL, aimed at both
recruiters/business readers and engineers. Astro 7, static output, TypeScript strict, plain CSS, small vanilla TS
scripts in `src/scripts/` for the interactions below. Deployed to GitHub Pages via `.github/workflows/deploy.yml` on push to
`main`; custom domain in `public/CNAME`.

See AGENTS.md for Astro dev-server commands. Check work with `npx astro check` and `npm run build`.

## Principles
- A boutique portfolio built from techniques curated on hoverstat.es. Small, precise chrome; one large voice per
  page; soft raised tiles (`.tile`) for drawings and images; very few rules.
- No window / desktop / Windows-OS motif any more (Alby asked for it gone: he doesn't build Windows programs now).
  WinGravity and Attention Service stay as past projects, but don't describe him as a Windows developer.
  Intro focus: "I mostly work in Java, Python and C."
- Signature pieces, and where they came from:
  - Work section (`Work.astro` + `scripts/work.ts`): Grid of cards or List, morphing with a view transition
    (tiger.exposed). Cards tilt toward the pointer and catch a light sheen; list rows ripple letter by letter and a
    small preview tile follows the pointer (erinfeeproductions). Choice stored in `localStorage['work-view']`.
  - Header strip with role, coordinates and a live Limerick clock; "Updated" build date in the footer (lafour).
  - Nav letters squeeze/stretch with scroll velocity via Archivo's `wdth` axis (muda.co), in `scripts/chrome.ts`.
  - Intro statements type themselves out (`Typed.astro`, CSS only) (typohypergraphicobject). No italics.
  - Dust (realistic, seamless disintegration): hovering a `[data-dust]` element makes its letters crumble into fine
    dust. **The real text is never hidden or replaced**: a "cover" canvas paints the background colour (first opaque
    ancestor background) over the text pixel by pixel as it erodes, so the start and end are pixel-identical to the
    page (an earlier canvas-copy approach made text look slightly smaller/shifted because canvas can't match the
    browser's text rendering). The text is drawn to an offscreen canvas only as an ink map (per character at its DOM
    position via Range rects, honouring `text-transform`). Cover pixels = ink plus a ~1 CSS px ring, each with its
    own release time (outline first via a BFS distance field on a coarse cell grid, bilinearly interpolated, plus a
    pre-baked periodic noise tile and per-pixel scatter; negative times are scattered, never lumped at 0). Pixels are
    bucketed by time and painted as 1x1 device-pixel squares on a GPU-backed canvas, only the ones due each frame.
    Grains (≤ `GRAIN_BUDGET`, mostly 0.5–2px squares, bigger flakes round, five tones, a few twinkling) are born at
    vanishing ink pixels and ride a slow curl-noise air current; no gravity. Leaving uncovers pixels in reverse while
    grains fly home. (A faster variant, coarser scheduling for big text plus a faded reassembly, was tried and
    reverted by Alby: it looked much worse.) Setup is async, time-sliced (`SLICE_MS`, ink read in strips) and cancellable. One fixed
    viewport canvas, shown only while animating, sits under the grain overlay. `[data-dust]` elements must not move
    or reflow on hover (the list-row letter ripple was removed for this). Used on nav, header name, page titles
    (`.dust-title`), project titles, Overview/footer links and the footer name; never body copy. Alby rejected SVG
    "fuzz/ink", square particles, soft blobs, fast specks, square-cell erasing and any visible hand-over.
  - Cross-document view transitions: the old page steps back, the new one rises (age-hh). In-page swaps add
    `html.vt-swap` for a plain fade.
  - Multi-column "Overview" on home (tiger.exposed / simondenny); spec strips and reading time on project pages
    (elisabreyerarchive); gallery images click from column to full width (schemamagazine); images "develop"
    through a hue shift (`.develop`).
  - `Specimen.astro` draws each project from its real numbers (WinGravity constants, the hosts block, the snake
    radii) until screenshots exist. Keep them truthful to the C sources.
- Don't add more: no WebGL, 3D, fluid sims, custom cursors or smooth-scroll libraries (Alby rejected the original
  effects-heavy site). Every motion respects `prefers-reduced-motion`; everything works at ~400px and without JS.
- Brutalist offsets (desktop >= 64rem only, everything aligns below): utilities `.indent-1/2/4/6`, `.outdent`
  (hangs into the page margin), `.drop-1/2`, `.lift-1` in `global.css`, plus per-component staggers (home notes and
  Overview columns, Work cards, CV rows alternate, footer name runs off the right edge). Keep offsets different
  from each other and check nothing overflows at 400px.
- Grouping under offsets: section headings are slim charcoal bars (`.band`, `--band` #34342f, Tanker title + mono
  count, off-white text) spanning their whole section (Alby found solid black too loud); the brutalist offset lives *inside* the bar via inline `--indent` (percent,
  desktop only). Smaller groups that are offset or staggered get a thin black label strip (`.band--mini`): home
  "At a glance" notes and each Overview column, project "Details" and "On this page", About "Quick facts". CV
  sheet headers are bands. Bars print as ink text over a rule. `.bar` is only the small breadcrumb row.
- Avoid looking like bureau.cool (grey, pill buttons, stacked serif + mono caps headings) or a generic template.
- Copy is in Alby's voice, first person, plain and natural. No taglines, jokes or inflated claims.

## Type and styles
- Black and grey only: no accent colour (Alby asked for the orange to go). Brand mark, caret and favicon are ink.
- A deliberate brutalist mix. Free stand-ins for fonts from mockplus.com/blog/post/brutalist-fonts that couldn't be
  downloaded (Behance/Gumroad need a login): Instrument Serif ~ BBKV Wildfire, Big Shoulders Display ~ Morganite,
  Anton ~ Deliware, Tanker ~ Lewatur.
  - Instrument Serif (`--title`): `.title`, page and project titles, capitals, very large.
  - Big Shoulders Display variable (`--condensed`): `.display`, project card/list titles, black capitals.
  - Anton (`--heavy`): the footer name (`FitText`).
  - Tanker (`--brut`): section headings (first span of `.bar__label`). Fontshare licence allows self-hosting but
    not redistribution via a public repo, so `scripts/fetch-fonts.mjs` downloads it into `public/fonts/`
    (git-ignored) on `predev`/`prebuild`; if offline the stack falls back to Anton.
  - Newsreader variable (`opsz.css`, `--serif`): `.statement` and `.lede`, a sturdy newspaper serif (Alby found
    Bodoni Moda hard to read).
  - Archivo variable (`wdth.css`, `--sans`): body text and the stretchy nav.
  - IBM Plex Mono 500 (`--mono`): `.label` / `.bar__label` / `.spec dt` (uppercase, tracked), data and code.
  - Small numbers (indexes, counts, the clock): `.num` = IBM Plex Mono with tabular figures (Alby disliked the
    pixel font that was here).
  - Google fonts come from @fontsource packages (npm, not committed). `@fontsource-variable/*` imports omit `.css`
    when the package's exports add it (Big Shoulders is `@import`ed at the top of `global.css` from its package root: TypeScript rejects its extension-less path).
- `src/styles/global.css` tokens: `--bg`, `--surface`, `--ink`, `--muted`, `--hair`, the font tokens above,
  `--pad`, `--gap`, `--section`, `--chrome`. Classes: `.statement`, `.title`, `.display`, `.lede`, `.label`, `.mono`,
  `.num`, `.small`, `.muted`, `.bar` (breadcrumbs), `.band` / `.band__label` / `.band--mini`, `.spec`, `.tile` / `.tile__sheen`, `.link`, `.toggle`, `.prose`, `.develop`,
  offset utilities.
- Code blocks are dark (`github-dark`, `#0e0e0e`).
- Grain: a static `body::after` noise layer (SVG feTurbulence data URI, ~4.5% opacity) over everything, barely
  visible by design. No animation, no blend mode; hidden in print.

## Structure
- Pages: `/` (typed statement, notes, Work, Overview), `/projects`, `/projects/[id]` (spec strip + diagram/cover
  tile, sticky contents list that tracks the section, write-up, gallery, next project), `/about`, `/cv`, `404`.
- `Base.astro`: sticky chrome strip and footer with `FitText` (one line sized to the container
  width by `scripts/chrome.ts`). Components: `Nav`, `Work`, `Typed`, `FitText` (`dust` prop), `Specimen`.
- Plain multi-page site, no client router: scripts run once per page load. Scripts end with `export {};`.
- Site-wide details (name, role, status, location, email, links) live in `src/data/site.ts`.
- Projects are a content collection (`src/content/projects/*.md`, schema in `src/content.config.ts`), ordered
  by `order`; `kind` is the short type line. Optional `cover` replaces the diagram on the project page;
  `gallery[]` renders under the write-up. Images live in `src/assets/projects/<id>/`, paths relative to the md.
- About photo: drop an image into `src/assets/about/` and it appears above the quick facts.
- `compressHTML` is off: it strips the space between a line-wrapped word and a following inline tag. Markup
  where whitespace would show (`Typed`'s letter spans) is kept on one line.
- `public/og.png` and `public/apple-touch-icon.png` are static and still use an older look; regenerate them.

## Journal (CareersLab portfolio)
- Follows the CareersLab professional portfolio structure (Week 1 slides pp. 18–23): 7 sections defined in
  `src/data/journal.ts` (number, slug, title, first-person purpose, reflection prompts). Section 1 "About me" is the
  homepage (`href: '/'`); sections 2–7 get `/journal/<slug>` pages (`src/pages/journal/[section].astro`), indexed at
  `/journal`. Nav: Work · About · Journal · CV; also linked from the home Overview.
- Entries: `src/content/journal/*.md` (schema in `content.config.ts`): `title`, `section` (slug), optional
  `date` + `week` (dated entries are grouped under a charcoal week band; undated ones, e.g. the profile, come first),
  `speaker`, `summary` (quote it if it contains a colon), `order`, `media[]`.
- Images: each `media` item renders the photo when `src` is set (files in `src/assets/journal/`, path relative to the
  md), otherwise a visible hatched "Image to come" placeholder with the caption (`JournalMedia.astro`). To add a
  photo, put the file in `src/assets/journal/` and add `src: ../../assets/journal/<file>` (+ `alt`) to the item.
  Video slots: `type: video` shows a 16:9 "Video to come" placeholder; to add the clip, drop the mp4/webm in
  `public/journal/` and set `video: /journal/<file>` (+ optional `poster:` image in `src/assets/journal/`). Videos
  play with controls, muted, never autoplay. (The FPV entry in Beyond the Classroom has a pending crash-footage slot.)
- Copy: Alby's notes rewritten in his voice; facts only from his notes or `cv.ts`. Agreed names: Week 2 residency
  panel = Yasmin and Mark; "Ciarán"; ISE's business development lead unnamed; the startup with classmate Fionn is
  mentioned only in general terms. Values examples in `values.md` were drafted from the CV for him to check.

## CV — layout
- `src/pages/cv.astro`: each section is one "sheet" (`.bar` heading with Tanker title + pixel number, a hairline,
  then rows) and the whole sheet is offset as a unit on desktop via `--shift` (% of page width), so the brutalist
  stagger stays but each section reads as one block. Every row in every sheet uses the same grid
  (`.line`: 10rem meta column for dates/labels + main column). A numbered contents strip sits under the header.
- Sections: Profile, Education, Work experience (jobs + school work placements), Skills, Awards, Activities,
  Interests, References. Data in `src/data/cv.ts` (`awards`, `activities`, `placements` are separate lists).

## CV — privacy
- `src/data/cv.ts` is public. Never add phone numbers or referee contact details.
- `public/cv.pdf` must be the redacted web copy. The download button only renders when that file exists.
- The CV page has print styles; `[data-print-hide]` hides anything else when printing.
