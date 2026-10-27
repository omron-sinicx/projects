import { getCollection, type CollectionEntry } from 'astro:content';
import { CATEGORIES, THEMES, type CategoryId } from './categories';

/**
 * All projects: pinned first (in overrides order), then by acceptance year (newest first),
 * then most recently pushed. Projects without a year follow those with one.
 */
export async function getProjects() {
  return (await getCollection('projects')).sort(
    (a, b) =>
      (a.data.order ?? Infinity) - (b.data.order ?? Infinity) ||
      (b.data.year ?? 0) - (a.data.year ?? 0) ||
      b.data.updatedAt.getTime() - a.data.updatedAt.getTime(),
  );
}

/** Per-area view of the project list: themed projects are represented by their theme card. */
export function areas(projects: CollectionEntry<'projects'>[]) {
  const sections = CATEGORIES.map((category, i) => {
    const areaThemes: string[] = THEMES.filter((t) => t.category === category.id).map((t) => t.id);
    const inArea = projects.filter((p) => p.data.categories.includes(category.id));
    return {
      category,
      no: i + 1,
      count: inArea.length,
      themes: THEMES.filter((t) => t.category === category.id)
        .map((theme) => {
          const members = inArea.filter((p) => p.data.themes.includes(theme.id));
          return {
            theme,
            count: members.length,
            previews: members.flatMap((p) => (p.data.image ? [p.data.image] : [])).slice(0, 4),
          };
        })
        .filter((t) => t.count > 0),
      /** Everything in the area, themed or not (top-page rail and area page). */
      all: inArea,
      /** Only projects outside every theme of this area. */
      projects: inArea.filter((p) => !p.data.themes.some((t) => areaThemes.includes(t))),
    };
  });
  const counts = Object.fromEntries([
    ['all', projects.length],
    ...sections.map((s) => [s.category.id, s.count]),
  ]) as Record<CategoryId | 'all', number>;
  return { sections: sections.filter((s) => s.count > 0), counts };
}
