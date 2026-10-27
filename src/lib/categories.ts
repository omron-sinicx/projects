// Research areas, in display order.
// Projects are sorted into one automatically by keyword score (see `classify`);
// `categories:` in src/data/project-overrides.yaml wins over the guess.

export const CATEGORIES = [
  // `name` is the short label (tabs, breadcrumbs); `title` is the section heading.
  { id: 'pai', slug: 'physical-ai', name: 'Physical AI', title: 'Physical AI' },
  { id: 'sci', slug: 'ai-for-science', name: 'AI for Science', title: 'AI for Science' },
  { id: 'hci', slug: 'hci', name: 'HCI', title: 'Human-Computer Interaction' },
] as const;

export type Category = (typeof CATEGORIES)[number];
export type Theme = (typeof THEMES)[number];

export const categoryHref = (c: Category) => `${import.meta.env.BASE_URL}${c.slug}/`;
export const themeHref = (t: Theme) =>
  `${categoryHref(CATEGORIES.find((c) => c.id === t.category)!)}${t.id}/`;

export type CategoryId = (typeof CATEGORIES)[number]['id'];
export const CATEGORY_IDS = CATEGORIES.map((c) => c.id) as [CategoryId, ...CategoryId[]];
/** Themes group projects inside an area; they appear as black cards and get their own page. */
export const THEMES = [
  {
    id: 'hardware',
    category: 'pai',
    name: 'Hardware',
    description:
      'Hands, wrists, actuators and arms designed in-house — mechanisms that make contact-rich manipulation safe, compliant and cheap to build.',
  },
  {
    id: 'foundation-models',
    category: 'pai',
    name: 'Foundation Models',
    description:
      'Vision-language(-action) models and LLMs that plan, act, and explain failures — and how to adapt or compress them for robots and agents.',
  },
  {
    id: 'soft-robotics',
    category: 'pai',
    name: 'Soft Robotics',
    description:
      'Soft wrists, compliant control and variable stiffness — letting robots touch, fit and insert safely by giving way instead of fighting contact.',
  },
  {
    id: 'planning',
    category: 'pai',
    name: 'Planning',
    description:
      'Path planning and navigation for single robots and fleets — learned search, multi-agent pathfinding, replanning, and risk-aware routes on rough terrain.',
  },
] as const;

export type ThemeId = (typeof THEMES)[number]['id'];
export const THEME_IDS = THEMES.map((t) => t.id) as [ThemeId, ...ThemeId[]];

/** Where a project goes when nothing matches. */
export const DEFAULT_CATEGORY: CategoryId = 'pai';

// Venue patterns allow a trailing year without a space ("CHI2024").
const RULES: Record<CategoryId, { venues: RegExp; keywords: RegExp }> = {
  pai: {
    venues: /\b(ICRA|IROS|CoRL|RA-?L|RSS|Humanoids|ICORR|SII|T-?RO|IEEE\/SICE|AAMAS)(?![a-z])/i,
    keywords:
      /\b(robot\w*|manipulat\w*|grasp\w*|gripper|hand|wrist|arm|insertion|navigation|path[- ]planning|motion planning|multi-agent|swarm|actuator|tactile|haptic|teleoperation|prosthetic|rover|locomotion|compliance|compliant|VLA|policy|policies|reinforcement learning|sim-to-real|embodied)\b/gi,
  },
  sci: {
    venues: /\b(Communications Materials|Digital Discovery|npj)(?![a-z])/i,
    keywords:
      /\b(crystal\w*|materials?|molecul\w*|chemi\w*|atom\w*|interatomic|symbolic regression|scientific discovery|physics|protein|periodic structure)\b/gi,
  },
  hci: {
    venues: /\b(CHI|UIST|CSCW|IUI|DIS|TEI|VRST|IEEE VR)(?![a-z])/i,
    keywords:
      /\b(user|users|interactive|interaction|interface|video conferencing|participation|visuali[sz]ation|preference|human-computer|co-?design|design optimization)\b/gi,
  },
};

export interface ClassifyInput {
  title: string;
  description?: string;
  venue?: string;
  topics?: string[];
}

/**
 * A venue that belongs to one area decides it (a swarm robot at CHI is HCI work).
 * Otherwise keyword score: title hit 2, description/topic hit 1.
 */
export function classify({ title, description, venue, topics = [] }: ClassifyInput): {
  category: CategoryId;
  matched: boolean;
} {
  const byVenue = venue && CATEGORIES.find(({ id }) => RULES[id].venues.test(venue));
  if (byVenue) return { category: byVenue.id, matched: true };

  const count = (re: RegExp, text: string) => text.match(re)?.length ?? 0;
  let best: CategoryId = DEFAULT_CATEGORY;
  let bestScore = 0;
  for (const { id } of CATEGORIES) {
    const { keywords } = RULES[id];
    const score =
      2 * count(keywords, title) +
      count(keywords, description ?? '') +
      count(keywords, topics.join(' ').replaceAll('-', ' '));
    if (score > bestScore) {
      best = id;
      bestScore = score;
    }
  }
  return { category: best, matched: bestScore > 0 };
}

const THEME_KEYWORDS: Record<ThemeId, RegExp> = {
  hardware:
    /\b(hand|flexible wrist|gripper|end-effector|actuator\w*|mechanism|linkage|transmission|shaft|stiffness|elasticity|worm gear|cable-driven|serpentine|prosthetic|servomotors?|table-top|robotic arm)\b/gi,
  'soft-robotics':
    /\b(soft|softness|compliance|compliant|flexible wrist|stiffness|elasticity|elastic)\b/gi,
  planning:
    /\b(path[- ]planning|motion planning|planner|pathfinding|path finding|navigation|roadmaps?|replan\w*|rovers?|A\*|MAPP|multi-agent path\w*)/gi,
  'foundation-models':
    /\b(VLMs?|VLAs?|vision-language\w*|language models?|LLMs?|foundation models?|RAG|agentic|language-action|language-guided)\b/gi,
};

// Hardware means the device is the contribution, not a learning method that runs on one.
const METHOD_TITLE = /\b(learning|policy|policies|reinforcement|estimation|retrieval)\b/i;

/**
 * Every theme of the project's areas that its title (×2) and description mention clearly enough.
 * A project can sit in several themes (a soft wrist is both Hardware and Soft Robotics).
 */
export function classifyThemes(categories: CategoryId[], { title, description }: ClassifyInput): ThemeId[] {
  const count = (re: RegExp, text: string) => text.match(re)?.length ?? 0;
  return THEMES.filter((theme) => {
    if (!categories.includes(theme.category)) return false;
    if (theme.id === 'hardware' && METHOD_TITLE.test(title)) return false;
    const re = THEME_KEYWORDS[theme.id];
    // A single passing mention in the description is not enough.
    return 2 * count(re, title) + count(re, description ?? '') > 1;
  }).map((t) => t.id);
}
