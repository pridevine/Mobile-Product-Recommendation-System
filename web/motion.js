/* Premium motion layer for GalaxyMatch AI (Samsung-flagship restraint).
   Uses self-hosted Lenis (smooth scroll) + GSAP/ScrollTrigger (reveals).
   Everything is opt-in, degrades gracefully without the libs, and fully
   respects prefers-reduced-motion. Durations 200-600ms, transforms/opacity
   only — no layout-affecting animation. */
(function () {
  "use strict";

  const REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const TOUCH = window.matchMedia("(pointer: coarse)").matches;
  const hasGSAP = typeof window.gsap !== "undefined";
  const hasST = hasGSAP && typeof window.ScrollTrigger !== "undefined";
  const hasLenis = typeof window.Lenis !== "undefined";

  const MOTION = { revealCards, transitionTo };
  window.MOTION = MOTION;

  /* ---------- page enter: gentle fade up (also masks font swap) ---------- */
  const wrap = document.querySelector(".wrap");
  if (!REDUCED && hasGSAP && wrap) {
    gsap.fromTo(wrap, { autoAlpha: 0, y: 14 },
      { autoAlpha: 1, y: 0, duration: 0.55, ease: "power2.out", clearProps: "all" });
  }

  /* ---------- smooth scroll (Lenis) synced into GSAP's ticker ---------- */
  if (!REDUCED && hasLenis) {
    const lenis = new Lenis({ lerp: 0.09, smoothWheel: true });
    if (hasGSAP) {
      lenis.on("scroll", () => hasST && ScrollTrigger.update());
      gsap.ticker.add((t) => lenis.raf(t * 1000));
      gsap.ticker.lagSmoothing(0);
    } else {
      const raf = (t) => { lenis.raf(t); requestAnimationFrame(raf); };
      requestAnimationFrame(raf);
    }
    MOTION.lenis = lenis;
  }

  /* ---------- hero entrance: eyebrow -> title -> tagline -> phone ---------- */
  if (!REDUCED && hasGSAP) {
    const parts = [".hero-eyebrow", ".hero h1", ".hero-tagline", ".hero-phone"]
      .map((s) => document.querySelector(s)).filter(Boolean);
    if (parts.length) {
      gsap.fromTo(parts, { autoAlpha: 0, y: 22 },
        { autoAlpha: 1, y: 0, duration: 0.6, ease: "power3.out", stagger: 0.09, delay: 0.12, clearProps: "all" });
    }
  }

  /* ---------- scroll reveals for static sections ---------- */
  if (!REDUCED && hasST) {
    gsap.registerPlugin(ScrollTrigger);
    document.querySelectorAll(".choose, .or-divider, .features, .matches-head").forEach((el) => {
      gsap.fromTo(el, { autoAlpha: 0, y: 26 }, {
        autoAlpha: 1, y: 0, duration: 0.55, ease: "power2.out",
        scrollTrigger: { trigger: el, start: "top 88%", once: true },
      });
    });
    // static persona cards on the home page (results cards go via revealCards)
    const pcards = document.querySelectorAll(".p-cards .p-card");
    if (pcards.length) {
      gsap.fromTo(pcards, { autoAlpha: 0, y: 24 }, {
        autoAlpha: 1, y: 0, duration: 0.5, ease: "power2.out", stagger: 0.07,
        scrollTrigger: { trigger: ".p-cards", start: "top 88%", once: true },
        clearProps: "transform",
      });
    }
  }

  /* ---------- staggered reveal for (re)rendered result cards ---------- */
  function revealCards(container) {
    if (REDUCED || !hasGSAP || !container) return;
    const cards = container.querySelectorAll(".card");
    if (!cards.length) return;
    gsap.fromTo(cards, { autoAlpha: 0, y: 22 },
      { autoAlpha: 1, y: 0, duration: 0.5, ease: "power2.out", stagger: 0.09, clearProps: "transform" });
  }

  /* ---------- magnetic CTAs (desktop pointer only) ---------- */
  if (!REDUCED && !TOUCH && hasGSAP) {
    const RADIUS = 90, PULL = 0.32;
    document.addEventListener("pointermove", (e) => {
      document.querySelectorAll(".describe-btn, .card.best .why-btn").forEach((btn) => {
        const r = btn.getBoundingClientRect();
        const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
        const dx = e.clientX - cx, dy = e.clientY - cy;
        const dist = Math.hypot(dx, dy);
        if (dist < RADIUS + Math.max(r.width, r.height) / 2) {
          gsap.to(btn, { x: dx * PULL * 0.4, y: dy * PULL * 0.4, duration: 0.3, ease: "power2.out" });
        } else {
          gsap.to(btn, { x: 0, y: 0, duration: 0.45, ease: "elastic.out(1, 0.55)" });
        }
      });
    }, { passive: true });
  }

  /* ---------- cursor-aware highlight on cards (very faint, white theme) ---------- */
  if (!REDUCED && !TOUCH) {
    let raf = 0;
    document.addEventListener("pointermove", (e) => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const card = e.target.closest && e.target.closest(".card, .p-card");
        document.querySelectorAll(".card.lit, .p-card.lit").forEach((c) => { if (c !== card) c.classList.remove("lit"); });
        if (card) {
          const r = card.getBoundingClientRect();
          card.style.setProperty("--mx", ((e.clientX - r.left) / r.width * 100).toFixed(1) + "%");
          card.style.setProperty("--my", ((e.clientY - r.top) / r.height * 100).toFixed(1) + "%");
          card.classList.add("lit");
        }
      });
    }, { passive: true });
  }

  /* ---------- page transition: fade out, then navigate ---------- */
  function transitionTo(url) {
    if (REDUCED || !hasGSAP || !wrap) { location.href = url; return; }
    gsap.to(wrap, { autoAlpha: 0, y: -10, duration: 0.28, ease: "power2.in", onComplete: () => { location.href = url; } });
  }

  // Intercept plain internal links (Start over) for the fade transition.
  document.addEventListener("click", (e) => {
    const a = e.target.closest && e.target.closest("a[href$='index.html'], a[href$='results.html']");
    if (!a || e.metaKey || e.ctrlKey) return;
    e.preventDefault();
    transitionTo(a.getAttribute("href"));
  });
})();
