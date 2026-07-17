/* Simple, subtle animated mesh-gradient background: a few large, heavily
   blurred color blobs that slowly drift (CSS-driven, GPU-friendly transforms).
   Injects the blob layers into #bg. Motion is paused via CSS under
   prefers-reduced-motion. No WebGL, no libraries. */
(function () {
  const bg = document.getElementById("bg");
  if (!bg) return;
  bg.innerHTML =
    '<span class="blob b1"></span>' +
    '<span class="blob b2"></span>' +
    '<span class="blob b3"></span>' +
    '<span class="blob b4"></span>';
})();
