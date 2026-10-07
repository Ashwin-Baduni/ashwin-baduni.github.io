import { useLayoutEffect } from "react";
import { gsap, ScrollTrigger } from "@/lib/gsap";
import { ScrollToPlugin } from "gsap/ScrollToPlugin";
gsap.registerPlugin(ScrollToPlugin);

/*
  Keep scroll-linked motion measured against the layout and handle links within
  the page. Gesture handling and section gravity live in useScrollGravity.
  A click glides to its section, a shared link lands once layout has settled,
  and Back returns to the previous section.
*/
export function usePageScroll() {
  useLayoutEffect(() => {
    let tween: gsap.core.Tween | undefined;
    let disposed = false;
    const settled = () => {
      tween = undefined;
    };
    const stop = () => {
      tween?.kill();
      settled();
    };
    const glide = (y: number, duration: number) => {
      tween?.kill();
      tween = gsap.to(window, {
        scrollTo: { y, autoKill: true, onAutoKill: settled },
        duration,
        ease: "power2.inOut",
        onComplete: settled,
      });
    };

    const resolve = (id: string) =>
      document.getElementById(id === "contact" ? "top" : id);
    const fromHash = () => {
      try {
        return resolve(decodeURIComponent(location.hash.slice(1)));
      } catch {
        return null;
      }
    };
    const jump = () => {
      stop();
      if (!location.hash) window.scrollTo({ top: 0, behavior: "instant" });
      else fromHash()?.scrollIntoView({ behavior: "instant", block: "start" });
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
      const target = resolve(anchor.hash.slice(1));
      if (!target) return;
      event.preventDefault();
      history.pushState(null, "", anchor.hash);
      const y = Math.round(target.getBoundingClientRect().top + scrollY);
      if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
        stop();
        window.scrollTo({ top: y, behavior: "instant" });
      } else
        // Longer distances take a little longer, without ever feeling slow.
        glide(y, gsap.utils.clamp(0.6, 1.2, Math.abs(y - scrollY) / 2600));
      if (target.hasAttribute("tabindex"))
        target.focus({ preventScroll: true });
    };

    // Scroll positions are measured from the layout, so measure again once the web fonts are
    // in and whenever the page changes height, such as when a lazy image arrives.
    let height = document.documentElement.scrollHeight;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const remeasure = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const next = document.documentElement.scrollHeight;
        if (next === height) return;
        height = next;
        const y = scrollY;
        ScrollTrigger.refresh();
        window.scrollTo({ top: y, behavior: "instant" });
      }, 200);
    };
    const observer = new ResizeObserver(remeasure);
    observer.observe(document.body);
    window.addEventListener("resize", remeasure);
    document.fonts.ready.then(() => {
      if (disposed) return;
      height = document.documentElement.scrollHeight;
      ScrollTrigger.refresh();
      if (location.hash) requestAnimationFrame(() => !disposed && jump());
    });
    window.addEventListener("wheel", stop, { passive: true });
    window.addEventListener("keydown", stop);
    window.addEventListener("touchstart", stop, { passive: true });
    window.addEventListener("hashchange", jump);
    window.addEventListener("popstate", jump);
    document.addEventListener("click", click);
    return () => {
      disposed = true;
      stop();
      clearTimeout(timer);
      observer.disconnect();
      window.removeEventListener("resize", remeasure);
      window.removeEventListener("wheel", stop);
      window.removeEventListener("keydown", stop);
      window.removeEventListener("touchstart", stop);
      window.removeEventListener("hashchange", jump);
      window.removeEventListener("popstate", jump);
      document.removeEventListener("click", click);
    };
  }, []);
}
