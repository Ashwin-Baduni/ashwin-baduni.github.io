import type { RefObject } from "react";
import { gsap, useGSAP } from "@/lib/gsap";
import { layoutTop, revealEnd } from "@/lib/scrollGeometry";
import { useReducedMotion } from "./useReducedMotion";

/*
  Reveals tied to the scroll position, so they play forwards on the way down and backwards on
  the way up. [data-enter] elements rise and fade in as they come up the lower part of the
  screen; [data-settle] elements rise and grow into place without fading, the way cards do.
  Positions are read from the element's parent, which does not move, so each reveal ends
  exactly where intended.
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
          const parent = element.parentElement!;
          const section = element.closest<HTMLElement>("[data-segment]")!;
          gsap.fromTo(
            element,
            settle
              ? { y: 48, scale: 0.95, transformOrigin: "50% 0%" }
              : { y: 28, opacity: 0 },
            {
              // Opacity, not visibility: a link still waiting to be revealed stays reachable with
              // Tab, and is fully shown once focused (see :focus-visible in index.css).
              ...(settle ? { y: 0, scale: 1 } : { y: 0, opacity: 1 }),
              ease: "none",
              scrollTrigger: {
                trigger: parent,
                start: () => layoutTop(element) - innerHeight,
                // Finished by the time its still parent (a row, say) is fully on screen,
                // so nothing is left settling once it can be read; but never over less
                // than 60px of scroll, so short rows don't snap.
                end: () => {
                  const start = layoutTop(element) - innerHeight;
                  return Math.max(
                    start + 60,
                    Math.min(
                      revealEnd(
                        section,
                        layoutTop(element) - innerHeight * 0.84,
                      ),
                      layoutTop(parent) + parent.offsetHeight - innerHeight,
                    ),
                  );
                },
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
