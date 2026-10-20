import type { Point } from '../types';

// Observe gestures without capturing the pointer, so map panning and pinch zoom still work.
export function listenForMapLongPress(
  element: HTMLElement,
  pointAt: (event: PointerEvent) => Point | undefined,
  onHold: (point: Point) => void,
) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let start: { x: number; y: number; id: number } | undefined;
  let suppressClickUntil = 0;
  const pointers = new Set<number>();
  const cancel = () => {
    clearTimeout(timer);
    start = undefined;
  };
  const down = (event: PointerEvent) => {
    pointers.add(event.pointerId);
    cancel();
    if (pointers.size !== 1 || !event.isPrimary || event.button !== 0) return;
    const target = event.target;
    if (target instanceof Element && target.closest('button, a, input, .leaflet-marker-icon, [role="button"]')) return;
    const point = pointAt(event);
    if (!point) return;
    start = { x: event.clientX, y: event.clientY, id: event.pointerId };
    timer = setTimeout(() => {
      start = undefined;
      suppressClickUntil = Date.now() + 1000;
      onHold(point);
    }, 550);
  };
  const move = (event: PointerEvent) => {
    if (start?.id === event.pointerId && Math.hypot(event.clientX - start.x, event.clientY - start.y) > 10) cancel();
  };
  const up = (event: PointerEvent) => {
    pointers.delete(event.pointerId);
    cancel();
  };
  const context = (event: Event) => event.preventDefault();
  const click = (event: Event) => {
    if (Date.now() < suppressClickUntil) {
      event.preventDefault();
      event.stopPropagation();
    }
  };
  element.addEventListener('pointerdown', down, true);
  window.addEventListener('pointermove', move, true);
  window.addEventListener('pointerup', up, true);
  window.addEventListener('pointercancel', up, true);
  window.addEventListener('blur', cancel);
  element.addEventListener('wheel', cancel, true);
  element.addEventListener('contextmenu', context);
  element.addEventListener('click', click, true);
  return () => {
    cancel();
    element.removeEventListener('pointerdown', down, true);
    window.removeEventListener('pointermove', move, true);
    window.removeEventListener('pointerup', up, true);
    window.removeEventListener('pointercancel', up, true);
    window.removeEventListener('blur', cancel);
    element.removeEventListener('wheel', cancel, true);
    element.removeEventListener('contextmenu', context);
    element.removeEventListener('click', click, true);
  };
}
