import { test, expect, open, stories, scrollToY, frames } from "./helpers";

/* Reduced motion: every story is a readable list, finished, with nothing moving. */
async function finishedAndStill(page: import("@playwright/test").Page) {
  return page.evaluate(() => {
    const opacity = (element: Element) => {
      let value = 1;
      for (let node: Element | null = element; node; node = node.parentElement) value *= Number(getComputedStyle(node).opacity);
      return value;
    };
    return {
      faintWords: [...document.querySelectorAll(".word")].filter((word) => opacity(word) < 0.99).length,
      moved: [...document.querySelectorAll(".stack-card, [data-story-intro], .stack-lane")]
        .filter((element) => getComputedStyle(element).transform !== "none").length,
      unfinished: [...document.querySelectorAll(".mseq-record, .mseq-answer, .call-connected, .transcript-saved, .scene-caption")]
        .filter((element) => opacity(element) < 0.99).length,
      wording: [...document.querySelectorAll<HTMLElement>("[data-rest-text]")].every((element) => element.textContent === element.dataset.restText),
      handoffs: document.querySelectorAll('[data-handoff="on"]').length,
    };
  });
}

test("reduced motion shows every story as a finished, still list", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await open(page);
  expect((await stories(page)).filter((s) => s.on), "no held stories").toEqual([]);
  expect(await finishedAndStill(page)).toEqual({ faintWords: 0, moved: 0, unfinished: 0, wording: true, handoffs: 0 });
});

test("chapter links land on their card in the plain list", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await open(page, "/#focus-agents");
  await page.waitForTimeout(1800);
  const top = await page.evaluate(() => document.querySelector('[data-chapter="focus-agents"]')!.getBoundingClientRect().top);
  expect(Math.abs(top)).toBeLessThanOrEqual(2);
});

test("switching reduced motion on and off mid-story settles cleanly", async ({ page }) => {
  await open(page);
  const kehsun = await page.evaluate(() => document.getElementById("kehsun")!.offsetTop);
  await scrollToY(page, kehsun + 700);
  const held = (await stories(page)).map((s) => s.on);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await frames(page, 3);
  await page.waitForTimeout(400);
  expect((await stories(page)).filter((s) => s.on)).toEqual([]);
  expect(await finishedAndStill(page)).toEqual({ faintWords: 0, moved: 0, unfinished: 0, wording: true, handoffs: 0 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await frames(page, 3);
  await page.waitForTimeout(400);
  expect((await stories(page)).map((s) => s.on), "held layouts return").toEqual(held);
});
