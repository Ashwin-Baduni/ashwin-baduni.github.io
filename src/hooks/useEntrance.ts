import { useLayoutEffect, useRef, type RefObject } from "react";
import { gsap, ScrollTrigger } from "@/lib/gsap";
import { useReducedMotion } from "./useReducedMotion";

export function useEntrance(
  scope: RefObject<HTMLElement | null>,
  extend?: (tl: gsap.core.Timeline, root: HTMLElement) => void,
) {
  const reduced = useReducedMotion();
  const extension = useRef(extend);
  extension.current = extend;

  useLayoutEffect(() => {
    const root = scope.current;
    if (!root || reduced) return;
    let disposed = false;
    let context: gsap.Context | undefined;
    let trigger: ScrollTrigger | undefined;
    const originals = new Map<Element, string | null>();

    document.fonts.ready.then(() => {
      if (disposed) return;
      const styles = new Map(
        [...root.querySelectorAll("*")].map((element) => [
          element,
          element.getAttribute("style"),
        ]),
      );
      context = gsap.context(() => {
        let direction = 1;
        const timeline = gsap.timeline({
          paused: true,
          defaults: { duration: 0.85, ease: "power2.out" },
        });
        extension.current?.(timeline, root);
        const groups = new Map<number, HTMLElement[]>();
        root
          .querySelectorAll<HTMLElement>("[data-enter]")
          .forEach((element) => {
            const order = Number(element.dataset.enter);
            groups.set(order, [...(groups.get(order) ?? []), element]);
          });
        [...groups.keys()]
          .sort((a, b) => a - b)
          .forEach((key, index) => {
            timeline.fromTo(
              groups.get(key)!,
              { y: () => direction * 24, autoAlpha: 0 },
              { y: 0, autoAlpha: 1, stagger: 0.055, immediateRender: false },
              index * 0.13,
            );
          });
        // Repeated invalidation can replace GSAP's starting-style snapshot.
        // Keep the true original styles for precisely the elements this hook owns.
        timeline.getChildren(true, true, false).forEach((animation) => {
          (animation as gsap.core.Tween).targets().forEach((target) => {
            if (target instanceof Element)
              originals.set(target, styles.get(target) ?? null);
          });
        });
        const play = (value: number) => {
          if (
            disposed ||
            matchMedia("(prefers-reduced-motion: reduce)").matches
          )
            return;
          direction = value;
          timeline.invalidate().restart();
          root.dataset.entrances = String(
            Number(root.dataset.entrances ?? 0) + 1,
          );
        };
        const finish = () => {
          if (!disposed) timeline.progress(1).pause();
        };
        trigger = ScrollTrigger.create({
          trigger: root,
          start: "top 88%",
          end: "bottom 12%",
          onEnter: () => play(1),
          onEnterBack: () => play(-1),
          onLeave: finish,
          onLeaveBack: finish,
        });
      }, root);
    });
    return () => {
      disposed = true;
      trigger?.kill();
      context?.revert();
      originals.forEach((style, element) => {
        if (style === null) element.removeAttribute("style");
        else element.setAttribute("style", style);
      });
    };
  }, [reduced, scope]);
}
