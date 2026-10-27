# omron-sinicx/projects

Static index of every OMRON SINIC X project page under `https://omron-sinicx.github.io/<repo>/`,
served at `https://omron-sinicx.github.io/projects/`. Astro 7 (`output: 'static'`), Tailwind v4, GitHub Pages.

## Rules

- Never modify or propose modifying other repos' project pages. All behavior lives in this repo.
  Clicking a card opens the page unmodified in a modal `<iframe>` (`ProjectModal.astro` + `transition.ts`).
- The only committed data is `src/data/project-overrides.yaml`. The project list is built at build time by
  `src/loaders/projects.ts`; never commit scraped data, images or caches. Per page, metadata comes from:
  OG tags in the deployed HTML → the shared template's `template.yaml` (branches `project-page`, `gh-pages`,
  default) → for old webpack builds, the template object inlined in `index.bundle.js`. The venue label is
  the template's `conference:`.
- Research areas (`src/lib/categories.ts`) are guessed by venue, then keywords. Fix a wrong
  guess with `categories:` in the overrides file rather than by tuning keywords for one project.
- Themes (`THEMES` in the same file) group projects inside an area: a black tile and a page at
  `/projects/<area>/<theme>/`. A project may belong to several areas and themes (`categories` / `themes`
  are lists); fix membership with `categories:` / `themes:` in the overrides (one id or a list; `[]` = none).
  Since one card can appear in several sections of a page, card view-transition names are per section
  (`c-<area or theme>-<repo>`).
- Card images hot-link the project's own teaser (OG image → template image → `<page>/teaser.png` → the
  first image the page shows, from its HTML or bundle; first that responds); none → the gray X-mark
  placeholder (`XMark.astro`).
- Light only: no dark theme, whatever the OS setting (project pages are white).
- Layout: top-page rails show the theme tiles (two cards wide) plus the 12 newest unthemed projects, then a
  "+N / View all" tile; areas with ≤5 items use a single row. Area pages show all theme tiles on one row,
  then every project in the area (themed or not), newest first.
- Colors / spacing / fonts only via `src/styles/tokens.css` (`@theme` → Tailwind utilities). No raw hex in components.
- Cards use container queries for their internal layout; only the page shell uses viewport breakpoints.
- Zero client JS except `src/scripts/transition.ts` (card → modal), `src/scripts/rail.ts` (rail arrows) and
  `src/scripts/progressive.ts` (reveal long grids in batches of 20 on scroll) and `src/scripts/images.ts`
  (fade teasers in once loaded; frames shimmer until then). Card entrance on scroll is pure CSS
  (scroll-driven `animation-timeline: view()`). Cards must keep working as
  plain links without JS and with Cmd/Ctrl+click; rails scroll and every grid card is in the HTML without JS.
- Pages: `/projects/` (one horizontal rail per area), `/projects/<area>/`, `/projects/<area>/<theme>/`.
  Page-to-page motion is cross-document View Transitions (`@view-transition` in `global.css`); shared
  elements carry `view-transition-name` (`site-header`, `tab-indicator`, `cat-*`, `theme-*`, `c-<section>-*`).
- Sort: pinned, then acceptance year (parsed from the venue, `src/lib/venue.ts`), then last push.
  Venue labels are normalized to "<name> <yyyy>".
- Node is pinned by pixi (`pixi.toml` / `pixi.lock`); run npm/astro only through pixi tasks.
- Before finishing any task, `pixi run verify` (astro check + build) must pass.
- Refreshing the list or fixing a card: follow the `update-projects` skill.

## Development

```
GITHUB_TOKEN=$(gh auth token) pixi run dev   # token optional; raises the API rate limit
pixi run dev --background --host 0.0.0.0     # background, reachable from the LAN
```

In dev the loader caches its result in `node_modules/.cache/research-projects.json` for 1 hour;
`pixi run refresh` drops it. `pixi task list` shows all tasks.
