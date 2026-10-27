// Infinite-scroll style reveal for long card grids. Every card is already in the HTML (so the page
// works without JS and in-page search still finds them once revealed); this only hides all but the
// first batch and shows the next batch as the end of the list nears the viewport.

const BATCH = 20; // four rows of five on a wide screen

for (const list of document.querySelectorAll<HTMLElement>('[data-progressive]')) {
  const items = [...list.children] as HTMLElement[];
  if (items.length <= BATCH) continue;

  let shown = BATCH;
  items.slice(BATCH).forEach((li) => (li.hidden = true));

  const sentinel = document.createElement('div');
  sentinel.setAttribute('aria-hidden', 'true');
  list.after(sentinel);

  const io = new IntersectionObserver(
    (entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      for (const li of items.slice(shown, shown + BATCH)) {
        li.hidden = false;
        li.classList.add('revealed');
      }
      shown += BATCH;
      if (shown >= items.length) {
        io.disconnect();
        sentinel.remove();
        return;
      }
      // Still near the viewport after this batch (short batch, tall screen)? Re-observe to fire again.
      io.unobserve(sentinel);
      io.observe(sentinel);
    },
    { rootMargin: '0px 0px 300px 0px' },
  );
  io.observe(sentinel);
}

export {};
