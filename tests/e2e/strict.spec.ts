import type { Page } from "@playwright/test";
import { test, expect, open, sweep, maxScroll, frames, clearanceFailures, documentOrder, transformFailures } from "./helpers";

/*
  Development build under React StrictMode (see playwright.config.ts): every effect has already
  run, been cleaned up and run again. Nothing may be left twice: one measuring probe, the same
  number of scroll animations after resizes and motion-setting changes, and the same behaviour.
*/
const triggers = (page: Page) =>
  page.evaluate(async () => {
    // The dev server's own module instance, the one the page is using.
    const path = "/src/lib/gsap.ts";
    const { ScrollTrigger } = (await import(/* @vite-ignore */ path)) as { ScrollTrigger: { getAll(): unknown[] } };
    return ScrollTrigger.getAll().length;
  });
const probes = (page: Page) => page.evaluate(() => document.querySelectorAll('body > div[aria-hidden="true"]').length);
const storyTriggers = (page: Page) =>
  page.evaluate(async () => {
    const path = "/src/lib/gsap.ts";
    const { ScrollTrigger } = (await import(/* @vite-ignore */ path)) as {
      ScrollTrigger: { getAll(): Array<{ trigger?: Element }> };
    };
    // Scope the ownership check to MihawkAI. Other sections also change presentation at this
    // width; their added/removed triggers can cancel out in the whole-page total.
    return ScrollTrigger.getAll().filter((trigger) => trigger.trigger?.closest("#building")).length;
  });

test("StrictMode cleanup leaves no duplicate probes, observers or animations", async ({ page }) => {
  // The dev server may optimise dependencies and reload the page on its first visit.
  await page.goto("/", { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  await open(page);
  await page.waitForTimeout(800);
  const initial = await triggers(page);
  expect(initial).toBeGreaterThan(10);
  expect(await probes(page)).toBe(1);
  for (let cycle = 0; cycle < 3; cycle++)
    for (const [width, height] of [[393, 659], [844, 390], [412, 812]]) {
      await page.setViewportSize({ width, height });
      await frames(page, 3);
      await page.waitForTimeout(250);
    }
  await page.emulateMedia({ reducedMotion: "reduce" });
  await frames(page, 3);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await frames(page, 3);
  await page.waitForTimeout(400);
  expect(await triggers(page), "same number of scroll animations").toBe(initial);
  expect(await probes(page), "one measuring probe").toBe(1);
  const samples = await sweep(page, 0, await maxScroll(page), 24, 1);
  expect(transformFailures(samples, 812)).toEqual([]);
  expect(clearanceFailures(samples, 812, await documentOrder(page)).slice(0, 8)).toEqual([]);
});

/*
  Replaying the project loops must not retain earlier runs. Each loop's animations belong to a
  GSAP context; its recorded size must stay the same however often the loop leaves the screen
  and is rebuilt. This reads GSAP internals (`_ctx`, `data`) of the pinned version, because no
  public API lists contexts.
*/
test("project loops keep a bounded set of animations across replays", async ({ page }) => {
  await page.goto("/", { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  await open(page);
  await page.waitForTimeout(1000);
  const retained = () =>
    page.evaluate(async () => {
      const path = "/src/lib/gsap.ts";
      const { gsap } = (await import(/* @vite-ignore */ path)) as { gsap: { globalTimeline: { getChildren(a: boolean, b: boolean, c: boolean): Array<{ _ctx?: { data: unknown[]; getTweens(): Array<{ targets(): Element[] }> } }> } } };
      const contexts = [...new Set(gsap.globalTimeline.getChildren(true, true, true).map((t) => t._ctx).filter((c) => !!c))];
      return contexts
        .map((c) => ({ size: c!.data.length, target: c!.getTweens().flatMap((t) => t.targets()).find((t) => t?.nodeType === 1)?.classList[0] ?? "" }))
        .filter((c) => c.target === "chart-bar" || c.target === "captcha-letter")
        .toSorted((a, b) => a.target.localeCompare(b.target));
    });
  const before = await retained();
  expect(before.map((c) => c.target), "both project loops are found").toEqual(["captcha-letter", "chart-bar"]);
  for (let i = 0; i < 8; i++) {
    await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" }));
    await page.waitForTimeout(150);
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await page.waitForTimeout(150);
  }
  expect(await retained(), "retained animations after eight replays").toEqual(before);
});

/*
  MihawkAI switching between its row and its stack, here with StrictMode's extra mount and cleanup.
  Each arrangement has its own controller, so the two may need different numbers of scroll
  animations; after any number of switches the count must equal a fresh load's in the same
  conditions, which shows that every replaced controller was removed completely.
*/
test.describe("on a wide screen", () => {
  test.use({ viewport: { width: 1280, height: 800 }, isMobile: false, hasTouch: false });

  test("switching MihawkAI between the row and the stack never accumulates controllers", async ({ page }) => {
    const css = (text?: number, parent?: number) =>
      [text ? `html { font-size: ${text}% }` : "", parent ? `#building .wrap { max-width: ${parent}px }` : ""].join("\n");
    const conditions = [
      { width: 1280, text: undefined, parent: undefined, row: true },
      { width: 900, text: undefined, parent: undefined, row: false },
      { width: 1280, text: 125, parent: undefined, row: false },
      { width: 1280, text: undefined, parent: 800, row: false },
    ];
    // Counts after a fresh load in each condition.
    const expected: number[] = [];
    const expectedStory: number[] = [];
    for (const c of conditions) {
      const other = await page.context().newPage();
      await other.setViewportSize({ width: c.width, height: 800 });
      await other.addInitScript((css) => {
        document.addEventListener("DOMContentLoaded", () => {
          const style = document.createElement("style");
          style.textContent = css;
          document.head.append(style);
        });
      }, css(c.text, c.parent));
      await other.goto("/", { waitUntil: "networkidle" });
      await other.waitForTimeout(1500);
      await open(other);
      await other.waitForTimeout(600);
      expect(await other.evaluate(() => document.querySelector<HTMLElement>("#building .stack")!.dataset.arrangement === "row"), JSON.stringify(c)).toBe(c.row);
      expected.push(await triggers(other));
      expectedStory.push(await storyTriggers(other));
      await other.close();
    }
    expect(expectedStory[0], "MihawkAI's row and stack have distinct controller counts").not.toBe(expectedStory[1]);
    await page.goto("/", { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);
    await open(page);
    await page.evaluate(() => {
      const style = document.createElement("style");
      style.id = "e2e-conditions";
      document.head.append(style);
    });
    for (let cycle = 0; cycle < 3; cycle++)
      for (const [i, c] of [...conditions.entries(), [0, conditions[0]] as const]) {
        await page.setViewportSize({ width: c.width, height: 800 });
        await page.evaluate((css) => (document.getElementById("e2e-conditions")!.textContent = css), css(c.text, c.parent));
        await frames(page, 3);
        await page.waitForTimeout(500);
        expect(await page.evaluate(() => document.querySelector<HTMLElement>("#building .stack")!.dataset.arrangement === "row"), `cycle ${cycle}: ${JSON.stringify(c)}`).toBe(c.row);
        expect(await triggers(page), `cycle ${cycle}: scroll animations in ${JSON.stringify(c)}`).toBe(expected[i]);
        expect(await storyTriggers(page), `cycle ${cycle}: MihawkAI controllers in ${JSON.stringify(c)}`).toBe(expectedStory[i]);
        expect(await probes(page), "one measuring probe").toBe(1);
      }
  });
});
