// Card → project page in a modal iframe. Project pages are not modified.
// The card morphs into the modal panel (View Transitions); #<repo> in the URL makes the modal
// deep-linkable and lets the browser back button close it. Cards stay plain links without JS.

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const dialog = document.querySelector<HTMLDialogElement>('dialog.project-modal')!;
const frame = dialog.querySelector<HTMLElement>('.frame')!;
const title = dialog.querySelector<HTMLElement>('#project-modal-title')!;
const openPage = dialog.querySelector<HTMLAnchorElement>('.open-page')!;

let current: HTMLElement | null = null;

function cardFor(id: string) {
  return document.querySelector<HTMLElement>(`.card[data-id="${CSS.escape(id)}"]`);
}

async function morph(direction: 'expand' | 'shrink', card: HTMLElement, update: () => void, animate = true) {
  if (!animate || !document.startViewTransition || reduceMotion.matches) {
    update();
    return;
  }
  const root = document.documentElement;
  root.dataset.vt = direction;
  // The card holds the shared name on the "closed" side of the transition; the open panel holds it on the other.
  if (direction === 'expand') card.classList.add('transitioning');
  const vt = document.startViewTransition(() => {
    card.classList.toggle('transitioning', direction === 'shrink');
    update();
  });
  try {
    await vt.finished;
  } catch {
    // Skipped transitions still apply the update.
  } finally {
    card.classList.remove('transitioning');
    delete root.dataset.vt;
  }
}

function show(card: HTMLElement, animate: boolean) {
  const link = card.querySelector<HTMLAnchorElement>('a.card-link')!;
  current = card;
  title.textContent = card.dataset.name ?? '';
  openPage.href = link.href;

  // A fresh iframe each time: setting src on an existing one would add session-history entries.
  const iframe = document.createElement('iframe');
  iframe.title = `${card.dataset.name} project page`;
  iframe.src = link.href;
  iframe.addEventListener('load', () => iframe.classList.add('loaded'), { once: true });
  frame.querySelector('iframe')?.remove();
  frame.append(iframe);

  return morph('expand', card, () => dialog.showModal(), animate);
}

async function hide() {
  const card = current;
  current = null;
  if (!dialog.open) return;
  const done = () => {
    dialog.close();
    frame.querySelector('iframe')?.remove();
  };
  if (card) await morph('shrink', card, done);
  else done();
  card?.querySelector<HTMLAnchorElement>('a.card-link')?.focus({ preventScroll: true });
}

/** Close through history so back/forward stay consistent with the modal. */
function requestClose() {
  if (history.state?.modal) history.back();
  else hide();
}

document.addEventListener('click', (e) => {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const link = (e.target as Element).closest<HTMLAnchorElement>('a.card-link');
  const card = link?.closest<HTMLElement>('.card');
  if (!card?.dataset.id) return;
  e.preventDefault();
  history.pushState({ modal: card.dataset.id }, '', `#${card.dataset.id}`);
  show(card, true);
});

dialog.querySelector('.close')!.addEventListener('click', requestClose);
// Esc
dialog.addEventListener('cancel', (e) => {
  e.preventDefault();
  requestClose();
});
// Backdrop (the dialog box itself is only visible around the inset panel)
dialog.addEventListener('click', (e) => {
  if (e.target === dialog) requestClose();
});

window.addEventListener('popstate', (e) => {
  let id = (e.state as { modal?: string } | null)?.modal;
  // A typed or linked #<repo> on this page arrives as a same-document navigation with no state.
  if (!id && !e.state && location.hash && cardFor(decodeURIComponent(location.hash.slice(1)))) {
    id = decodeURIComponent(location.hash.slice(1));
    history.replaceState({ modal: id }, '');
  }
  const card = id ? cardFor(id) : null;
  if (card) {
    if (current !== card) show(card, true);
  } else if (dialog.open) {
    hide();
  }
});

// Deep link: /projects/#clap opens that project, and Back/Close returns to the grid.
const initial = location.hash ? cardFor(decodeURIComponent(location.hash.slice(1))) : null;
if (initial?.dataset.id) {
  history.replaceState(null, '', location.pathname + location.search);
  history.pushState({ modal: initial.dataset.id }, '', `#${initial.dataset.id}`);
  show(initial, false);
}

export {};
