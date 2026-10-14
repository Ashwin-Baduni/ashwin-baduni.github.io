import { useLayoutEffect, useRef, type RefObject } from "react";
import { gsap } from "@/lib/gsap";
import { useReducedMotion } from "./useReducedMotion";

/*
  A looping demonstration that plays only while it is on screen.
  Every visit starts from the beginning: once the demo has fully left the viewport it is rebuilt,
  paused on its first frame, and it plays again at its visibility threshold (30% by default). Rebuilding
  (rather than rewinding) replays exactly like the first visit. A background tab only pauses it, and so
  does a card that is waiting or covered in a scroll story (its [data-active="false"], set by
  useCardStack). data-playing on the element reports the current state.

  The loop lives in its own GSAP context, owned here rather than by a component's context: each
  rebuild reverts the previous run completely, so replays never accumulate retained animations,
  and nothing is nested in a parent context.
*/
export function useVisibleTimeline<T extends Element>(
  scope: RefObject<T | null>,
  build: (element: T) => gsap.core.Timeline,
  entryRatio = 0.3,
) {
  const reduced = useReducedMotion();
  const builder = useRef(build);
  useLayoutEffect(() => {
    builder.current = build;
  });
  useLayoutEffect(() => {
    const element = scope.current;
    if (!element || reduced) return;
    const target = element as Element as HTMLElement;
    const originalText = [
      ...element.querySelectorAll<HTMLElement>("[data-cycle-text]"),
    ].map((node) => [node, node.textContent] as const);
    const restoreText = () =>
      originalText.forEach(([node, text]) => {
        node.textContent = text;
      });

    // gsap.context() without a function would return the active context instead of a new one.
    const context = gsap.context(() => {});
    let timeline: gsap.core.Timeline | undefined;
    const rebuild = () => {
      // Reverting returns every animated style to its markup value and empties the context.
      context.revert();
      restoreText();
      context.add(() => {
        timeline = builder.current(element).pause(0);
      });
    };
    rebuild();

    let visible = false;
    let left = false;
    const card = element.closest<HTMLElement>("[data-active], .project-card");
    const update = () => {
      const playing = visible && !document.hidden && card?.dataset.active !== "false";
      if (playing) timeline?.play();
      else timeline?.pause();
      target.dataset.playing = String(playing);
    };
    const covered = card && new MutationObserver(update);
    covered?.observe(card!, { attributes: true, attributeFilter: ["data-active"] });
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) {
          visible = false;
          if (!left) {
            left = true;
            rebuild();
          }
        } else if (entry.intersectionRatio >= entryRatio) {
          visible = true;
          left = false;
        }
        update();
      },
      { threshold: [0, entryRatio] },
    );
    observer.observe(element);
    document.addEventListener("visibilitychange", update);
    return () => {
      observer.disconnect();
      covered?.disconnect();
      document.removeEventListener("visibilitychange", update);
      delete target.dataset.playing;
      context.revert();
      restoreText();
    };
  }, [reduced, entryRatio, scope]);
}
