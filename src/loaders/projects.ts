import type { Loader } from 'astro/loaders';
import * as cheerio from 'cheerio';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { imageSize } from 'image-size';
import { parse as parseYaml } from 'yaml';
import { formatVenue, venueYear } from '../lib/venue';
import { classify, classifyThemes, type CategoryId, type ThemeId } from '../lib/categories';

interface Options {
  org: string;
  /** Restrict to these repos (skips the org listing). */
  only?: string[];
}

interface Repo {
  name: string;
  description: string | null;
  html_url: string;
  pushed_at: string;
  default_branch: string;
  topics?: string[];
  has_pages: boolean;
  archived: boolean;
}

interface Overrides {
  hidden?: string[];
  pinned?: string[];
  titles?: Record<string, string>;
  /** Short name on the card (otherwise the part of the title before ":" or the repo name). */
  names?: Record<string, string>;
  venues?: Record<string, string>;
  /** One area or a list; replaces the guess. */
  categories?: Record<string, CategoryId | CategoryId[]>;
  /** Card image, when the page's own teaser is wrong (e.g. a stale OG image copied from another project). */
  images?: Record<string, string>;
  /** One theme or a list; replaces the guess. `null` or `[]` keeps a project out of every theme. */
  themes?: Record<string, ThemeId | ThemeId[] | null>;
}

/** The shared project-page template (github.com/omron-sinicx/project-page-template) keeps its metadata here. */
interface Template {
  title?: string | null;
  description?: string | null;
  conference?: string | null;
  image?: string | null;
  resources?: { paper?: string | null; code?: string | null } | null;
}

type Project = {
  id: string;
  url: string;
  title: string;
  description?: string;
  image?: string;
  imageWidth?: number;
  imageHeight?: number;
  arxiv?: string;
  code: string;
  updatedAt: string;
  order?: number;
  venue?: string;
  topics: string[];
};

const API = 'https://api.github.com';
const EXCLUDED = new Set(['omron-sinicx.github.io', 'projects', 'research']);
const CONCURRENCY = 8;
const TIMEOUT_MS = 10_000;
const CACHE_FILE = 'node_modules/.cache/research-projects.json';
const CACHE_TTL_MS = 60 * 60 * 1000;
const CACHE_VERSION = 4; // bump when the scraped shape changes
const TEMPLATE_FILE = 'template.yaml';
const TEMPLATE_BRANCHES = ['project-page', 'gh-pages'];
// Placeholder text left over from the template.
const JUNK_DESCRIPTION = /projectpage template/i;
const OVERRIDES_FILE = 'src/data/project-overrides.yaml';

export function projectsLoader({ org, only }: Options): Loader {
  return {
    name: 'projects-loader',
    load: async ({ store, parseData, logger, watcher }) => {
      let projects = import.meta.env.DEV ? await readCache(only) : undefined;
      if (projects) {
        logger.info(`Using cached project list (${CACHE_FILE})`);
      } else {
        const repos = await listRepos(org, only, logger);
        const results = await mapLimit(repos, CONCURRENCY, (repo) => scrape(org, repo, logger));
        projects = results.filter((p): p is Project => p !== undefined);
        if (import.meta.env.DEV) await writeCache(only, projects);
      }

      const fetched = projects;
      // Overrides are applied on top of the fetched list, so editing them in dev only re-runs this part.
      const apply = async () => {
        const overrides = await readOverrides();
        const hidden = new Set(overrides.hidden ?? []);
        const pinned = overrides.pinned ?? [];

        store.clear();
        for (const p of fetched) {
          if (hidden.has(p.id)) continue;
          const pin = pinned.indexOf(p.id);
          const { topics, ...rest } = p;
          const title = overrides.titles?.[p.id] ?? p.title;
          const venue = formatVenue(overrides.venues?.[p.id] ?? p.venue);
          const list = <T>(v: T | T[] | null | undefined): T[] => (v == null ? [] : Array.isArray(v) ? v : [v]);
          let categories = list(overrides.categories?.[p.id]);
          if (categories.length === 0) {
            const guess = classify({ title, description: p.description, venue, topics });
            if (!guess.matched) logger.info(`${p.id}: no category keywords matched; using ${guess.category}`);
            categories = [guess.category];
          }
          const themes =
            overrides.themes && p.id in overrides.themes
              ? list(overrides.themes[p.id])
              : classifyThemes(categories, { title, description: p.description });
          const override = overrides.images?.[p.id];
          const image = override ? { image: override, ...(await measure(override)) } : {};
          const data = await parseData({
            id: p.id,
            data: { ...rest, ...image, title, venue, year: venueYear(venue), shortName: overrides.names?.[p.id], categories, themes, order: pin >= 0 ? pin : undefined },
          });
          store.set({ id: p.id, data });
        }
        logger.info(`Loaded ${store.keys().length} project pages`);
      };

      await apply();

      if (watcher) {
        const file = resolve(OVERRIDES_FILE);
        watcher.add(file);
        watcher.on('change', async (changed) => {
          if (resolve(changed) !== file) return;
          logger.info(`${OVERRIDES_FILE} changed; re-applying overrides`);
          try {
            await apply();
          } catch (err) {
            logger.error(`Could not apply ${OVERRIDES_FILE}: ${(err as Error).message}`);
          }
        });
      }
    },
  };
}

