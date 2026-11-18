const GAP = 6;
const EDGE = 8;
const NARROW = 480;

/**
 * Fixed-position the panel against the trigger: below it (aligned to its end
 * or start edge), flipped above when it doesn't fit below and there is more
 * room above, and clamped inside the viewport. On narrow phones the CSS pins
 * left/right, so only `top` is set.
 */
export function placePanel(
  panel: HTMLElement,
  trigger: HTMLElement,
  align: 'start' | 'end',
  vw = window.innerWidth,
  vh = window.innerHeight
) {
  const rect = trigger.getBoundingClientRect();
  const width = panel.offsetWidth;
  const height = panel.offsetHeight;
  const below = vh - rect.bottom - GAP - EDGE;
  const above = rect.top - GAP - EDGE;
  const flip = height > below && above > below;
  const top = flip ? rect.top - GAP - height : rect.bottom + GAP;
  panel.style.setProperty('top', `${Math.max(EDGE, top)}px`);
  if (vw <= NARROW) {
    panel.style.removeProperty('left');
    return;
  }
  const left = align === 'end' ? rect.right - width : rect.left;
  panel.style.setProperty('left', `${Math.min(Math.max(EDGE, left), vw - width - EDGE)}px`);
}
