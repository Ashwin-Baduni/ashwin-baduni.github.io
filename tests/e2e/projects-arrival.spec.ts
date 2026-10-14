import { test, expect, open, scrollToY, sectionTop, maxScroll, sweep, series, plateaus } from "./helpers";

// Judge the staged entrance and preview timing from rendered positions, without reading the
// planner. A short heading should settle first, then its card; spare room should already show
// the next project, and that early preview counts towards its wait.
for (const height of [812, 915]) {
  test(`Projects has staggered arrivals and early previews on 412x${height}`, async ({ page }) => {
    await page.setViewportSize({ width: 412, height });
    await open(page);
    expect(await page.locator("#projects .stack").getAttribute("data-stack")).toBe("on");
    const top = await sectionTop(page, "projects");
    const bottom = await page.locator("#projects").evaluate(el => el.getBoundingClientRect().bottom + scrollY);
    const samples = await sweep(page, Math.round(top - height), Math.min(await maxScroll(page), Math.round(bottom)), 4);
    const intro = series(samples, "projects", "intro", 0);
    const heading = plateaus(intro, 40).find(run => Math.abs(run.top) < 1)!;
    expect(heading, "Projects heading parks").toBeTruthy();
    const cards = [0, 1, 2].map(i => series(samples, "projects", "card", i));
    const parks = cards.map(points => plateaus(points.filter(p => p.top < height * 0.6), 40).at(-1)!);
    expect(parks.every(Boolean), "every project parks").toBeTruthy();
    const continuation = parks[0].from - heading.from;
    expect(continuation, "first card keeps rising after the heading settles").toBeGreaterThan(height * 0.08);
    expect(continuation, "a short title does not impose a long second entrance").toBeLessThan(height * 0.2);
    const firstVisible = cards[0].find(p => p.top < height && p.opacity > 0.15)!;
    expect(firstVisible.y, "the first card is visible well before the heading parks").toBeLessThan(heading.from - height * 0.25);
    const checkpoints = [heading.from + 8, parks[0].from + 8];
    for (let i = 1; i < cards.length; i++) {
      const wait = plateaus(cards[i].filter(p => p.top > height * 0.6 && p.top < height), 40)[0];
      expect(wait, `project ${i} previews at the bottom`).toBeTruthy();
      expect(wait.from, `project ${i} is visible while the previous card is still arriving`).toBeLessThan(parks[i - 1].from - height * 0.1);
      const k = cards[i].findIndex(p => p.y >= wait.from);
      expect(cards[i][k].top - cards[i - 1][k].bottom, "the early preview still clears the arriving card").toBeGreaterThanOrEqual(10);
      expect(cards[i][k].opacity, "the early preview is recognisable").toBeGreaterThan(0.15);
      expect(wait.to, "early preview time counts; parking does not restart the wait").toBeLessThan(parks[i - 1].from + height * 0.17);
      const contact = cards[i].findIndex((p, j) => p.y > parks[i - 1].from && p.top < cards[i - 1][j].bottom - 0.5);
      expect(contact, "the next card eventually covers the previous one").toBeGreaterThan(0);
      expect(cards[i][contact].y - parks[i - 1].from, "each project retains its full reading interval before covering begins").toBeGreaterThanOrEqual(height * 0.49);
      checkpoints.push(wait.from + 8, wait.to + height * 0.1, parks[i].from + 8);
    }
    // Revisit the same milestones backwards: arrivals and previews must not depend on direction.
    for (const y of checkpoints.toSorted((a, b) => b - a)) {
      await scrollToY(page, y, 100);
      const actual = await page.locator("#projects .stack-card").evaluateAll(elements => elements.map(el => ({
        top: el.getBoundingClientRect().top, opacity: Number(getComputedStyle(el).opacity),
      })));
      const expected = cards.map(points => points.reduce((nearest, p) => Math.abs(p.y - y) < Math.abs(nearest.y - y) ? p : nearest));
      actual.forEach((value, i) => {
        expect(Math.abs(value.top - expected[i].top), "reverse geometry matches the forward pass").toBeLessThanOrEqual(3);
        expect(Math.abs(value.opacity - expected[i].opacity), "reverse fade matches the forward pass").toBeLessThanOrEqual(0.03);
      });
    }
  });
}

for (const [width, height] of [[375, 548], [393, 659], [412, 812], [430, 932], [844, 390], [1280, 800]]) {
  test(`Certifications finishes revealing at the page end on ${width}x${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await open(page);
    const end = await maxScroll(page);
    const read = () => page.evaluate(() => [...document.querySelectorAll<HTMLElement>(
      "#certifications h2, #certifications li, #certifications .back-to-top-wrap",
    )].map(element => ({
      name: element.textContent!.trim(),
      opacity: Number(getComputedStyle(element).opacity),
      top: element.getBoundingClientRect().top,
      bottom: element.getBoundingClientRect().bottom,
    })));
    for (const y of [end, end - height * 0.4, end]) {
      await scrollToY(page, y, 600);
      if (y !== end) continue;
      for (const item of await read()) {
        expect(item.opacity, `${item.name} is finished at the reachable end`).toBeGreaterThanOrEqual(0.99);
        // On these sizes the compact closing section fits in the final viewport.
        expect(item.top, `${item.name} is on screen`).toBeGreaterThanOrEqual(-1);
        expect(item.bottom, `${item.name} is not cut off`).toBeLessThanOrEqual(height + 1);
      }
    }
  });
}