type Logger = Parameters<Loader['load']>[0]['logger'];

function apiHeaders(): HeadersInit {
  const token = process.env.GITHUB_TOKEN;
  return {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function listRepos(org: string, only: string[] | undefined, logger: Logger): Promise<Repo[]> {
  if (!process.env.GITHUB_TOKEN) {
    logger.warn('GITHUB_TOKEN is not set; using the unauthenticated GitHub API (60 req/h).');
  }

  let repos: Repo[] = [];
  if (only) {
    for (const name of only) {
      const res = await fetch(`${API}/repos/${org}/${name}`, { headers: apiHeaders() });
      if (res.ok) repos.push((await res.json()) as Repo);
      else logger.warn(`GitHub API ${res.status} for ${org}/${name}; skipping`);
    }
  } else {
    for (let page = 1; ; page++) {
      const res = await fetch(`${API}/orgs/${org}/repos?per_page=100&type=public&page=${page}`, {
        headers: apiHeaders(),
      });
      if (!res.ok) {
        logger.warn(`GitHub API ${res.status} while listing ${org} repos (page ${page}); stopping`);
        break;
      }
      const batch = (await res.json()) as Repo[];
      repos = repos.concat(batch);
      if (batch.length < 100) break;
    }
  }
  return repos.filter((r) => r.has_pages && !r.archived && !EXCLUDED.has(r.name));
}

async function scrape(org: string, repo: Repo, logger: Logger): Promise<Project | undefined> {
  const url = `https://${org}.github.io/${repo.name}/`;
  let html: string;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (res.status !== 200) {
      logger.warn(`${url} returned ${res.status}; skipping`);
      return undefined;
    }
    html = await res.text();
  } catch (err) {
    logger.warn(`${url} failed (${(err as Error).message}); skipping`);
    return undefined;
  }

  const $ = cheerio.load(html);
  // Same-origin script bundles, fetched at most once and only if something needs them.
  let bundles: Promise<string[]> | undefined;
  const getBundles = () => (bundles ??= fetchBundles($, url));
  const tpl = (await fetchTemplate(org, repo)) ?? templateFromBundles(await getBundles());
  const meta = (sel: string) => $(sel).attr('content')?.trim() || undefined;
  const abs = (href: string | undefined) => {
    if (!href) return undefined;
    try {
      return new URL(href, url).href;
    } catch {
      return undefined;
    }
  };

  const text = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined);
  const paper = text(tpl?.resources?.paper);
  // OG tags reflect what is deployed; template.yaml on a source branch can be stale or copied from
  // another project, so it only fills gaps (and supplies the venue, which has no OG equivalent).
  const description = [
    meta('meta[property="og:description"]'),
    meta('meta[name="description"]'),
    text(tpl?.description),
    text(repo.description),
  ].find((d) => d && !JUNK_DESCRIPTION.test(d));

  return {
    id: repo.name,
    url,
    title:
      meta('meta[property="og:title"]') ??
      text(tpl?.title) ??
      ($('title').first().text().trim() || repo.name),
    description,
    ...(await reachableImage(
      async function* () {
        yield abs(meta('meta[property="og:image"]'));
        yield abs(text(tpl?.image));
        // The template's convention, for pages whose OG tags were never filled in.
        yield abs('teaser.png');
        // No teaser at all: the first image the page shows.
        yield* pageImages($, await getBundles(), url);
      },
      repo.name,
      logger,
    )),
    arxiv: paper?.includes('arxiv.org/abs') ? abs(paper) : abs($('a[href*="arxiv.org/abs"]').first().attr('href')),
    code: repo.html_url,
    updatedAt: repo.pushed_at,
    venue: text(tpl?.conference),
    topics: repo.topics ?? [],
  };
}

const MAX_IMAGE_PROBES = 16;
// Site chrome, not project content.
const NOT_CONTENT_IMAGE = /(logo|sinic|favicon|icon|avatar|badge|sprite)/i;
const IMAGE_PATH = /["'`(]((?:\.{0,2}\/)?[\w\-./%@]+\.(?:png|jpe?g|gif|webp))["'`)]/gi;

/**
 * First candidate that actually serves an image, probing lazily in order. Pages copied from the
 * template can still point at placeholders like `${your-repository-name}/teaser.png`.
 */
async function reachableImage(candidates: () => AsyncIterable<string | undefined>, name: string, logger: Logger) {
  const seen = new Set<string>();
  for await (const url of candidates()) {
    if (!url || seen.has(url)) continue;
    seen.add(url);
    if (seen.size > MAX_IMAGE_PROBES) break;
    try {
      const res = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(TIMEOUT_MS) });
      if (res.ok && res.headers.get('content-type')?.startsWith('image/')) return { image: url, ...(await measure(url)) };
    } catch {
      // try the next candidate
    }
  }
  logger.warn(`${name}: no reachable image (tried ${seen.size}); using the placeholder`);
  return {};
}

