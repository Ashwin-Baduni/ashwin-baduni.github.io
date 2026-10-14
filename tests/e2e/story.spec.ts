import { test, expect, open, sweep, stories, maxScroll, series, plateaus, scrollToY, CLEARANCE, clearanceFailures, documentOrder, transformFailures } from "./helpers";

/*
  The scroll stories, judged only from rendered DOM rectangles, transforms and opacities.
  Nothing here reads the planner's numbers: each expectation is the visible behaviour itself.
*/

// The element in each card that appears last in its demonstration.
const FINISHED: Record<string, string[]> = {
  building: [".mseq-record", ".mseq-answer"],
  kehsun: [".call-connected", ".transcript-saved"],
  focus: [".scene-caption", ".scene-caption", ".scene-caption", ".scene-caption"],
};
for (const check of ["transforms", "clearance"] as const)
  test(check === "transforms"
    ? "held cards and introductions are never moved by scroll-linked transforms, down and up"
    : "incoming headings, faint or solid, keep their clearance from outgoing content, down and up", async ({ page }) => {
    await open(page);
    const screen = page.viewportSize()!.height;
    const max = await maxScroll(page);
    for (const [from, to] of [[0, max], [max, 0]]) {
      const samples = await sweep(page, from, to, 10);
      const failures = check === "transforms"
        ? transformFailures(samples, screen)
        : clearanceFailures(samples, screen, await documentOrder(page)).slice(0, 12);
      expect(failures, `${check} ${from < to ? "down" : "up"}`).toEqual([]);
    }
  });

test("cards wait at the bottom, rise with the page, park, cover and leave together", async ({ page }) => {
  await open(page);
  const screen = page.viewportSize()!.height;
  const max = await maxScroll(page);
  // Stacked stories only. Product rows and the shared Skills frame have dedicated checks.
  for (const story of (await stories(page)).filter((s) => s.on && !s.row && !s.sharedFrame)) {
    const top = await page.evaluate((id) => document.getElementById(id)!.getBoundingClientRect().top + scrollY, story.section);
    const bottom = await page.evaluate((id) => document.getElementById(id)!.getBoundingClientRect().bottom + scrollY, story.section);
    const samples = await sweep(page, Math.max(0, Math.round(top - screen)), Math.min(max, Math.round(bottom)), 4);
    const cards = Array.from({ length: story.cards }, (_, i) => series(samples, story.section, "card", i));
    const parked = cards.map((points) => {
      const runs = plateaus(points.filter((p) => p.top < screen * 0.6), 40);
      expect(runs.length, `${story.section} card parks`).toBeGreaterThan(0);
      return runs.at(-1)!;
    });
    const release = parked[0].to;
    const intro = plateaus(series(samples, story.section, "intro", 0), 40).find((run) => Math.abs(run.top) < 1);
    expect(intro, `${story.section} introduction is held`).toBeTruthy();
    expect(Math.abs(intro!.to - release), `${story.section} introduction leaves with the cards`).toBeLessThanOrEqual(4);
    for (let i = 0; i < story.cards; i++) {
      const label = `${story.section} card ${i}`;
      const points = cards[i];
      expect(Math.abs(parked[i].to - release), `${label} leaves with the others`).toBeLessThanOrEqual(4);
      // After the common exit every card moves with the page, keeping its place relative to the others.
      const introPoints = series(samples, story.section, "intro", 0);
      const after = points.map((p, k) => ({ ...p, k })).filter((p) => p.y > release + 8 && p.y < release + screen * 0.3);
      for (const p of after.slice(1)) {
        const before = points[p.k - 1];
        expect(Math.abs(p.top - before.top + (p.y - before.y)), `${label} leaves with the page`).toBeLessThanOrEqual(0.5);
        expect(Math.abs((p.top - introPoints[p.k].top) - (before.top - introPoints[p.k - 1].top)), `${label} leaves with its introduction`).toBeLessThanOrEqual(0.5);
      }
      if (i === 0) {
        // The first card rises in from the bottom edge, faint, never appearing part-way up the screen:
        // it is already drawn the moment its top enters the viewport.
        const first = points.find((p) => p.opacity > 0.01 && p.top < screen);
        expect(first, `${label} becomes visible`).toBeTruthy();
        expect(first!.top, `${label} is visible as soon as it enters at the bottom edge`).toBeGreaterThanOrEqual(screen * 0.97);
        expect(first!.opacity, `${label} enters faint`).toBeLessThanOrEqual(0.3);
        continue;
      }
      // Cover: each card parks exactly where the previous one is.
      const previous = parked[i - 1];
      expect(Math.abs(parked[i].top - previous.top), `${label} covers the previous card`).toBeLessThanOrEqual(0.5);
      const waits = plateaus(points.filter((p) => p.top > screen * 0.6 && p.top < screen), 40);
      expect(waits.length, `${label} waits at the bottom`).toBeGreaterThan(0);
      const wait = waits[0];
      const previousBottom = series(samples, story.section, "card", i - 1).find((p) => p.y >= wait.from)!;
      expect(screen - wait.top, `${label} preview is recognisable`).toBeGreaterThanOrEqual(30);
      expect(wait.top - previousBottom.bottom, `${label} preview clears the parked card`).toBeGreaterThanOrEqual(CLEARANCE);
      // Compact Projects cards can preview earlier as space opens during arrival; the other
      // stories keep their preview timed to the preceding card parking.
      if (story.section === "projects")
        expect(wait.from - previous.from, `${label} is ready by the previous card's parking`).toBeLessThanOrEqual(8);
      else
        expect(Math.abs(wait.from - previous.from), `${label} waits from the previous card's parking`).toBeLessThanOrEqual(8);
      expect(wait.to - wait.from, `${label} waits at least a fifth of a screen`).toBeGreaterThanOrEqual(screen * 0.2 - 8);
      // Native rise: one pixel of travel per pixel of scroll.
      const rise = points.filter((p) => p.y > wait.to + 4 && p.y < parked[i].from - 4);
      for (let k = 1; k < rise.length; k++)
        expect(Math.abs((rise[k].top - rise[k - 1].top) / (rise[k].y - rise[k - 1].y) + 1), `${label} rises 1:1`).toBeLessThanOrEqual(0.02);
      const middle = points.find((p) => p.y >= (wait.from + wait.to) / 2)!;
      expect(middle.opacity, `${label} waits faintly`).toBeGreaterThan(0.15);
      expect(middle.opacity, `${label} waits faintly`).toBeLessThan(0.5);
      const landing = points.find((p) => p.y >= parked[i].from)!;
      expect(landing.opacity, `${label} is solid when it parks`).toBeGreaterThanOrEqual(0.98);
    }
  }
});

