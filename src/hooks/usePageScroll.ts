import { useLayoutEffect } from "react";
import { gsap } from "@/lib/gsap";
import { ScrollToPlugin } from "gsap/ScrollToPlugin";
import { layoutTop } from "@/lib/scrollGeometry";
gsap.registerPlugin(ScrollToPlugin);

/*
  Wheel, trackpad and touch input remain native. useDesktopSettle may finish an idle desktop
  wheel gesture; this hook handles deliberate navigation. It keeps motion measured against the layout and handles links within
  the page. A click glides to its section, a shared link lands once layout has settled,
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

    const resolve = (id: string) => {
      const target = document.getElementById(id === "contact" ? "top" : id);
      // A chapter of What I do shown as a plain list (short screens, reduced motion) has its
      // own visible stand-in, since the held panel's targets are not displayed then.
      if (target && !target.getClientRects().length)
        return (
          document.querySelector<HTMLElement>(
            `[data-chapter="${CSS.escape(id)}"]`,
          ) ?? target
        );
      return target;
    };
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
      else {
        // Layout positions ignore the offsets of reveals still in progress.
        const target = fromHash();
        if (target)
          window.scrollTo({ top: layoutTop(target), behavior: "instant" });
      }
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
      const y = layoutTop(target);
      if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
        stop();
        window.scrollTo({ top: y, behavior: "instant" });
      } else
        // Longer distances take a little longer, without ever feeling slow.
        glide(y, gsap.utils.clamp(0.6, 1.2, Math.abs(y - scrollY) / 2600));
      if (target.hasAttribute("tabindex"))
        target.focus({ preventScroll: true });
    };

    // Layout changes (fonts, viewport, text size) are measured by storyLayout, which refreshes
    // the scroll animations without moving the page. Only a shared link is landed again: late
    // font swaps can still nudge the content a few pixels, so it lands once the layout has
    // settled and shortly after, unless the visitor has started to scroll or interact.
    let moved = false;
    const land = () => {
      if (!disposed && !moved && location.hash) jump();
    };
    const timers: ReturnType<typeof setTimeout>[] = [];
    document.fonts.ready.then(() => {
      if (disposed || !location.hash) return;
      requestAnimationFrame(land);
      timers.push(setTimeout(land, 700), setTimeout(land, 1600));
    });
    const interact = () => {
      moved = true;
      stop();
    };
    window.addEventListener("wheel", interact, { passive: true });
    window.addEventListener("keydown", interact);
    window.addEventListener("touchstart", interact, { passive: true });
    window.addEventListener("pointerdown", interact, { passive: true });
    window.addEventListener("hashchange", jump);
    window.addEventListener("popstate", jump);
    document.addEventListener("click", click);
    return () => {
      disposed = true;
      stop();
      timers.forEach(clearTimeout);
      window.removeEventListener("wheel", interact);
      window.removeEventListener("keydown", interact);
      window.removeEventListener("touchstart", interact);
      window.removeEventListener("pointerdown", interact);
      window.removeEventListener("hashchange", jump);
      window.removeEventListener("popstate", jump);
      document.removeEventListener("click", click);
    };
  }, []);
}
