import { useLayoutEffect } from "react";
import { gsap, ScrollTrigger } from "@/lib/gsap";
import { ScrollToPlugin } from "gsap/ScrollToPlugin";
gsap.registerPlugin(ScrollToPlugin);

// Native input stays native. Eligible desktop gestures settle in their direction.
// A fresh gesture interrupts the tween; touch and overflowing layouts scroll freely.
export function useSectionScroll() {
  useLayoutEffect(() => {
    const sections = [
      ...document.querySelectorAll<HTMLElement>("[data-segment]"),
    ];
    const media = matchMedia(
      "(min-width: 1024px) and (min-height: 600px) and (pointer: fine) and (hover: hover) and (prefers-reduced-motion: no-preference)",
    );
    let enabled = false,
      disposed = false,
      pointerDown = false,
      direction = 0,
      lastY = scrollY;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let resizeFrame = 0;
    let tween: gsap.core.Tween | undefined;
    let focusGesture = false,
      focusDirection = 0,
      lastWheel = 0;
    const cancel = () => {
      clearTimeout(timer);
      tween?.kill();
      tween = undefined;
    };
    const positions = () =>
      sections.flatMap((section) => {
        const count = enabled ? Number(section.dataset.scrollStages ?? 1) : 1;
        return Array.from(
          { length: count },
          (_, i) => section.offsetTop + i * innerHeight,
        );
      });
    const animate = (y: number) => {
      cancel();
      tween = gsap.to(window, {
        scrollTo: {
          y,
          autoKill: true,
          onAutoKill: () => {
            tween = undefined;
          },
        },
        duration: 0.95,
        ease: "power2.inOut",
        onComplete: () => {
          tween = undefined;
          lastY = scrollY;
          direction = 0;
        },
      });
    };
    const settle = () => {
      if (!enabled || pointerDown || document.querySelector("dialog[open]"))
        return;
      const points = positions();
      if (points.some((y) => Math.abs(y - scrollY) < 3)) return;
      const target =
        direction > 0
          ? (points.find((y) => y > scrollY + 3) ?? points.at(-1)!)
          : ([...points].reverse().find((y) => y < scrollY - 3) ?? 0);
      animate(target);
    };
    const scroll = () => {
      if (tween || disposed) return;
      const delta = scrollY - lastY;
      if (Math.abs(delta) > 1) direction = Math.sign(delta);
      lastY = scrollY;
      clearTimeout(timer);
      if (enabled && !pointerDown && direction) timer = setTimeout(settle, 160);
    };
    const interrupt = () => {
      focusGesture = false;
      const wasAnimating = Boolean(tween);
      cancel();
      if (wasAnimating) lastY = scrollY;
    };
    const wheel = (event: WheelEvent) => {
      if (event.ctrlKey || Math.abs(event.deltaY) <= Math.abs(event.deltaX))
        return;
      const nextDirection = Math.sign(event.deltaY);
      const now = performance.now();
      const freshGesture = now - lastWheel > 240;
      lastWheel = now;
      const focus = sections.find((section) => section.dataset.scrollStages);
      const insideFocus =
        focus &&
        scrollY >= focus.offsetTop - 3 &&
        scrollY <= focus.offsetTop + 3 * innerHeight + 3;
      // The four capability chapters advance once per gesture. Consume trackpad
      // momentum through the transition; an opposite gesture reverses immediately.
      if (
        enabled &&
        focus &&
        (insideFocus || (focusGesture && (!freshGesture || tween)))
      ) {
        event.preventDefault();
        if (
          !focusGesture ||
          (freshGesture && !tween) ||
          nextDirection !== focusDirection
        ) {
          const step = (scrollY - focus.offsetTop) / innerHeight;
          const nextStep =
            nextDirection > 0
              ? Math.floor(step + 0.01) + 1
              : Math.ceil(step - 0.01) - 1;
          focusGesture = true;
          focusDirection = nextDirection;
          const previous =
            sections[sections.indexOf(focus) - 1]?.offsetTop ?? 0;
          animate(
            Math.max(
              previous,
              Math.min(
                focus.offsetTop + 4 * innerHeight,
                focus.offsetTop + nextStep * innerHeight,
              ),
            ),
          );
        }
        return;
      }
      interrupt();
      // Passive compositor scrolling can precede the subsequent scroll event.
      direction = nextDirection;
    };
    const down = () => {
      pointerDown = true;
      interrupt();
    };
    const up = () => {
      pointerDown = false;
      if (direction) timer = setTimeout(settle, 180);
    };
    const measureNow = () => {
      if (disposed) return;
      const next =
        media.matches &&
        sections.every((section) => {
          const panel =
            section.querySelector<HTMLElement>("[data-stage-panel]");
          if (!panel) return section.offsetHeight <= innerHeight + 2;
          // Measure the compact composition even when its natural-scroll fallback is shown.
          // The temporary display change is restored synchronously, before a paint.
          const display = panel.style.display;
          panel.style.display = "flex";
          const fits = panel.offsetHeight <= innerHeight + 2;
          panel.style.display = display;
          return fits;
        });
      if (enabled !== next) cancel();
      enabled = next;
      document.documentElement.dataset.snap = enabled ? "on" : "off";
      const position = scrollY;
      ScrollTrigger.refresh();
      window.scrollTo({ top: position, behavior: "instant" });
      ScrollTrigger.update();
      lastY = scrollY;
      direction = 0;
    };
    const measure = () => {
      cancelAnimationFrame(resizeFrame);
      resizeFrame = requestAnimationFrame(measureNow);
    };
    const resolveTarget = (id: string) => {
      const target = document.getElementById(id === "contact" ? "top" : id);
      return !enabled && target?.dataset.flowTarget
        ? document.getElementById(target.dataset.flowTarget)
        : target;
    };
    const resolveHash = () => {
      let id = "";
      try {
        id = decodeURIComponent(location.hash.slice(1));
      } catch {
        return;
      }
      return resolveTarget(id);
    };
    const hash = () => {
      focusGesture = false;
      cancel();
      measureNow();
      resolveHash()?.scrollIntoView({ behavior: "instant", block: "start" });
      lastY = scrollY;
      direction = 0;
    };
    const click = (event: MouseEvent) => {
      const anchor = (event.target as Element).closest<HTMLAnchorElement>(
        'a[href^="#"]',
      );
      if (
        !anchor ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey ||
        event.button !== 0
      )
        return;
      const id = anchor.hash.slice(1);
      const target = resolveTarget(id);
      if (!target) return;
      event.preventDefault();
      history.pushState(null, "", anchor.hash);
      if (matchMedia("(prefers-reduced-motion: reduce)").matches)
        target.scrollIntoView({ behavior: "instant" });
      else animate(target.getBoundingClientRect().top + scrollY);
      if (target.hasAttribute("tabindex"))
        target.focus({ preventScroll: true });
    };
    const observer = new ResizeObserver(measure);
    sections.forEach((section) => {
      observer.observe(section);
      const panel = section.querySelector("[data-stage-panel]");
      if (panel) observer.observe(panel);
    });
    media.addEventListener("change", measure);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", scroll, { passive: true });
    window.addEventListener("wheel", wheel, { passive: false });
    window.addEventListener("touchstart", interrupt, { passive: true });
    window.addEventListener("keydown", interrupt);
    window.addEventListener("pointerdown", down, { passive: true });
    window.addEventListener("pointerup", up, { passive: true });
    window.addEventListener("hashchange", hash);
    document.addEventListener("click", click);
    document.fonts.ready.then(() => {
      if (disposed) return;
      measure();
      requestAnimationFrame(() => {
        if (!disposed && location.hash) hash();
      });
    });
    measureNow();
    return () => {
      disposed = true;
      cancel();
      cancelAnimationFrame(resizeFrame);
      observer.disconnect();
      media.removeEventListener("change", measure);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", scroll);
      window.removeEventListener("wheel", wheel);
      window.removeEventListener("touchstart", interrupt);
      window.removeEventListener("keydown", interrupt);
      window.removeEventListener("pointerdown", down);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("hashchange", hash);
      document.removeEventListener("click", click);
      delete document.documentElement.dataset.snap;
    };
  }, []);
}
