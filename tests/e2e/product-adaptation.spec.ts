import type { Page } from "@playwright/test";
import { test, expect, open, scrollToY, sweep, clearanceFailures, documentOrder, transformFailures } from "./helpers";

// A narrow desktop window is not necessarily as tall as a phone. These are behavioural
// requirements for both products, not permission to silently switch off their demonstrations.
const SHORT = [[445, 570], [494, 633], [500, 657], [600, 657], [375, 548]];
const ENDINGS = {
  building: [".mseq-record", ".mseq-answer"],
  kehsun: [".call-connected", ".transcript-saved"],
};

async function state(page: Page, section: string) {
  return page.locator(`#${section} .stack`).evaluate((root, selectors) => ({
    held: root.getAttribute("data-stack") === "on",
    flow: root.getAttribute("data-playback") === "flow",
    end: selectors.map((selector) => Number(getComputedStyle(root.querySelector(selector)!).opacity)),
    plate: root.querySelector(".mseq-plate-num")?.textContent,
    question: root.querySelector(".mseq-q")?.textContent,
    review: root.querySelector(".review-status")?.textContent,
    clipped: [...root.querySelectorAll<HTMLElement>(".stack-card")].some((card) => card.scrollHeight > card.clientHeight + 1),
  }), ENDINGS[section as keyof typeof ENDINGS]);
}

async function exercise(page: Page, section: keyof typeof ENDINGS, height: number) {
  const [top, bottom] = await page.locator(`#${section}`).evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return [rect.top + scrollY, rect.bottom + scrollY];
  });
  const samples: Array<{ y: number; value: Awaited<ReturnType<typeof state>> }> = [];
  // Includes arrival, both demonstrations and exit. Seek in both directions: an on-enter
  // animation or an already-finished static fallback cannot satisfy these checks.
  for (let y = Math.max(0, top - height); y <= bottom; y += height * 0.16) {
    await scrollToY(page, Math.round(y), 350);
    const value = await state(page, section);
    expect(value.held || value.flow, `${section} keeps scroll playback`).toBe(true);
    expect(value.clipped, `${section} does not crop card content`).toBe(false);
    samples.push({ y: Math.round(y), value });
  }
  for (const i of [0, 1]) {
    const early = samples.find((s) => s.value.end[i] === 0)!;
    const late = samples.find((s) => s.value.end[i] === 1)!;
    expect(early, `${section} card ${i} has an opening state`).toBeTruthy();
    expect(late, `${section} card ${i} finishes`).toBeTruthy();
    expect(late.y, `${section} card ${i} completes after its opening`).toBeGreaterThan(early.y);
    await scrollToY(page, early.y, 500);
    expect((await state(page, section)).end[i], `${section} card ${i} reverses`).toBe(0);
    await scrollToY(page, late.y, 500);
    expect((await state(page, section)).end[i], `${section} card ${i} replays`).toBe(1);
  }
  await scrollToY(page, Math.round(bottom), 500);
  const finished = await state(page, section);
  if (section === "building") {
    expect(finished.plate).toBe("UP 16 BX 4471");
    expect(finished.question).toBe("Which cars with UP plates arrived today?");
  } else expect(finished.review).toBe("Reviewed by practitioner");
  const geometry = await sweep(page, Math.max(0, Math.round(top - height)), Math.round(bottom + height * 0.5), 24);
  expect(transformFailures(geometry, height)).toEqual([]);
  expect(clearanceFailures(geometry, height, await documentOrder(page)).slice(0, 8)).toEqual([]);
}

for (const [width, height] of SHORT) {
  test(`both products animate in a short ${width}x${height} window`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await open(page);
    for (const section of ["building", "kehsun"] as const) {
      expect((await state(page, section)).held, `${section} cards fit and stack`).toBe(true);
      await exercise(page, section, height);
    }
  });
}

test("a very short window keeps product playback in readable normal flow", async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await open(page);
  expect((await state(page, "kehsun")).flow).toBe(true);
  await exercise(page, "kehsun", 390);
});

test("short-product adaptation respects reduced motion and can be switched live", async ({ page }) => {
  await page.setViewportSize({ width: 445, height: 570 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await open(page);
  for (const section of ["building", "kehsun"]) {
    const value = await state(page, section);
    expect(value).toMatchObject({ held: false, flow: false, end: [1, 1], clipped: false });
  }
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.waitForTimeout(800);
  for (const section of ["building", "kehsun"]) expect((await state(page, section)).held).toBe(true);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.waitForTimeout(500);
  for (const section of ["building", "kehsun"]) {
    expect(await state(page, section)).toMatchObject({ held: false, flow: false, end: [1, 1], clipped: false });
  }
});

test("resizing crosses pinned introductions, card-only stacks and normal flow without losing playback", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await open(page);
  for (const [width, height] of [[445, 570], [844, 390], [494, 633], [412, 812], [1280, 800]]) {
    await page.setViewportSize({ width, height });
    await page.waitForTimeout(1200);
    for (const section of ["building", "kehsun"] as const) {
      const target = page.locator(`#${section}`);
      const [start, end] = await target.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        return [rect.top + scrollY - innerHeight, rect.bottom + scrollY];
      });
      await scrollToY(page, Math.max(0, Math.round(start)), 500);
      const opening = await state(page, section);
      expect(opening.held || opening.flow, `${section} at ${width}x${height} stays animated`).toBe(true);
      expect(opening.end).toEqual([0, 0]);
      await scrollToY(page, Math.round(end), 500);
      expect((await state(page, section)).end).toEqual([1, 1]);
    }
    if (width === 412 || width === 1280) {
      expect(await page.locator('.product-segment [data-intro="flow"]').count(), "restores the full introduction where it fits").toBe(0);
    }
  }
});
