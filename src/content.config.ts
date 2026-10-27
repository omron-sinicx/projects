import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { projectsLoader } from './loaders/projects';
import { CATEGORY_IDS, THEME_IDS } from './lib/categories';

const projects = defineCollection({
  loader: projectsLoader({ org: 'omron-sinicx' }),
  schema: z.object({
    url: z.url(),
    title: z.string(),
    /** Card label; see `names:` in the overrides. */
    shortName: z.string().optional(),
    description: z.string().optional(),
    image: z.url().optional(),
    imageWidth: z.number().optional(),
    imageHeight: z.number().optional(),
    arxiv: z.url().optional(),
    code: z.url(),
    updatedAt: z.coerce.date(),
    order: z.number().optional(),
    venue: z.string().optional(),
    /** Acceptance year, parsed from `venue`. */
    year: z.number().optional(),
    /** A project may belong to several areas and themes. */
    categories: z.array(z.enum(CATEGORY_IDS)).min(1),
    themes: z.array(z.enum(THEME_IDS)),
  }),
});

export const collections = { projects };
