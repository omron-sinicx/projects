// Arrow buttons for the horizontal rails on the top page. The rails scroll natively without this.

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

for (const section of document.querySelectorAll<HTMLElement>('[data-rail]')) {
  const rail = section.querySelector<HTMLElement>('.rail')!;
  const arrows = [...section.querySelectorAll<HTMLButtonElement>('.arrow')];

  const update = () => {
    const overflowing = rail.scrollWidth > rail.clientWidth + 1;
    for (const a of arrows) {
      a.hidden = !overflowing;
      const dir = Number(a.dataset.dir);
      a.disabled =
        dir < 0 ? rail.scrollLeft <= 0 : rail.scrollLeft + rail.clientWidth >= rail.scrollWidth - 1;
    }
  };

  for (const a of arrows) {
    a.addEventListener('click', () => {
      rail.scrollBy({
        left: Number(a.dataset.dir) * rail.clientWidth * 0.8, behavior: reduceMotion.matches ? 'auto' : 'smooth',
      });
    });
  }
  rail.addEventListener('scroll', update, { passive: true });
  new ResizeObserver(update).observe(rail);
  update();
}

export {};
