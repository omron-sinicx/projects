// Fade card teasers in once loaded (see ProjectCard.astro). An image that fails still gets marked,
// so the frame stops shimmering and shows its white background.

const mark = (img: HTMLImageElement) => img.classList.add('is-loaded');

for (const img of document.querySelectorAll<HTMLImageElement>('img.teaser-img')) {
  if (img.complete) mark(img);
  else {
    img.addEventListener('load', () => mark(img), { once: true });
    img.addEventListener('error', () => mark(img), { once: true });
  }
}

export {};
