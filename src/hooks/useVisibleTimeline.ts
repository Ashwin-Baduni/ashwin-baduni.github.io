import type { RefObject } from "react";
import { useGSAP } from "@/lib/gsap";
import { useReducedMotion } from "./useReducedMotion";

/*
  A looping demonstration that plays only while it is on screen.
  Every visit starts from the beginning: once the demo has fully left the viewport it is rebuilt,
  paused on its first frame, and it plays again when at least 30% of it is visible. Rebuilding
  (rather than rewinding) replays exactly like the first visit. A background tab only pauses it.
*/
export function useVisibleTimeline<T extends Element>(
  scope: RefObject<T | null>,
  build: (element: T) => gsap.core.Timeline,
) {
  const reduced = useReducedMotion();
  useGSAP(
    (_, contextSafe) => {
      const element = scope.current;
      if (!element || reduced) return;
      const originalText = [
        ...element.querySelectorAll<HTMLElement>("[data-cycle-text]"),
      ].map((node) => [node, node.textContent] as const);
      const restoreText = () =>
        originalText.forEach(([node, text]) => {
          node.textContent = text;
        });

      let timeline: gsap.core.Timeline | undefined;
      const rebuild = contextSafe!(() => {
        timeline?.kill();
        restoreText();
        timeline = build(element).pause(0);
      });
      rebuild();

      let visible = false;
      let left = false;
      const update = () =>
        visible && !document.hidden ? timeline?.play() : timeline?.pause();
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (!entry.isIntersecting) {
            visible = false;
            if (!left) {
              left = true;
              rebuild();
            }
          } else if (entry.intersectionRatio >= 0.3) {
            visible = true;
            left = false;
          }
          update();
        },
        { threshold: [0, 0.3] },
      );
      observer.observe(element);
      document.addEventListener("visibilitychange", update);
      return () => {
        observer.disconnect();
        document.removeEventListener("visibilitychange", update);
        timeline?.kill();
        restoreText();
      };
    },
    { scope, dependencies: [reduced], revertOnUpdate: true },
  );
}
