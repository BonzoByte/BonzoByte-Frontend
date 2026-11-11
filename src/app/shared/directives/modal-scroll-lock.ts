/** Input isolation for modal dialogs, including independently scrollable grids. */
interface ModalScrollState {
  roots: HTMLElement[];
  removeListeners: () => void;
  hadClass: boolean;
}

const states = new WeakMap<Document, ModalScrollState>();
const activeClass = 'bb-modal-active';

function canScroll(root: HTMLElement, target: EventTarget | null, dx: number, dy: number): boolean {
  if (!(target instanceof Node) || !root.contains(target)) return false;
  const view = root.ownerDocument.defaultView;
  if (!view) return false;
  let element = target instanceof Element ? target : target.parentElement;
  while (element && root.contains(element)) {
    const style = view.getComputedStyle(element);
    const vertical = element.scrollHeight - element.clientHeight;
    const horizontal = element.scrollWidth - element.clientWidth;
    const leftMin = style.direction === 'rtl' ? -horizontal : 0;
    const leftMax = style.direction === 'rtl' ? 0 : horizontal;
    if ((/^(auto|scroll|overlay)$/.test(style.overflowY) && vertical > 1 &&
      (dy < 0 ? element.scrollTop > 0 : dy > 0 && element.scrollTop < vertical - 1)) ||
      (/^(auto|scroll|overlay)$/.test(style.overflowX) && horizontal > 1 &&
      (dx < 0 ? element.scrollLeft > leftMin : dx > 0 && element.scrollLeft < leftMax - 1))) return true;
    if (element === root) break;
    element = element.parentElement;
  }
  return false;
}

/** Returns an idempotent release; only the topmost live dialog consumes scroll. */
export function lockModalScroll(root: HTMLElement, document: Document): () => void {
  let state = states.get(document);
  if (!state) {
    state = { roots: [], removeListeners: () => {}, hadClass: document.documentElement.classList.contains(activeClass) };
    const current = state;
    const top = () => current.roots[current.roots.length - 1];
    let touch: { x: number; y: number } | null = null;
    const wheel = (event: WheelEvent) => {
      const modal = top();
      // Preserve browser zoom and pinch-to-zoom shortcuts.
      if (!modal || event.ctrlKey || event.defaultPrevented) return;
      const dx = event.shiftKey && event.deltaX === 0 ? event.deltaY : event.deltaX;
      const dy = event.shiftKey && event.deltaX === 0 ? 0 : event.deltaY;
      if (!canScroll(modal, event.target, dx, dy)) event.preventDefault();
    };
    const middle = (event: MouseEvent) => {
      const modal = top();
      if (!modal || event.button !== 1) return;
      const target = event.target instanceof Element ? event.target : null;
      // Keep middle-clicking a link inside the dialog available for a new tab,
      // but do not let the browser start page/grid auto-scroll behind the dialog.
      if (!target || !modal.contains(target) || !target.closest('a[href]')) event.preventDefault();
    };
    const touchStart = (event: TouchEvent) => {
      touch = event.touches.length === 1 ? { x: event.touches[0].clientX, y: event.touches[0].clientY } : null;
    };
    const touchMove = (event: TouchEvent) => {
      const modal = top();
      if (!modal || event.touches.length !== 1 || !touch) return;
      const point = event.touches[0];
      const dx = touch.x - point.clientX, dy = touch.y - point.clientY;
      touch = { x: point.clientX, y: point.clientY };
      if (!canScroll(modal, event.target, dx, dy)) event.preventDefault();
    };
    const touchEnd = () => { touch = null; };
    document.addEventListener('wheel', wheel, { capture: true, passive: false });
    document.addEventListener('mousedown', middle, true);
    document.addEventListener('touchstart', touchStart, { capture: true, passive: true });
    document.addEventListener('touchmove', touchMove, { capture: true, passive: false });
    document.addEventListener('touchend', touchEnd, true);
    document.addEventListener('touchcancel', touchEnd, true);
    current.removeListeners = () => {
      document.removeEventListener('wheel', wheel, true);
      document.removeEventListener('mousedown', middle, true);
      document.removeEventListener('touchstart', touchStart, true);
      document.removeEventListener('touchmove', touchMove, true);
      document.removeEventListener('touchend', touchEnd, true);
      document.removeEventListener('touchcancel', touchEnd, true);
    };
    states.set(document, current);
    document.documentElement.classList.add(activeClass);
  }
  state.roots.push(root);
  const current = state;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    const index = current.roots.indexOf(root);
    if (index >= 0) current.roots.splice(index, 1);
    if (current.roots.length === 0) {
      current.removeListeners();
      if (!current.hadClass) document.documentElement.classList.remove(activeClass);
      states.delete(document);
    }
  };
}
