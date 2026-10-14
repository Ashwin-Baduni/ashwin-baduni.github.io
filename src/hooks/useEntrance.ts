import { useLayoutEffect, useRef, type RefObject } from "react";
import { gsap, ScrollTrigger } from "@/lib/gsap";
import { useReducedMotion } from "./useReducedMotion";

/*
  Every [data-enter] element rises into place as it reaches the lower part of the screen, so a
  section stacked taller than a phone reveals piece by piece instead of all at once out of sight.
  Elements arriving together are staggered by their data-enter order. Coming back to an element
  plays it again, from below when scrolling down and from above when scrolling up.
  `extend` builds a one-off timeline that plays when the section itself arrives.
*/
const order = (element: HTMLElement) => Number(element.dataset.enter);

export function useEntrance(
  scope: RefObject<HTMLElement | null>,
  extend?: (tl: gsap.core.Timeline, root: HTMLElement) => void,
) {
  const reduced = useReducedMotion();
  const extension = useRef(extend);
  useLayoutEffect(() => {
    extension.current = extend;
  });

  useLayoutEffect(() => {
    const root = scope.current;
    if (!root || reduced) return;
    let disposed = false;
    let context: gsap.Context | undefined;
    let frame = 0;
    const originals = new Map<Element, string | null>();

    document.fonts.ready.then(() => {
      if (disposed) return;
      const elements = [...root.querySelectorAll<HTMLElement>("[data-enter]")];
      const extended = extension.current;
      const styles = new Map(
        [...root.querySelectorAll("*")].map((element) => [
          element,
          element.getAttribute("style"),
        ]),
      );
      context = gsap.context(() => {
        let queue: { element: HTMLElement; direction: number }[] = [];
        let extendedTargets: Element[] = [];
        const flush = () => {
          frame = 0;
          const batch = queue.toSorted(
            (a, b) =>
              order(a.element) - order(b.element) ||
              (a.element.compareDocumentPosition(b.element) &
              Node.DOCUMENT_POSITION_FOLLOWING
                ? -1
                : 1),
          );
          queue = [];
          batch.forEach(({ element, direction }, index) =>
            gsap.fromTo(
              element,
              { y: direction * 24, opacity: 0 },
              {
                y: 0,
                opacity: 1,
                duration: 0.85,
                delay: index * 0.08,
                ease: "power2.out",
                overwrite: true,
              },
            ),
          );
          root.dataset.entrances = String(
            Number(root.dataset.entrances ?? 0) + 1,
          );
        };
        const reveal = (element: HTMLElement, direction: number) => {
          if (
            disposed ||
            matchMedia("(prefers-reduced-motion: reduce)").matches
          )
            return;
          queue = queue.filter((item) => item.element !== element);
          queue.push({ element, direction });
          frame ||= requestAnimationFrame(flush);
        };
        elements.forEach((element) => {
          // Still below the fold: wait out of sight (transparent, but still reachable with Tab).
          // On screen or already passed: leave as is.
          if (element.getBoundingClientRect().top > innerHeight * 0.92)
            gsap.set(element, { opacity: 0 });
          ScrollTrigger.create({
            trigger: element,
            start: "top 92%",
            end: "bottom 8%",
            onEnter: () => reveal(element, 1),
            onEnterBack: () => reveal(element, -1),
          });
        });
        if (extended) {
          const timeline = gsap.timeline({
            paused: true,
            defaults: { duration: 0.85, ease: "power2.out" },
          });
          extended(timeline, root);
          extendedTargets = timeline
            .getChildren(true, true, false)
            .flatMap((tween) => (tween as gsap.core.Tween).targets<Element>())
            .filter((target) => target instanceof Element);
          const play = () =>
            !matchMedia("(prefers-reduced-motion: reduce)").matches &&
            timeline.restart();
          const finish = () => timeline.progress(1).pause();
          ScrollTrigger.create({
            trigger: root,
            start: "top 88%",
            end: "bottom 12%",
            onEnter: play,
            onEnterBack: play,
            onLeave: finish,
            onLeaveBack: finish,
          });
        }
        // Keep the true original styles of exactly the elements animated here.
        [...elements, ...extendedTargets].forEach((target) =>
          originals.set(target, styles.get(target) ?? null),
        );
      }, root);
    });
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      gsap.killTweensOf([...originals.keys()]);
      context?.revert();
      originals.forEach((style, element) => {
        if (style === null) element.removeAttribute("style");
        else element.setAttribute("style", style);
      });
    };
  }, [reduced, scope]);
}
