const INTERACTIVE = 'button, a, input, select, textarea, label';

/**
 * True when the event came from a button, link or form control inside
 * `e.currentTarget` (a clickable row/item), which handles its own click.
 */
export function fromInnerControl(e: { target: EventTarget; currentTarget: Element }) {
  const hit = (e.target as Element).closest(INTERACTIVE);
  return !!hit && hit !== e.currentTarget && e.currentTarget.contains(hit);
}