/** Intrinsic size, so the card can tell a 2:1 teaser from a tall figure. Missing on failure. */
async function measure(url: string): Promise<{ imageWidth?: number; imageHeight?: number }> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!res.ok) return {};
    const { width, height } = imageSize(new Uint8Array(await res.arrayBuffer()));
    return { imageWidth: width, imageHeight: height };
  } catch {
    return {};
  }
}

/** Images in page order: `<img>` in the HTML, then image paths referenced by the page's bundles. */
function* pageImages($: cheerio.CheerioAPI, bundles: string[], pageUrl: string): Generator<string> {
  const resolve = (src: string) => {
    try {
      const u = new URL(src, pageUrl);
      return u.origin === new URL(pageUrl).origin ? u.href : undefined;
    } catch {
      return undefined;
    }
  };
  const ok = (src: string | undefined): src is string => !!src && !NOT_CONTENT_IMAGE.test(src);
  for (const el of $('img[src]').toArray()) {
    const src = $(el).attr('src');
    if (ok(src)) {
      const u = resolve(src);
      if (u) yield u;
    }
  }
  for (const js of bundles) {
    for (const [, path] of js.matchAll(IMAGE_PATH)) {
      if (!ok(path)) continue;
      // Bundles may hold the source path (./src/images/x.png) or a root path (/assets/x.png) while the
      // file is deployed under the page as assets/x.png; try those spellings too.
      for (const src of [path, path.replace(/^\/+/, ''), `assets/${path.split('/').pop()}`]) {
        const u = resolve(src);
        if (u) yield u;
      }
    }
  }
}

async function fetchBundles($: cheerio.CheerioAPI, pageUrl: string): Promise<string[]> {
  const scripts = $('script[src]')
    .map((_, el) => $(el).attr('src'))
    .get()
    .map((src) => new URL(src, pageUrl))
    .filter((u) => u.origin === new URL(pageUrl).origin)
    .slice(0, 3);
  const texts = await Promise.all(
    scripts.map(async (src) => {
      try {
        const res = await fetch(src, { signal: AbortSignal.timeout(TIMEOUT_MS) });
        return res.ok ? await res.text() : '';
      } catch {
        return '';
      }
    }),
  );
  return texts.filter(Boolean);
}

/**
 * Older builds of the template (webpack, react-helmet) ship no template.yaml and no OG tags in the HTML;
 * the same metadata is inlined in the bundle as `{organization:"…",title:"…",conference:"…",…}`.
 */
function templateFromBundles(bundles: string[]): Template | undefined {
  for (const js of bundles) {
    const start = js.indexOf('organization:"');
    if (start < 0) continue;
    const obj = js.slice(start, start + 20_000);
    const field = (key: string) => {
      const m = obj.match(new RegExp(`[{,]${key}:"((?:[^"\\\\]|\\\\.)*)"`));
      if (!m) return undefined;
      try {
        return JSON.parse(`"${m[1]}"`) as string;
      } catch {
        return m[1];
      }
    };
    return {
      title: field('title'),
      conference: field('conference'),
      description: field('description'),
      image: field('image'),
      resources: { paper: field('paper') },
    };
  }
  return undefined;
}

/** template.yaml from the page's source branch, if the repo uses the shared template. */
async function fetchTemplate(org: string, repo: Repo): Promise<Template | undefined> {
  const branches = [...new Set([...TEMPLATE_BRANCHES, repo.default_branch])];
  for (const branch of branches) {
    try {
      const res = await fetch(`https://raw.githubusercontent.com/${org}/${repo.name}/${branch}/${TEMPLATE_FILE}`, {
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!res.ok) continue;
      const parsed = parseYaml(await res.text());
      if (parsed && typeof parsed === 'object') return parsed as Template;
    } catch {
      // Unparseable or unreachable: fall through to the next branch / OG tags.
    }
  }
  return undefined;
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

async function readOverrides(): Promise<Overrides> {
  return (parseYaml(await readFile(OVERRIDES_FILE, 'utf8')) as Overrides | null) ?? {};
}

async function readCache(only: string[] | undefined): Promise<Project[] | undefined> {
  try {
    const raw = JSON.parse(await readFile(CACHE_FILE, 'utf8'));
    if (raw.version !== CACHE_VERSION || Date.now() - raw.savedAt > CACHE_TTL_MS) return undefined;
    if (JSON.stringify(raw.only ?? null) !== JSON.stringify(only ?? null)) return undefined;
    return raw.projects as Project[];
  } catch {
    return undefined;
  }
}

async function writeCache(only: string[] | undefined, projects: Project[]) {
  await mkdir(dirname(CACHE_FILE), { recursive: true });
  await writeFile(CACHE_FILE, JSON.stringify({ version: CACHE_VERSION, savedAt: Date.now(), only: only ?? null, projects }));
}
