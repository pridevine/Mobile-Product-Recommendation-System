/* CardSwap — vanilla port of the React Bits <CardSwap /> component (MIT).
   React was only orchestrating a GSAP timeline; this drives the same
   animation with the self-hosted vendor/gsap.min.js and no dependencies.

   Usage:
     const swap = initCardSwap(containerEl, {
       cardDistance: 60, verticalDistance: 70, delay: 5000,
       pauseOnHover: false, skewAmount: 6, easing: "elastic",
       onCardClick: (idx) => {},
     });
     swap.destroy();   // stop timers/timelines (call before re-rendering)

   Cards are the container's direct children with class "cs-card".
   Under prefers-reduced-motion the stack is placed statically, no swapping. */
(function () {
  "use strict";

  const REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function makeSlot(i, distX, distY, total) {
    return { x: i * distX, y: -i * distY, z: -i * distX * 1.5, zIndex: total - i };
  }

  function placeNow(el, slot, skew) {
    gsap.set(el, {
      x: slot.x, y: slot.y, z: slot.z,
      xPercent: -50, yPercent: -50,
      skewY: skew,
      transformOrigin: "center center",
      zIndex: slot.zIndex,
      force3D: true,
    });
  }

  function initCardSwap(container, opts) {
    if (typeof window.gsap === "undefined" || !container) return { destroy() {} };

    const o = Object.assign({
      cardDistance: 60, verticalDistance: 70, delay: 5000,
      pauseOnHover: false, skewAmount: 6, easing: "elastic",
      onCardClick: null,
    }, opts || {});

    const config = o.easing === "elastic"
      ? { ease: "elastic.out(0.6,0.9)", durDrop: 2, durMove: 2, durReturn: 2, promoteOverlap: 0.9, returnDelay: 0.05 }
      : { ease: "power1.inOut", durDrop: 0.8, durMove: 0.8, durReturn: 0.8, promoteOverlap: 0.45, returnDelay: 0.2 };

    const cards = Array.from(container.querySelectorAll(":scope > .cs-card"));
    const total = cards.length;
    let order = cards.map((_, i) => i);
    let tl = null;
    let interval = null;

    cards.forEach((el, i) => {
      placeNow(el, makeSlot(i, o.cardDistance, o.verticalDistance, total), REDUCED ? 0 : o.skewAmount);
      if (o.onCardClick) el.addEventListener("click", () => o.onCardClick(i));
    });

    if (REDUCED || total < 2) return { select, destroy() {} };

    function swap() {
      if (order.length < 2) return;
      const front = order[0];
      const rest = order.slice(1);
      const elFront = cards[front];
      tl = gsap.timeline();

      tl.to(elFront, { y: "+=500", duration: config.durDrop, ease: config.ease });

      tl.addLabel("promote", `-=${config.durDrop * config.promoteOverlap}`);
      rest.forEach((idx, i) => {
        const el = cards[idx];
        const slot = makeSlot(i, o.cardDistance, o.verticalDistance, total);
        tl.set(el, { zIndex: slot.zIndex }, "promote");
        tl.to(el, { x: slot.x, y: slot.y, z: slot.z, duration: config.durMove, ease: config.ease },
          `promote+=${i * 0.15}`);
      });

      const backSlot = makeSlot(total - 1, o.cardDistance, o.verticalDistance, total);
      tl.addLabel("return", `promote+=${config.durMove * config.returnDelay}`);
      tl.call(() => { gsap.set(elFront, { zIndex: backSlot.zIndex }); }, null, "return");
      tl.to(elFront, { x: backSlot.x, y: backSlot.y, z: backSlot.z, duration: config.durReturn, ease: config.ease }, "return");

      tl.call(() => { order = [...rest, front]; });
    }

    function select(index) {
      if (!Number.isInteger(index) || index < 0 || index >= total) return;
      if (!order.includes(index)) return;

      const nextOrder = [index, ...order.filter((item) => item !== index)];
      order = nextOrder;
      if (tl) tl.kill();

      if (REDUCED) {
        nextOrder.forEach((cardIndex, slotIndex) => {
          placeNow(cards[cardIndex], makeSlot(slotIndex, o.cardDistance, o.verticalDistance, total), 0);
        });
        return;
      }

      tl = gsap.timeline();
      nextOrder.forEach((cardIndex, slotIndex) => {
        const slot = makeSlot(slotIndex, o.cardDistance, o.verticalDistance, total);
        tl.set(cards[cardIndex], { zIndex: slot.zIndex }, 0);
        tl.to(cards[cardIndex], {
          x: slot.x, y: slot.y, z: slot.z, skewY: o.skewAmount,
          duration: 0.8, ease: "power2.out",
        }, 0);
      });
    }

    swap();
    interval = window.setInterval(swap, o.delay);

    let pause = null, resume = null;
    if (o.pauseOnHover) {
      pause = () => { if (tl) tl.pause(); clearInterval(interval); };
      resume = () => { if (tl) tl.play(); interval = window.setInterval(swap, o.delay); };
      container.addEventListener("mouseenter", pause);
      container.addEventListener("mouseleave", resume);
    }

    return {
      select,
      destroy() {
        clearInterval(interval);
        if (tl) tl.kill();
        if (pause) container.removeEventListener("mouseenter", pause);
        if (resume) container.removeEventListener("mouseleave", resume);
      },
    };
  }

  window.initCardSwap = initCardSwap;
})();
