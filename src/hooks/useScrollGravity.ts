import { useLayoutEffect } from "react";
import { layoutTop } from "@/lib/scrollGeometry";

/*
  Catch each section entrance and each completed capability chapter. There is no
  browser snap competing with this motion. Wheel momentum is consumed once caught.
  Touch follows the finger, then uses the same spring on release. A fresh touch
  or reverse wheel gesture interrupts; long sections remain scrollable inside.
*/
type Stop = { element: HTMLElement; direction: number };

export function useScrollGravity() {
  useLayoutEffect(() => {
    const html = document.documentElement;
    const anchors = [
      ...document.querySelectorAll<HTMLElement>(
        "[data-segment], .focus-stop, [data-gravity-reading]",
      ),
    ];
    const media = matchMedia("(prefers-reduced-motion: no-preference)");
    let enabled = false;
    let frame = 0;
    let guard: Stop | undefined;
    let lastWheel = 0;
    let lastDelta = 0;
    let bypass: HTMLElement | undefined;
    let settledAt = 0;
    let tail = 0;
    const main = document.getElementById("main")!;
    const lastSection = anchors
      .filter((el) => el.hasAttribute("data-segment"))
      .at(-1)!;
    let touch:
      | {
          id: number;
          x: number;
          y: number;
          lastY: number;
          time: number;
          velocity: number;
          dragged: boolean;
          direction: number;
          reversal: number;
          caught: Stop | undefined;
          bypass: HTMLElement | undefined;
        }
      | undefined;

    const position = (element: HTMLElement) => {
      let top = layoutTop(element);
      if (element.hasAttribute("data-gravity-reading")) {
        const section = element.closest<HTMLElement>("[data-segment]")!;
        top = Math.max(
          layoutTop(section),
          Math.min(
            top - 56,
            layoutTop(section) + section.offsetHeight - innerHeight,
          ),
        );
      }
      return Math.max(0, Math.min(html.scrollHeight - innerHeight, top));
    };
    const stops = () =>
      anchors
        .filter((element) => {
          if (!element.hasAttribute("data-gravity-reading")) return true;
          const section = element.closest<HTMLElement>("[data-segment]")!;
          return (
            section.offsetHeight > innerHeight + 80 &&
            position(element) - layoutTop(section) > 80
          );
        })
        .sort((a, b) => position(a) - position(b))
        .filter(
          (element, index, list) =>
            !index || position(element) - position(list[index - 1]) > 40,
        );
    const resting = () =>
      stops().find((element) => Math.abs(position(element) - scrollY) < 12);
    const radius = () => Math.min(560, innerHeight * 0.58);
    const overshoot = (element: HTMLElement) =>
      element.classList.contains("focus-stop")
        ? Math.min(32, innerHeight * 0.038)
        : Math.min(72, innerHeight * 0.07);
    const write = (y: number) => {
      window.scrollTo({ top: y, behavior: "instant" });
    };
    const stop = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      guard = undefined;
    };
    const excluded = (element: EventTarget | null) =>
      document.querySelector("dialog[open]") ||
      (element instanceof Element &&
        element.closest(
          "input, textarea, select, [contenteditable=true], [data-native-scroll]",
        ));
    const approaching = (
      from: number,
      to: number,
      direction: number,
      skip?: HTMLElement,
    ): Stop | undefined => {
      if (!direction) return;
      let nearest: HTMLElement | undefined;
      let distance = Infinity;
      const available = stops();
      for (const element of available) {
        if (element === skip) continue;
        const ahead = (position(element) - from) * direction;
        if (ahead > 3 && ahead < distance) {
          nearest = element;
          distance = ahead;
        }
      }
      if (nearest) {
        const index = available.indexOf(nearest);
        const previous = available[index - direction];
        const gap = previous
          ? Math.abs(position(nearest) - position(previous))
          : innerHeight;
        const capture = Math.min(radius(), gap * 0.62);
        if ((position(nearest) - to) * direction < capture)
          return { element: nearest, direction };
      }
      // The last fitting section gets room for its overshoot, but that room is
      // never a separate destination or a blank area to scroll into.
      if (
        !nearest &&
        tail &&
        direction > 0 &&
        from >= position(lastSection) - 3
      )
        return { element: lastSection, direction };
    };

    // A continuous pull into one bounded overshoot, followed by a slower return.
    // Duration and amplitude stay legible even when the catch starts very close.
    // Hermite interpolation preserves some incoming velocity and reaches the
    // turning point at zero velocity; both phases use elapsed time, not frames.
    const spring = (caught: Stop, velocity: number) => {
      stop();
      guard = caught;
      settledAt = Infinity;
      const { element, direction } = caught;
      const started = performance.now();
      const offset = scrollY - position(element);
      const amplitude = overshoot(element);
      const peak = direction * Math.max(amplitude, offset * direction);
      const distance = Math.abs(peak - offset);
      const approachTime = 0.88 + Math.min(0.18, distance / 5000);
      const returnTime = 0.84;
      const alreadyPast = offset * direction >= amplitude;
      const approach = alreadyPast ? 0 : approachTime;
      const tangent =
        direction *
        Math.min(Math.abs(velocity) * approachTime * 0.45, distance * 1.2);
      const smooth = (t: number) => t * t * (3 - 2 * t);
      const tick = (now: number) => {
        const t = (now - started) / 1000;
        if (t >= approach + returnTime) {
          write(position(element));
          frame = 0;
          settledAt = now;
          return;
        }
        let displacement: number;
        if (t < approach) {
          const u = t / approach;
          displacement =
            offset * (1 - smooth(u)) +
            peak * smooth(u) +
            tangent * u * (1 - u) ** 2;
        } else {
          displacement = peak * (1 - smooth((t - approach) / returnTime));
        }
        write(position(element) + displacement);
        frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    };

    const coast = (initialVelocity: number, skip?: HTMLElement) => {
      stop();
      let velocity = Math.max(-4500, Math.min(4500, initialVelocity));
      let position = scrollY;
      let previous = performance.now();
      const tick = (now: number) => {
        const dt = Math.min(0.05, (now - previous) / 1000);
        previous = now;
        const attenuation = Math.exp(-4.5 * dt);
        const next = position + (velocity * (1 - attenuation)) / 4.5;
        const direction = Math.sign(velocity);
        const caught = approaching(position, next, direction, skip);
        if (caught) {
          spring(caught, velocity);
          return;
        }
        write(next);
        position = next;
        velocity *= attenuation;
        if (Math.abs(velocity) < 12 || Math.abs(scrollY - next) > 2) {
          frame = 0;
        } else frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    };

    const wheel = (event: WheelEvent) => {
      if (
        !enabled ||
        event.ctrlKey ||
        event.metaKey ||
        excluded(event.target) ||
        Math.abs(event.deltaX) >= Math.abs(event.deltaY)
      )
        return;
      const delta =
        event.deltaY *
        (event.deltaMode === 1 ? 18 : event.deltaMode === 2 ? innerHeight : 1);
      const direction = Math.sign(delta);
      const now = performance.now();
      const gap = now - lastWheel;
      const fresh = gap > 300 && !frame && now - settledAt > 160;
      const reverse =
        lastDelta && Math.sign(lastDelta) !== direction && Math.abs(delta) >= 6;
      lastWheel = now;
      lastDelta = delta;
      if (guard && !fresh && !reverse) {
        event.preventDefault();
        return;
      }
      if (guard) {
        bypass = guard.element;
        stop();
      } else if (fresh || reverse) bypass = resting();
      const caught = approaching(scrollY, scrollY + delta, direction, bypass);
      if (caught) {
        event.preventDefault();
        spring(
          caught,
          Math.abs(delta) / Math.max(0.016, Math.min(gap / 1000, 0.08)),
        );
      }
    };

    const touchStart = (event: TouchEvent) => {
      stop();
      touch = undefined;
      if (
        !enabled ||
        event.touches.length !== 1 ||
        excluded(event.target) ||
        !(event.target instanceof Element) ||
        !event.target.closest("[data-segment]")
      )
        return;
      const point = event.touches[0];
      touch = {
        id: point.identifier,
        x: point.clientX,
        y: point.clientY,
        lastY: point.clientY,
        time: performance.now(),
        velocity: 0,
        dragged: false,
        direction: 0,
        reversal: 0,
        caught: undefined,
        bypass: resting(),
      };
    };
    const touchMove = (event: TouchEvent) => {
      if (!touch) return;
      if (event.touches.length !== 1) {
        touch = undefined;
        return;
      }
      const point = Array.from(event.touches).find(
        (point) => point.identifier === touch!.id,
      );
      if (!point) return;
      if (!touch.dragged) {
        const x = Math.abs(point.clientX - touch.x);
        const y = Math.abs(point.clientY - touch.y);
        if (Math.max(x, y) < 6) return;
        if (x > y) {
          touch = undefined;
          return;
        }
        touch.dragged = true;
      }
      if (event.cancelable) event.preventDefault();
      const now = performance.now();
      const delta = touch.lastY - point.clientY;
      const direction = Math.sign(delta);
      if (direction && touch.direction && direction !== touch.direction) {
        touch.reversal += Math.abs(delta);
        // A small finger wobble must not discard an already caught entrance.
        if (touch.reversal >= 18) {
          touch.bypass = touch.caught?.element ?? resting();
          touch.caught = undefined;
          touch.direction = direction;
          touch.reversal = 0;
        }
      } else {
        touch.reversal = 0;
        if (direction) touch.direction = direction;
      }
      if (!touch.caught) {
        touch.caught = approaching(
          scrollY,
          scrollY + delta,
          direction,
          touch.bypass,
        );
      }
      let travel = delta;
      if (touch.caught) {
        const { element, direction: arrival } = touch.caught;
        const remaining = (position(element) - scrollY) * arrival;
        const allowance = overshoot(element);
        // Increasing resistance close to the heading, with bounded overshoot.
        const resistance = Math.max(
          0.12,
          Math.min(1, (remaining + allowance) / (radius() + allowance)),
        );
        travel *= resistance;
        const limit = position(element) + arrival * allowance;
        travel =
          arrival > 0
            ? Math.min(travel, limit - scrollY)
            : Math.max(travel, limit - scrollY);
      }
      write(scrollY + travel);
      const sample = travel / Math.max(0.008, (now - touch.time) / 1000);
      touch.velocity = touch.velocity * 0.35 + sample * 0.65;
      touch.lastY = point.clientY;
      touch.time = now;
    };
    const touchEnd = () => {
      if (!touch) return;
      const ended = touch;
      touch = undefined;
      if (!ended.dragged) return;
      const velocity =
        performance.now() - ended.time > 100 ? 0 : ended.velocity;
      if (ended.caught) spring(ended.caught, velocity);
      else if (Math.abs(velocity) > 30) coast(velocity, ended.bypass);
    };
    const interrupt = () => {
      stop();
      touch = undefined;
    };
    const pointer = (event: PointerEvent) => {
      if (event.pointerType !== "touch") interrupt();
    };
    const click = (event: MouseEvent) => {
      if ((event.target as Element).closest("a, button")) interrupt();
    };
    const measureTail = () => {
      tail = enabled && lastSection.offsetHeight <= innerHeight + 2 ? 96 : 0;
      main.style.setProperty("--gravity-tail", `${tail}px`);
    };
    const update = () => {
      enabled =
        media.matches &&
        (window.visualViewport?.scale ?? 1) === 1 &&
        !document.querySelector("dialog[open]");
      if (enabled) html.dataset.gravity = "on";
      else {
        interrupt();
        delete html.dataset.gravity;
      }
      measureTail();
    };
    let width = innerWidth;
    const resize = () => {
      // Phone browser bars change the height during a gesture. Only an actual
      // width/layout change should cancel it; the spring reads its live target.
      if (width !== innerWidth) {
        width = innerWidth;
        interrupt();
      }
    };
    update();
    const layout = new ResizeObserver(measureTail);
    layout.observe(lastSection);
    // CV/dialog content keeps native touch scrolling, including its iframe.
    const dialogs = new MutationObserver(update);
    dialogs.observe(document.body, {
      attributes: true,
      subtree: true,
      attributeFilter: ["open"],
    });
    media.addEventListener("change", update);
    window.visualViewport?.addEventListener("resize", update);
    window.addEventListener("wheel", wheel, { passive: false });
    window.addEventListener("touchstart", touchStart, { passive: true });
    window.addEventListener("touchmove", touchMove, { passive: false });
    window.addEventListener("touchend", touchEnd, { passive: true });
    window.addEventListener("touchcancel", interrupt, { passive: true });
    window.addEventListener("pointerdown", pointer, { passive: true });
    window.addEventListener("keydown", interrupt);
    window.addEventListener("hashchange", interrupt);
    window.addEventListener("popstate", interrupt);
    window.addEventListener("resize", resize);
    document.addEventListener("click", click, true);
    document.addEventListener("visibilitychange", interrupt);
    return () => {
      interrupt();
      dialogs.disconnect();
      layout.disconnect();
      main.style.removeProperty("--gravity-tail");
      delete html.dataset.gravity;
      media.removeEventListener("change", update);
      window.visualViewport?.removeEventListener("resize", update);
      window.removeEventListener("wheel", wheel);
      window.removeEventListener("touchstart", touchStart);
      window.removeEventListener("touchmove", touchMove);
      window.removeEventListener("touchend", touchEnd);
      window.removeEventListener("touchcancel", interrupt);
      window.removeEventListener("pointerdown", pointer);
      window.removeEventListener("keydown", interrupt);
      window.removeEventListener("hashchange", interrupt);
      window.removeEventListener("popstate", interrupt);
      window.removeEventListener("resize", resize);
      document.removeEventListener("click", click, true);
      document.removeEventListener("visibilitychange", interrupt);
    };
  }, []);
}
