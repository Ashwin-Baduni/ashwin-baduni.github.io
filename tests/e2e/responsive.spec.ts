import type { Page } from "@playwright/test";
import { test, expect, open, sweep, stories, maxScroll, scrollToY, takeScrolls, frames, series, plateaus, clearanceFailures, documentOrder, transformFailures } from "./helpers";

/*
  Sizes, live resizing and the plain fallback. Toolbar-sized and text-size changes re-plan the
  stories without scrolling the page. A width change (rotation) is the one deliberate exception:
  the page returns to the card being read, unless the visitor has moved on.
*/
const SIZES = ["320x568", "360x640", "375x548", "375x667", "390x844", "393x659", "412x812", "412x892", "412x915", "430x932", "844x390", "768x1024", "1280x800", "1440x900"];
// Firefox and WebKit run a representative set: short portrait in the plain fallback, short
// portrait with mixed held and plain stories, tall portrait, and landscape.
const CROSS = ["375x548", "393x659", "430x932", "844x390"];

async function layoutReport(page: Page) {
  return page.evaluate(() => ({
    overflowX: document.documentElement.scrollWidth > innerWidth + 1,
    stories: [...document.querySelectorAll<HTMLElement>(".stack")].map((root) => {
      const on = root.dataset.stack === "on";
      const cards = [...root.querySelectorAll<HTMLElement>(".stack-card")];
      const rects = cards.map((card) => card.getBoundingClientRect());
      return {
        section: root.closest("[data-segment]")!.id,
        on,
        grid: root.dataset.arrangement === "grid",
        reason: root.dataset.storyFit ?? "",
        // Every card shows its whole content, held or not.
        clipped: cards.filter((card) => card.scrollHeight > card.clientHeight + 1).length,
        // In the plain layout, cards follow one another, or sit side by side, without overlapping.
        overlapping: on ? 0 : rects.filter((rect, i) => i > 0 && rect.top < rects[i - 1].bottom - 0.5 && rect.left < rects[i - 1].right - 0.5 && rect.right > rects[i - 1].left + 0.5).length,
      };
    }),
    probes: document.querySelectorAll('body > div[aria-hidden="true"]').length,
  }));
}

for (const size of SIZES)
  test(`layout at ${size}`, async ({ page, browserName }) => {
    test.skip(browserName !== "chromium" && !CROSS.includes(size), "Firefox and WebKit run the representative sizes");
    const [width, height] = size.split("x").map(Number);
    await page.setViewportSize({ width, height });
    await open(page);
    const report = await layoutReport(page);
    expect(report.overflowX, "no sideways scrolling").toBe(false);
    expect(report.probes, "one measuring probe").toBe(1);
    for (const story of report.stories) {
      expect(story.clipped, `${story.section} cards show their whole content`).toBe(0);
      expect(story.overlapping, `${story.section} plain cards do not overlap`).toBe(0);
      if (story.grid) {
        // The wide Projects grid is its intended normal-flow presentation, not a failed fit.
        expect(story.section).toBe("projects");
        expect(story.on).toBe(false);
        expect(story.reason).toBe("");
      } else if (!story.on) expect(story.reason, `${story.section} explains its plain layout`).not.toBe("");
    }
    const samples = await sweep(page, 0, await maxScroll(page), 24, 1);
    expect(transformFailures(samples, height)).toEqual([]);
    expect(clearanceFailures(samples, height, await documentOrder(page)).slice(0, 8)).toEqual([]);
  });

// A compact snapshot of one stretch of the page, to compare a resized page with a fresh one.
async function snapshot(page: Page, section: string) {
  const top = await page.evaluate((id) => document.getElementById(id)!.getBoundingClientRect().top + scrollY, section);
  const samples = await sweep(page, Math.round(top), Math.round(top + 2400), 40, 2);
  return samples.map(({ y, items }) => ({
    y,
    items: items.filter((it) => it.kind !== "content").map((it) => [Math.round(it.top), Math.round(it.opacity * 20) / 20]),
  }));
}