test("demonstrations start after parking and finish before the next card or the exit", async ({ page }) => {
  await open(page);
  const screen = page.viewportSize()!.height;
  // Product rows and the shared Skills frame have their own chapter/playback checks.
  for (const story of (await stories(page)).filter((s) => s.on && !s.row && !s.sharedFrame && FINISHED[s.section])) {
    const top = await page.evaluate((id) => document.getElementById(id)!.getBoundingClientRect().top + scrollY, story.section);
    const bottom = await page.evaluate((id) => document.getElementById(id)!.getBoundingClientRect().bottom + scrollY, story.section);
    const samples = await sweep(page, Math.max(0, Math.round(top - screen)), Math.round(bottom), 6, 0);
    const cards = Array.from({ length: story.cards }, (_, i) => series(samples, story.section, "card", i));
    const parks = cards.map((points) => plateaus(points.filter((p) => p.top < screen * 0.6), 40).at(-1)!);
    const finished = (i: number) =>
      page.evaluate(([id, i, selector]) => {
        const card = document.querySelectorAll(`#${id} .stack-card`)[Number(i)];
        const element = card.querySelector(selector as string)!;
        let value = 1;
        for (let node: Element | null = element; node && node !== card; node = node.parentElement) value *= Number(getComputedStyle(node).opacity);
        return value;
      }, [story.section, i, FINISHED[story.section][i]] as const);
    for (let i = 0; i < story.cards; i++) {
      const label = `${story.section} card ${i}`;
      await scrollToY(page, parks[i].from + 2, 700);
      expect(await finished(i), `${label} has not finished when it parks`).toBeLessThanOrEqual(0.05);
      // The next card reaching this one's bottom edge, or the story's exit.
      const contact = i + 1 < story.cards
        ? cards[i + 1].findIndex((p, k) => p.y > parks[i].from && p.top < cards[i][k].bottom - 0.5)
        : -1;
      const until = contact >= 0 ? cards[i + 1][contact].y : parks[i].to;
      await scrollToY(page, until - 2, 900);
      expect(await finished(i), `${label} has finished before it is covered or leaves`).toBeGreaterThanOrEqual(0.98);
    }
  }
});

/*
  A re-layout refreshes every scroll animation: ScrollTrigger rewinds each one to measure, then
  restores it with its callbacks suppressed. Wording a demonstration draws in those callbacks
  (typed questions, plate characters, review notes) must still be the finished wording afterwards.
*/
test("completed demonstrations keep their finished wording through a re-layout", async ({ page }) => {
  await open(page);
  const { width, height } = page.viewportSize()!;
  await scrollToY(page, await maxScroll(page), 900);
  const wording = () => page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>("main [data-rest-text]")].filter((element) => element.textContent !== element.dataset.restText).map((element) => element.textContent));
  expect(await wording(), "finished wording at the page end").toEqual([]);
  // A browser toolbar appearing and retracting re-plans and refreshes, without scrolling.
  for (const h of [height - 56, height]) {
    await page.setViewportSize({ width, height: h });
    await page.waitForTimeout(900);
  }
  expect(await wording(), "finished wording after the re-layout").toEqual([]);
});
