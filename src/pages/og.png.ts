// Open Graph image (1200×630), rendered at build time with satori + resvg: the SINIC X wordmark and
// "Projects" on black, nothing else. Nothing is committed; the PNG only exists in dist/.

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Resvg } from '@resvg/resvg-js';
import type { APIRoute } from 'astro';
import satori from 'satori';

const W = 1200;
const H = 630;
// Colors match src/styles/tokens.css (satori cannot read CSS variables).
const BLACK = '#000000';
const WHITE = '#ffffff';

// Paths from the project root: this module runs from a bundled copy, so import.meta.url is not src/pages.
const file = (path: string) => readFile(resolve(path));

export const GET: APIRoute = async () => {
  // The official vector wordmark (816×133), recolored white. A PNG would show its own slightly different
  // black as a box around the logo.
  const svg = (await file('src/assets/sinicx-logo.svg')).toString().replace('fill:#000000', `fill:${WHITE}`);
  const logo = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;

  const tree = {
    type: 'div',
    props: {
      style: {
        width: W,
        height: H,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 44,
        background: BLACK,
        color: WHITE,
      },
      children: [
        { type: 'img', props: { src: logo, width: 560, height: 92 } },
        {
          type: 'div',
          props: {
            style: { fontFamily: 'Krona One', fontSize: 44, letterSpacing: 10, paddingLeft: 10 },
            children: 'PROJECTS',
          },
        },
      ],
    },
  };

  const out = await satori(tree as Parameters<typeof satori>[0], {
    width: W,
    height: H,
    fonts: [
      { name: 'Krona One', data: await file('node_modules/@fontsource/krona-one/files/krona-one-latin-400-normal.woff'), weight: 400 },
    ],
  });
  const png = new Resvg(out, { fitTo: { mode: 'width', value: W } }).render().asPng();
  return new Response(new Uint8Array(png), { headers: { 'Content-Type': 'image/png' } });
};