test("repeated live resizing and fit-boundary crossings settle into the fresh layout", async ({ page }) => {
  await page.setViewportSize({ width: 412, height: 812 });
  await open(page);
  const fresh = await snapshot(page, "kehsun");
  await scrollToY(page, (await page.evaluate(() => document.getElementById("building")!.offsetTop)) + 400);
  const modes: string[] = [];
  for (let cycle = 0; cycle < 4; cycle++)
    for (const [width, height] of [[844, 390], [393, 659], [412, 700], [412, 812]]) {
      await page.setViewportSize({ width, height });
      await frames(page, 3);
      await page.waitForTimeout(250);
      modes.push((await stories(page)).map((s) => (s.on ? 1 : 0)).join(""));
    }
  // Modes follow the size every time, not the history of resizes.
  expect(new Set(modes.filter((_, i) => i % 4 === 3)).size, "the same layout after each return to 412x812").toBe(1);
  expect(new Set(modes.filter((_, i) => i % 4 === 1)).size, "the same layout after each visit to 393x659").toBe(1);
  const report = await layoutReport(page);
  expect(report.probes, "observers and probes are not duplicated").toBe(1);
  // Same positions (within a pixel of sub-pixel rounding) and opacities as a fresh page.
  const resized = await snapshot(page, "kehsun");
  expect(resized.length).toBe(fresh.length);
  const differences = resized.flatMap((sample, k) =>
    sample.items.flatMap(([top, opacity], i) => {
      const [freshTop, freshOpacity] = fresh[k].items[i];
      return Math.abs(top - freshTop) > 1 || Math.abs(opacity - freshOpacity) > 0.05
        ? [`y=${sample.y} item ${i}: ${top}/${opacity} vs fresh ${freshTop}/${freshOpacity}`]
        : [];
    }),
  );
  expect(differences.slice(0, 10), "resized page matches a fresh page").toEqual([]);
});

test("toolbar-sized height changes and text-size changes never scroll the page", async ({ page }) => {
  await page.setViewportSize({ width: 412, height: 812 });
  await open(page);
  const kehsun = await page.evaluate(() => document.getElementById("kehsun")!.offsetTop);
  await scrollToY(page, kehsun + 900);
  const before = await page.evaluate(() => scrollY);
  // A browser toolbar appearing and retracting.
  for (const height of [868, 812, 756, 812]) {
    await page.setViewportSize({ width: 412, height });
    await frames(page, 3);
    await page.waitForTimeout(250);
  }
  expect(await takeScrolls(page), "toolbar-sized changes never scroll programmatically").toEqual([]);
  expect(Math.abs((await page.evaluate(() => scrollY)) - before), "the page stays where it was").toBeLessThanOrEqual(1);
  // Larger text, applied live.
  await page.addStyleTag({ content: "html { font-size: 125% }" });
  await frames(page, 3);
  await page.waitForTimeout(400);
  expect(await takeScrolls(page), "a text-size change never scrolls programmatically").toEqual([]);
  const report = await layoutReport(page);
  for (const story of report.stories) expect(story.clipped, `${story.section} after the changes`).toBe(0);
});

/* Rotation can switch stories between held and plain layouts and halve the page's height. The
   card being read stays the card being read: in view near the top of the plain list, and on
   show again in the held story after rotating back. */
test("rotating keeps the card being read", async ({ page }) => {
  await page.setViewportSize({ width: 412, height: 812 });
  await open(page);
  const screen = 812;
  for (const story of (await stories(page)).filter((s) => s.on)) {
    const top = await page.evaluate((id) => document.getElementById(id)!.getBoundingClientRect().top + scrollY, story.section);
    const bottom = await page.evaluate((id) => document.getElementById(id)!.getBoundingClientRect().bottom + scrollY, story.section);
    const samples = await sweep(page, Math.round(top), Math.round(bottom), 8, 1);
    const index = story.cards - 1;
    const parked = plateaus(series(samples, story.section, "card", index).filter((p) => p.top < screen * 0.6), 40).at(-1)!;
    await scrollToY(page, Math.round((parked.from + parked.to) / 2), 600);
    const shown = () => page.evaluate(([id, i]) => {
      const card = document.querySelectorAll<HTMLElement>(`#${id} .stack-card`)[Number(i)];
      const rect = card.getBoundingClientRect();
      const hit = document.elementFromPoint(innerWidth / 2, Math.min(innerHeight - 2, Math.max(1, rect.top + Math.min(rect.height, innerHeight) / 3)));
      return { top: Math.round(rect.top), onTop: !!hit && card.contains(hit), height: innerHeight };
    }, [story.section, index] as const);
    expect((await shown()).onTop, `${story.section}: the last card is on show before rotating`).toBe(true);
    await page.setViewportSize({ width: 812, height: 412 });
    await frames(page, 3);
    await page.waitForTimeout(500);
    const landscape = await shown();
    expect(landscape.onTop && landscape.top > -landscape.height * 0.5 && landscape.top < landscape.height * 0.5, `${story.section} in landscape: ${JSON.stringify(landscape)}`).toBe(true);
    await page.setViewportSize({ width: 412, height: 812 });
    await frames(page, 3);
    await page.waitForTimeout(500);
    const back = await shown();
    expect(back.onTop, `${story.section}: the same card is on show after rotating back: ${JSON.stringify(back)}`).toBe(true);
  }
});
