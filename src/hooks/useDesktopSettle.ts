import { useLayoutEffect, type RefObject } from "react";
import { gsap, ScrollTrigger } from "@/lib/gsap";
import { layoutTop } from "@/lib/scrollGeometry";
import { exitOf, heldRangeOf, register } from "@/lib/storyLayout";
import {
  destination, reached, settleTarget, settleMotion, wheelBurst,
  type Destination, type ReadingRange, type WheelBurst,
} from "@/lib/desktopSettle";

// On screen, or close enough that moving it by `reach` could bring it into view.
const within = (node: HTMLElement, reach: number) => {
  const bounds = node.getBoundingClientRect();
  return bounds.top < innerHeight + reach && bounds.bottom > -reach;
};

// Finish an idle desktop gesture. Wheel/touch input remains native. Reading ranges protect
// demonstrations, and only a gesture that began outside one may recover to its entrance.
export function useDesktopSettle(scope: RefObject<HTMLElement | null>) {
  useLayoutEffect(() => {
    const main = scope.current!;
    const html = document.documentElement;
    const fine = matchMedia("(hover: hover) and (pointer: fine)");
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    let desktop = false;
    let armed = false;
    let idle = 0;
    let burst: WheelBurst | null = null;
    let intent: Destination | null = null;
    // Where the current gesture began, for the direction it actually moved the page.
    let origin = scrollY;
    // Passive wheel handlers can run after the compositor has already applied that wheel's
    // movement. Keep the preceding resting position, rather than reading the advanced offset.
    let resting = scrollY;
    let tween: gsap.core.Tween | undefined;
    let release: gsap.core.Tween | undefined;
    let visual: { elements: Array<{ element: HTMLElement; original: string }>; offset: number } | undefined;

    const restoreVisual = () => {
      visual?.elements.forEach(({ element, original }) => { element.style.translate = original; });
      visual = undefined;
      delete html.dataset.swinging;
    };
    const stopMotion = (immediate: boolean) => {
      tween?.kill();
      tween = undefined;
      release?.kill();
      release = undefined;
      delete html.dataset.settling;
      // Input scrolls immediately while the decorative offset relaxes without a one-frame jump.
      // Layout changes and unmounts restore synchronously before measurement.
      if (!immediate && visual?.offset) {
        const current = visual;
        release = gsap.to(current, { offset: 0, duration: .12, ease: "power2.out",
          onUpdate: () => { current.elements.forEach(({ element }) => { element.style.translate = `0 ${current.offset}px`; }); },
          onComplete: () => { release = undefined; restoreVisual(); },
        });
      } else restoreVisual();
    };
    const clear = () => {
      armed = false;
      burst = null;
      intent = null;
      resting = scrollY;
      clearTimeout(idle);
      stopMotion(true);
    };
    const enabled = () => desktop && fine.matches && !reduced.matches && !document.hidden;
    const sections = () => [...main.querySelectorAll<HTMLElement>("[data-segment]")];
    const ranges = (): ReadingRange[] => {
      const max = ScrollTrigger.maxScroll(window);
      const clamp = (y: number) => Math.max(0, Math.min(max, y));
      return sections().map(section => {
        const held = heldRangeOf(section);
        if (held) {
          const intro = section.querySelector<HTMLElement>(".stack-intro")!;
          const label = intro.querySelector<HTMLElement>(".kind, h2") ?? intro;
          return { start: clamp(held.start), end: clamp(held.end),
            enter: layoutTop(label) - innerHeight * .97,
            leave: held.end + exitOf(section)!.heldBottom - innerHeight * .03 };
        }
        const content = section.querySelector<HTMLElement>(":scope > .wrap") ?? section;
        const top = layoutTop(content);
        const height = content.offsetHeight;
        const inset = Math.max(16, (innerHeight - height) / 2);
        const start = clamp(top - inset);
        return { start, end: Math.max(start, clamp(top + height - innerHeight + inset)),
          enter: top - innerHeight * .97, leave: top + height - innerHeight * .03 };
      });
    };
    const settle = () => {
      if (!armed || !burst || !enabled() || tween) return;
      clearTimeout(idle);
      // Wait for BOTH wheel input and actual native movement, including the inertial tail.
      if (performance.now() - burst.last < 180) {
        idle = window.setTimeout(settle, 180);
        return;
      }
      armed = false;
      // Otherwise the next section in the direction the page actually moved: it never rests
      // between sections, and never goes back against the visitor's own scrolling.
      const chosen = !burst.released && intent && reached(intent, scrollY)
        ? intent : settleTarget(ranges(), scrollY, Math.sign(scrollY - origin) || burst.direction);
      if (!chosen) { resting = scrollY; return; }
      const { target } = chosen;
      const from = scrollY;
      // The motion runs along the correction. If native momentum passed the destination, the
      // section pulls the page back and the swing goes past it on the other side.
      const direction = Math.sign(target - from);
      const motion = settleMotion(Math.abs(target - from), innerHeight);
      const clock = { time: 0 };
      const all = sections();
      const element = all[chosen.index];
      visual = { elements: [], offset: 0 };
      const paint = () => {
        const along = target + direction * motion.at(clock.time);
        // Actual scrolling covers only the pull. From its arrival the page rests at the
        // destination and the section itself swings and bounces. Otherwise sticky stories conceal
        // the swing, demos advance during it, and the footer runs into the document boundary.
        const arrived = clock.time >= motion.arrival;
        window.scrollTo({ top: arrived ? target : along, behavior: "instant" });
        if (!visual || !arrived) return;
        if (!visual.elements.length) {
          // Every section the swing could bring into view moves with it, on either side, so the
          // gaps between them keep their size; in particular, the compact footer can share the
          // screen with the Projects grid. The rest stay put.
          visual.elements = all.filter(node => node === element || within(node, motion.swing))
            .map(node => ({ element: node, original: node.style.translate }));
          // Scroll anchoring must not follow the swing (Firefox counts translations), or it
          // moves the page as the offset is removed.
          html.dataset.swinging = "";
        }
        visual.offset = target - along;
        visual.elements.forEach(({ element: node }) => { node.style.translate = `0 ${visual!.offset}px`; });
      };
      html.dataset.settling = "on";
      tween = gsap.to(clock, { time: motion.duration, duration: motion.duration, ease: "none", onUpdate: paint,
        onComplete: () => {
          tween = undefined;
          resting = scrollY;
          delete html.dataset.settling;
          restoreVisual();
        } });
    };
    const scrolled = () => {
      if (tween) return;
      clearTimeout(idle);
      idle = window.setTimeout(() => {
        if (armed) settle();
        else resting = scrollY;
      }, 180);
    };
    const wheel = (event: WheelEvent) => {
      if (tween) {
        // Input takes over at once; the page settles again from wherever it is left.
        stopMotion(false);
        resting = scrollY;
      }
      if (!enabled() || event.defaultPrevented || event.ctrlKey || event.shiftKey ||
          Math.abs(event.deltaY) <= Math.abs(event.deltaX)) { clear(); return; }
      const target = event.target instanceof Element ? event.target : null;
      if (!target || !main.contains(target) || document.querySelector('[role="dialog"], dialog[open]')) { clear(); return; }
      for (let node: Element | null = target; node && node !== main; node = node.parentElement) {
        if (node.matches("input, textarea, select, [contenteditable=true]") ||
            (/auto|scroll/.test(getComputedStyle(node).overflowY) && node.scrollHeight > node.clientHeight + 1)) { clear(); return; }
      }
      const now = performance.now();
      const momentum = (event as WheelEvent & { momentum?: boolean }).momentum;
      if (!burst || (now - burst.last > 240 && momentum !== true)) {
        burst = null;
        origin = resting;
        intent = destination(ranges(), resting, Math.sign(event.deltaY));
      }
      const unit = event.deltaMode === 1 ? parseFloat(getComputedStyle(html).fontSize) : event.deltaMode === 2 ? innerHeight : 1;
      burst = wheelBurst(burst, { time: now, delta: event.deltaY * unit,
        momentum });
      armed = true;
      scrolled();
    };
    const unregister = register({
      late: true,
      read: m => { if (desktop !== m.desktop) clear(); desktop = m.desktop; },
      write: () => {},
    });
    window.addEventListener("wheel", wheel, { passive: true });
    window.addEventListener("scroll", scrolled, { passive: true });
    document.addEventListener("scrollend", settle);
    for (const type of ["pointerdown", "touchstart", "keydown", "resize", "hashchange", "popstate"]) window.addEventListener(type, clear, { passive: true });
    document.addEventListener("click", clear, true);
    document.addEventListener("visibilitychange", clear);
    fine.addEventListener("change", clear);
    reduced.addEventListener("change", clear);
    ScrollTrigger.addEventListener("refreshInit", clear);
    return () => {
      clear();
      unregister();
      window.removeEventListener("wheel", wheel);
      window.removeEventListener("scroll", scrolled);
      document.removeEventListener("scrollend", settle);
      for (const type of ["pointerdown", "touchstart", "keydown", "resize", "hashchange", "popstate"]) window.removeEventListener(type, clear);
      document.removeEventListener("click", clear, true);
      document.removeEventListener("visibilitychange", clear);
      fine.removeEventListener("change", clear);
      reduced.removeEventListener("change", clear);
      ScrollTrigger.removeEventListener("refreshInit", clear);
    };
  }, [scope]);
}
