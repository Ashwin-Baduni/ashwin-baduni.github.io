import type { RefObject } from "react";
import { gsap, useGSAP } from "@/lib/gsap";
import { layoutTop, revealEnd } from "@/lib/scrollGeometry";
import { useReducedMotion } from "./useReducedMotion";

/*
  Reveals tied to the scroll position, so they play forwards on the way down and backwards on
  the way up. [data-enter] elements rise and fade in as they come up the lower part of the
  screen; [data-settle] elements rise and grow into place without fading, the way cards do.
  Positions are read from the element's parent, which does not move, so each reveal ends
  exactly where intended. Inside a [data-sticky] panel they are read from the panel's section,
  which keeps its place while the panel is held, and the pieces arrive in data-enter order.
*/
export function useScrollReveal(scope: RefObject<HTMLElement | null>) {
  const reduced = useReducedMotion();
  useGSAP(
    () => {
      if (reduced) return;
      scope
        .current!.querySelectorAll<HTMLElement>("[data-enter], [data-settle]")
        .forEach((element) => {
          const settle = element.hasAttribute("data-settle");
          const sticky = element.closest<HTMLElement>("[data-sticky]");
          const parent = sticky?.parentElement ?? element.parentElement!;
          const section = element.closest<HTMLElement>("[data-segment]")!;
          // Where the element starts within its parent, unaffected by its own movement.
          const offset = () =>
            sticky
              ? (Number(element.dataset.enter ?? 1) - 1) * innerHeight * 0.08
              : element.offsetParent === parent
                ? element.offsetTop
                : element.offsetTop - parent.offsetTop;
          gsap.fromTo(
            element,
            settle
              ? { y: 48, scale: 0.95, transformOrigin: "50% 0%" }
              : { y: 28, autoAlpha: 0 },
            {
              ...(settle ? { y: 0, scale: 1 } : { y: 0, autoAlpha: 1 }),
              ease: "none",
              scrollTrigger: {
                trigger: parent,
                start: () =>
                  layoutTop(sticky ? parent : element) +
                  (sticky ? offset() : 0) -
                  innerHeight,
                end: () =>
                  sticky
                    ? layoutTop(section)
                    : revealEnd(
                        section,
                        layoutTop(element) - innerHeight * 0.84,
                      ),
                scrub: 0.4,
                invalidateOnRefresh: true,
              },
            },
          );
        });
    },
    { scope, dependencies: [reduced], revertOnUpdate: true },
  );
}
