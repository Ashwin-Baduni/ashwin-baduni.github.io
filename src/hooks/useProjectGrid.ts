import type { RefObject } from "react";
import { gsap, ScrollTrigger, useGSAP } from "@/lib/gsap";
import { layoutTop } from "@/lib/scrollGeometry";
import { register } from "@/lib/storyLayout";
import { useReducedMotion } from "./useReducedMotion";
import { arrangementOf } from "./useStoryArrangement";

/*
  Wide Projects is one normal-flow grid: the featured project spans both rows on the left,
  with Analytics and CAPTCHA on the right. CSS owns all placement and intrinsic sizing.
  Cards fade as they rise with the document, and their existing visuals run while visible.
  This controller also participates in reading-position restoration when returning to the
  phone stack. It never pins, repositions or intercepts scrolling.
*/
export function useProjectGrid(scope: RefObject<HTMLElement | null>, arranged: number | undefined) {
  const reduced = useReducedMotion();
  useGSAP(() => {
    const root = scope.current!;
    if (arrangementOf(root) !== "grid") return;
    const section = root.closest<HTMLElement>("[data-segment]")!;
    const cards = [...root.querySelectorAll<HTMLElement>(".stack-card")];
    // oxlint-disable-next-line react/immutability -- this effect owns the layout attributes.
    root.dataset.stack = "off";
    root.dataset.arrangement = "grid";
    if (!reduced) cards.forEach((card) => {
      gsap.fromTo(card, { opacity: 0.2 }, {
        opacity: 1,
        ease: "none",
        scrollTrigger: {
          trigger: card,
          start: () => layoutTop(card) - innerHeight,
          end: () => Math.min(ScrollTrigger.maxScroll(window), layoutTop(card) - innerHeight * 0.65),
          scrub: true,
          invalidateOnRefresh: true,
        },
      });
    });
    const unregister = register({
      read: () => {},
      write: () => {},
      // Choosing the nearest card's centre preserves CAPTCHA as well as the featured card
      // when returning from the grid to the single-column sequence.
      cardAt: (y) => {
        const line = y + innerHeight * 0.4;
        if (line < layoutTop(cards[0]) || line > layoutTop(root) + root.offsetHeight) return null;
        return cards.reduce((best, card, index) =>
          Math.abs(layoutTop(card) + card.offsetHeight / 2 - line) <
          Math.abs(layoutTop(cards[best]) + cards[best].offsetHeight / 2 - line) ? index : best, 0);
      },
      phaseAt: () => 1,
      cards: () => cards,
      scrollFor: (index) => layoutTop(cards[index]) - innerHeight * 0.2,
      observe: () => [root, ...cards.map((card) => card.querySelector<HTMLElement>(".project-card-content")!)],
    }, section);
    return () => {
      unregister();
      delete root.dataset.stack;
      delete root.dataset.arrangement;
    };
  }, { scope, dependencies: [arranged, reduced], revertOnUpdate: true });
}
