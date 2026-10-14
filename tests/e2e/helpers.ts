import { test as base, expect, type Page } from "@playwright/test";
import type { Item, Sample } from "./analysis";
export { CLEARANCE, clearanceFailures, plateaus, series, transformFailures, type Item, type Sample } from "./analysis";

/*
  Shared fixtures for the browser checks. Every test fails on page errors, console errors or
  warnings, and uncaught errors reported to window (a ResizeObserver loop, for example).
  A spy records every programmatic scroll that would move the page, so tests can prove that
  toolbar-sized and text-size changes never scroll by themselves. (After a width change the page
  deliberately returns to the reading position; responsive.spec.ts tests that separately.)
*/
type Scroll = { name: string; from: number; to: number };
declare global {
  interface Window {
    __errors: string[];
    __scrolls: Scroll[];
  }
}

export const test = base.extend<{ errors: string[] }>({
  errors: [
    async ({ page }, use) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
      page.on("console", (message) => {
        // Firefox's heuristic scroll-linked-effect notice, reported once per document. It is set off
        // by the hero's decorative recede and the About parallax, which are scrubbed by design
        // (as before this audit). Held story elements are verified separately in frames.spec.ts.
        if (message.text().includes("This site appears to use a scroll-linked positioning effect")) return;
        if (message.type() === "error" || message.type() === "warning") errors.push(`${message.type()}: ${message.text()}`);
      });
      await page.addInitScript(() => {
        window.__errors = [];
        window.__scrolls = [];
        addEventListener("error", (event) => window.__errors.push(String(event.message)));
        addEventListener("unhandledrejection", (event) => window.__errors.push(String(event.reason)));
        // Only the net effect of a task counts: ScrollTrigger measures by scrolling to the top and
        // straight back within one task, which never shows. A smooth scroll is judged by its target.
        let pending: { name: string; from: number; to?: number } | null = null;
        const wrap = (owner: object, name: string, target: (args: unknown[]) => number | undefined) => {
          const original = (owner as Record<string, (...args: unknown[]) => unknown>)[name];
          (owner as Record<string, unknown>)[name] = function (this: unknown, ...args: unknown[]) {
            if (!pending) {
              const check: { name: string; from: number; to?: number } = { name, from: scrollY };
              pending = check;
              queueMicrotask(() => {
                pending = null;
                const to = check.to ?? scrollY;
                if (Math.abs(to - check.from) > 1) window.__scrolls.push({ name: check.name, from: check.from, to });
              });
            }
            const result = original.apply(this, args);
            const to = target(args);
            pending!.to = to;
            return result;
          };
        };
        const top = (args: unknown[]) =>
          typeof args[0] === "object" && args[0] !== null
            ? (args[0] as ScrollToOptions).top
            : (args[1] as number | undefined);
        wrap(window, "scrollTo", top);
        wrap(window, "scroll", top);
        wrap(window, "scrollBy", () => undefined);
        wrap(Element.prototype, "scrollIntoView", () => undefined);
      });
      await use(errors);
      const reported = (await page.evaluate(() => window.__errors).catch(() => undefined)) ?? [];
      expect([...errors, ...reported], "no page errors, console errors or warnings").toEqual([]);
    },
    { auto: true },
  ],
});
export { expect };

// Loads the page and waits for fonts and the first layout pass.
export async function open(page: Page, path = "/") {
  await page.goto(path, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await frames(page, 3);
  await page.waitForTimeout(300);
}

export const frames = (page: Page, count = 1) =>
  page.evaluate((count) => new Promise<void>((resolve) => {
    let left = count;
    const tick = () => (--left <= 0 ? resolve() : requestAnimationFrame(tick));
    requestAnimationFrame(tick);
  }), count);

// Programmatic scrolls recorded since the last call, then cleared.
export async function takeScrolls(page: Page) {
  return page.evaluate(() => window.__scrolls.splice(0));
}

export async function scrollToY(page: Page, y: number, settle = 400) {
  await page.evaluate((y) => window.scrollTo({ top: y, behavior: "instant" }), y);
  await frames(page, 2);
  if (settle) await page.waitForTimeout(settle);
  await takeScrolls(page);
}

export type Story = { section: string; on: boolean; cards: number; row: boolean; sharedFrame: boolean };

// Every story in the page, whether it is in its held layout, and whether its cards are shown side
// by side as a row (MihawkAI on a wide screen) rather than stacked.
export function stories(page: Page): Promise<Story[]> {
  return page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>(".stack")].map((root) => ({
      section: root.closest("[data-segment]")!.id,
      on: root.dataset.stack === "on",
      cards: root.querySelectorAll(".stack-card").length,
      row: root.dataset.arrangement === "row",
      sharedFrame: root.dataset.arrangement === "split",
    })),
  );
}

