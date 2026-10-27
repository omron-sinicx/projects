# OMRON SINIC X Research Projects

An index of the OMRON SINIC X project pages under `https://omron-sinicx.github.io/<repo>/`, served at
<https://omron-sinicx.github.io/projects/>.

The list is built automatically from the public `omron-sinicx` repositories that have GitHub Pages
enabled. No page content is stored here; the only hand-edited file is
[`src/data/project-overrides.yaml`](src/data/project-overrides.yaml).

## Run locally

Install [pixi](https://pixi.sh), then:

```sh
pixi run dev     # http://localhost:4321/projects/
pixi run build   # static site in dist/
```

pixi provides Node.js; no other setup is needed. Setting `GITHUB_TOKEN` is optional (it raises the
GitHub API rate limit).

## Adding a project

When a new project page is published, it appears on the next build (every Monday, or run the
*Deploy to GitHub Pages* workflow). To fix how a card looks — title, venue, image, area or theme — edit
`src/data/project-overrides.yaml`; each section there is commented.

## License

Code: [MIT](LICENSE). The SINIC X logo is a trademark of OMRON SINIC X Corporation and is not covered
by the license.
