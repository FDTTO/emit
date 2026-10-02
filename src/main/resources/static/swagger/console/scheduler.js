/*
 * One repaint per frame, however many changes asked for it. React rebuilds
 * Swagger's nodes on every expand and collapse, so the console repaints on
 * mutation; the painter is registered by index.js, so this module depends on
 * nothing and any module can ask for a frame.
 */
let queued = false;
let painter = function () {};

export function onFrame(paint) {
  painter = paint;
}

export function schedule() {
  if (queued) return;
  queued = true;
  requestAnimationFrame(function () {
    queued = false;
    painter();
  });
}