/*
  Scrolls through [from, to] in steps, waiting `wait` animation frames after each, and records
  the rendered rectangle, transform and effective opacity of every card, every introduction and
  its first line of text, and the plain content blocks between stories. Rectangles come from
  the DOM, independent of any planned geometry.
*/
export function sweep(page: Page, from: number, to: number, step: number, wait = 1): Promise<Sample[]> {
  return page.evaluate(async ({ from, to, step, wait }) => {
    const groups: Array<[Item["kind"], string]> = [
      ["card", ".stack-card"],
      ["intro", "[data-story-intro]"],
      ["content", ".experience-row, .certification-list li, .about-copy p, .back-to-top-wrap"],
    ];
    const elements = groups.flatMap(([kind, selector]) => {
      const list = [...document.querySelectorAll<HTMLElement>(selector)];
      return list.map((element) => ({ kind, element, section: element.closest("[data-segment]")!.id }));
    });
    // The first line of each introduction: its label or its title.
    document.querySelectorAll<HTMLElement>("[data-story-intro]").forEach((intro) => {
      const text = intro.matches("h2") ? intro : intro.querySelector<HTMLElement>("h2, p")!;
      elements.push({ kind: "text", element: text, section: intro.closest("[data-segment]")!.id });
    });
    const indexOf = new Map<string, number>();
    const keyed = elements.map((entry) => {
      const key = `${entry.section}/${entry.kind}`;
      const index = indexOf.get(key) ?? 0;
      indexOf.set(key, index + 1);
      return { ...entry, index };
    });
    const opacity = (element: Element) => {
      let value = 1;
      for (let node: Element | null = element; node; node = node.parentElement) {
        const style = getComputedStyle(node);
        if (style.visibility === "hidden" && node === element) return 0;
        value *= Number(style.opacity);
      }
      return value;
    };
    const translate = (element: Element) => {
      const transform = getComputedStyle(element).transform;
      return transform === "none" ? 0 : new DOMMatrixReadOnly(transform).m42;
    };
    const next = () => new Promise<void>((resolve) => {
      let left = wait;
      const tick = () => (--left <= 0 ? resolve() : requestAnimationFrame(tick));
      requestAnimationFrame(tick);
    });
    const samples: Sample[] = [];
    const direction = to >= from ? 1 : -1;
    for (let y = from; direction > 0 ? y <= to : y >= to; y += direction * step) {
      window.scrollTo({ top: y, behavior: "instant" });
      if (wait) await next();
      samples.push({
        y: scrollY,
        items: keyed.map(({ kind, element, section, index }) => {
          const rect = element.getBoundingClientRect();
          return { section, kind, index, top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right, ty: translate(element), opacity: opacity(element) };
        }),
      });
    }
    return samples;
  }, { from, to, step, wait }) as Promise<Sample[]>;
}

export const maxScroll = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollHeight - innerHeight);

export const sectionTop = (page: Page, id: string) =>
  page.evaluate((id) => {
    let top = 0;
    for (let node = document.getElementById(id) as HTMLElement | null; node; node = node.offsetParent as HTMLElement | null) top += node.offsetTop;
    return top;
  }, id);

// Sections in document order, so each introduction is checked against the section before it.
export const documentOrder = (page: Page) =>
  page.evaluate(() => [...document.querySelectorAll<HTMLElement>("[data-segment]")].map((section) => section.id));
