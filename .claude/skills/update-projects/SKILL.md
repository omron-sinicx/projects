---
name: update-projects
description: Refresh the project index or fix how a project appears on it. Use when the user says a new omron-sinicx project page was published ("project page が増えた", "新しいページを追加"), asks to rebuild/redeploy, or wants a card's title, venue, image, area or theme changed ("〜は Planning に入れて", "会議名が違う", "画像がおかしい", "このページは出さないで").
---

# update-projects

The project list is **not stored in this repo**. `src/loaders/projects.ts` rebuilds it on every build from
the GitHub API (public `omron-sinicx` repos with Pages enabled) plus each page's OG tags / `template.yaml`.
The only hand-edited data is `src/data/project-overrides.yaml`. Never edit the project pages themselves.

## Which request → what to do

| Request | Action |
| --- | --- |
| A new project page was published; show it | Nothing to edit. Rebuild: production picks it up on the weekly CI run, or now with `gh workflow run deploy.yaml -R omron-sinicx/projects`. Locally: `pixi run refresh`, then `pixi run dev` (or `build`). |
| Check that the new page looks right | `pixi run refresh && GITHUB_TOKEN=$(gh auth token) pixi run build`, read the loader log (see below), then open `/projects/` in `pixi run dev`. |
| Hide a repo whose Pages site is not a project page | Add the repo name to `hidden:`. |
| Show a project first | Add it to `pinned:` (in display order). |
| Wrong / missing title | `titles: { <repo>: "Title" }` |
| Wrong / missing venue label | `venues: { <repo>: "CoRL 2026" }` (normalized to `<name> <yyyy>`; the year also drives sort order). Projects with no venue get a gray "Preprint" label automatically; only set a venue once it is accepted. |
| Wrong card image (stale OG image, logo, …) | `images: { <repo>: https://omron-sinicx.github.io/<repo>/… }`; use an image the page actually shows, check it returns 200. |
| Wrong area (Physical AI / AI for Science / HCI) | `categories: { <repo>: pai }` or a list `[pai, sci]`. Ids: `pai`, `sci`, `hci`. |
| Wrong theme (Hardware, Soft Robotics, …) | `themes: { <repo>: planning }`, a list `[hardware, soft-robotics]`, or `[]` for none. Ids are in `THEMES`, `src/lib/categories.ts`. |
| New theme | Add it to `THEMES` and `THEME_KEYWORDS` in `src/lib/categories.ts` (id, area, name, one-sentence description); its page `/projects/<area>/<theme>/` is generated. |

Overrides replace the automatic guess for that repo; keep a short `# why` comment on each line.

## Reading the loader log

`pixi run build` prints, per repo:

- `Loaded N project pages`: N should grow by one for a new page.
- `<url> returned 404; skipping`: the Pages site is down or unpublished. Nothing to fix here.
- `<repo>: no reachable image …; using the placeholder`: the card shows the gray X; set `images:` if the page has a figure.
- `<repo>: no category keywords matched; using pai`: the area is a fallback guess; confirm with the user and set `categories:`.

To see where a new repo landed, grep the build output, e.g.
`grep -o 'data-id="[^"]*"' dist/physical-ai/planning/index.html`.

## Finish

1. `pixi run verify` (astro check + build) must pass.
2. Report what was added or changed and any log warnings that still need a decision.
3. Commit only `src/data/project-overrides.yaml` (or `categories.ts` for a new theme); never commit `dist/` or caches.
