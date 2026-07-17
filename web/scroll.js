/* Lenis smooth scrolling (self-hosted vendor/lenis.min.js, exposes
   globalThis.Lenis). Skipped entirely under prefers-reduced-motion and
   when the library failed to load — native scrolling remains. */
(function () {
  "use strict";

  const REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (REDUCED || typeof window.Lenis === "undefined") return;

  const lenis = new Lenis({
    lerp: 0.09,        // lower = floatier, higher = snappier
    smoothWheel: true,
  });
  window.__lenis = lenis;

  function raf(time) {
    lenis.raf(time);
    requestAnimationFrame(raf);
  }
  requestAnimationFrame(raf);

  // Same-page anchor links glide through Lenis instead of jumping.
  document.addEventListener("click", (e) => {
    const a = e.target.closest && e.target.closest('a[href^="#"]');
    if (!a) return;
    const target = document.querySelector(a.getAttribute("href"));
    if (!target) return;
    e.preventDefault();
    lenis.scrollTo(target, { offset: -12 });
  });
})();
