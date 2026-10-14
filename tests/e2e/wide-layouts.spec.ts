import { test, expect, open, scrollToY, sweep, series, plateaus, clearanceFailures, documentOrder } from "./helpers";
import type { Page } from "@playwright/test";

async function arrangements(page: Page) {
  return page.evaluate(() => Object.fromEntries(["building", "kehsun", "focus", "projects"].map(id => {
    const root = document.querySelector(`#${id} .stack`)!;
    return [id, getComputedStyle(root.querySelector(".stack-cards")!).getPropertyValue("--story-arrangement").trim() || "stack"];
  })));
}
async function range(page: Page, id: string) {
  return page.locator(`#${id}`).evaluate(e => {
    const r = e.getBoundingClientRect();
    return [Math.round(r.top + scrollY), Math.round(r.bottom + scrollY)];
  });
}
async function grid(page: Page) {
  return page.locator("#projects .stack-card").evaluateAll(cards => cards.map(c => {
    const r = c.getBoundingClientRect();
    return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, height: r.height, width: r.width,
      clipped: c.scrollHeight > c.clientHeight + 1, position: getComputedStyle(c).position };
  }));
}
async function checkGrid(page: Page) {
  const [featured, analytics, captcha] = await grid(page);
  expect(Math.abs(featured.top - analytics.top), "top cards align").toBeLessThan(1);
  expect(Math.abs(featured.bottom - captcha.bottom), "featured spans both right cards").toBeLessThan(1);
  expect(analytics.left - featured.right, "two separated columns").toBeGreaterThanOrEqual(12);
  expect(captcha.top - analytics.bottom, "separate right rows").toBeGreaterThanOrEqual(12);
  expect(Math.abs(captcha.left - analytics.left)).toBeLessThan(1);
  for (const card of [featured, analytics, captcha]) {
    expect(card.clipped).toBe(false);
    expect(card.position).toBe("relative");
  }
}

for (const [width, height] of [[1024, 768], [1280, 800], [1366, 657], [1920, 1080]]) {
  test(`wide sections use readable product rows, split skills and the project grid at ${width}x${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await open(page);
    expect(await arrangements(page)).toEqual({ building: "row", kehsun: "row", focus: "split", projects: "grid" });
    const [top, end] = await range(page, "kehsun");
    const samples = await sweep(page, Math.max(0, top - height), end, 12);
    const parked = plateaus(series(samples, "kehsun", "card", 0).filter(p => p.top < height * 0.6), 40).at(-1)!;
    expect(parked, "Kehsun parks on this desktop").toBeTruthy();
    const shown: number[][] = [];
    for (const fraction of [0, 0.2, 0.45, 0.7, 0.95, 0.2, 0]) {
      await scrollToY(page, Math.round(parked.from + fraction * (parked.to - parked.from)), 500);
      const state = await page.locator("#kehsun .stack").evaluate(root => {
        const cards = [...root.querySelectorAll(".stack-card")].map(e => e.getBoundingClientRect());
        return { equal: Math.abs(cards[0].top - cards[1].top) < 1 && Math.abs(cards[0].height - cards[1].height) < 1,
          gap: cards[1].left - cards[0].right,
          end: [".call-connected", ".transcript-saved"].map(s => Number(getComputedStyle(root.querySelector(s)!).opacity)) };
      });
      expect(state.equal).toBe(true);
      expect(state.gap).toBeGreaterThanOrEqual(12);
      shown.push(state.end);
    }
    expect(shown[0]).toEqual([0, 0]);
    expect(shown[4]).toEqual([1, 1]);
    expect(shown[6]).toEqual([0, 0]);
    expect(shown[2].some(n => n < 1), "demos do not jump straight to finished").toBe(true);

    const anchors = await page.locator("#focus .stack-anchor").evaluateAll(list => list.map(e => e.getBoundingClientRect().top + scrollY));
    for (const i of [0, 1, 2, 3, 2, 1, 0]) {
      await scrollToY(page, Math.round(anchors[i]), 500);
      const state = await page.locator("#focus .stack").evaluate((root, index) => {
        const intro = root.querySelector(".stack-intro")!.getBoundingClientRect();
        const copies = [...root.querySelectorAll(".focus-intro-copy")];
        const card = root.querySelectorAll<HTMLElement>(".stack-card")[index];
        const rect = card.getBoundingClientRect();
        return { on: root.getAttribute("data-stack"), active: copies.findIndex(c => c.classList.contains("is-active")),
          gap: rect.left - intro.right, top: rect.top, bottom: rect.bottom,
          complete: getComputedStyle(card.querySelector(".scene-caption")!).opacity,
          clipped: card.scrollHeight > card.clientHeight + 1,
          words: [...copies[index].querySelectorAll(".word")].every(w => Number(getComputedStyle(w).opacity) > 0.99) };
      }, i);
      expect(state).toMatchObject({ on: "on", active: i, complete: "1", clipped: false, words: true });
      expect(state.gap, "Skills copy left, illustration right").toBeGreaterThan(12);
      expect(state.top).toBeGreaterThanOrEqual(0);
      expect(state.bottom).toBeLessThan(height);
    }
    const [projectsTop, projectsEnd] = await range(page, "projects");
    await scrollToY(page, projectsTop, 400);
    await checkGrid(page);
    const handoff = await sweep(page, projectsTop - height, Math.min(projectsEnd + height, await page.evaluate(() => document.documentElement.scrollHeight - innerHeight)), 12);
    expect(clearanceFailures(handoff, height, await documentOrder(page)).slice(0, 8)).toEqual([]);
    await scrollToY(page, await page.evaluate(() => document.documentElement.scrollHeight), 500);
    expect(await page.locator("#certifications-title").evaluate(e => Number(getComputedStyle(e).opacity))).toBe(1);
  });
}

test("new wide compositions restore their stacks after width, parent and text-size changes", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await open(page);
  const cases = [
    { width: 445, height: 570, text: 100, parent: "" },
    { width: 1280, height: 800, text: 100, parent: "" },
    { width: 1280, height: 800, text: 150, parent: "" },
    { width: 1280, height: 800, text: 100, parent: "800px" },
    { width: 1280, height: 800, text: 100, parent: "" },
    { width: 412, height: 812, text: 100, parent: "" },
    { width: 1280, height: 800, text: 100, parent: "" },
  ];
  for (const c of cases) {
    await page.setViewportSize({ width: c.width, height: c.height });
    await page.evaluate(({ text, parent }) => {
      document.documentElement.style.fontSize = `${text}%`;
      document.querySelectorAll<HTMLElement>(".stack").forEach(root => root.style.maxWidth = parent);
    }, c);
    await page.waitForTimeout(1100);
    const wide = c.width === 1280 && c.text === 100 && !c.parent;
    expect(await arrangements(page), JSON.stringify(c)).toEqual(wide
      ? { building: "row", kehsun: "row", focus: "split", projects: "grid" }
      : { building: "stack", kehsun: "stack", focus: "stack", projects: "stack" });
    if (wide) await checkGrid(page);
    for (const id of ["kehsun", "focus"]) {
      const [top, bottom] = await range(page, id);
      await scrollToY(page, top - c.height, 500);
      const selector = id === "kehsun" ? ".transcript-saved" : ".scene-caption";
      expect(await page.locator(`#${id} ${selector}`).last().evaluate(e => Number(getComputedStyle(e).opacity))).toBe(0);
      await scrollToY(page, bottom, 500);
      expect(await page.locator(`#${id} ${selector}`).last().evaluate(e => Number(getComputedStyle(e).opacity))).toBe(1);
    }
  }
});

test("wide sections keep all content readable with reduced motion and in a short desktop", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 480 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await open(page);
  await checkGrid(page);
  await expect(page.locator(".review-status")).toHaveText("Reviewed by practitioner");
  for (const section of ["kehsun", "focus", "projects"]) {
    const cards = page.locator(`#${section} .stack-card`);
    for (let i = 0; i < await cards.count(); i++) {
      await cards.nth(i).scrollIntoViewIfNeeded();
      expect(await cards.nth(i).evaluate(c => c.scrollHeight <= c.clientHeight + 1)).toBe(true);
    }
  }
  const title = page.locator('.certification-list a[href="https://www.theirmindia.org/"]');
  await title.scrollIntoViewIfNeeded();
  expect(await title.evaluate(link => {
    const name = link.querySelector(".link-underline")!.getBoundingClientRect();
    const level = link.querySelector(".arrow-text")!.getBoundingClientRect();
    return level.top >= name.bottom - 1 && !link.textContent?.includes(", Level");
  })).toBe(true);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.waitForTimeout(1100);
  expect(await page.locator("#kehsun .stack").getAttribute("data-stack")).toBe("on");
  expect(await page.locator("#focus .stack").getAttribute("data-stack")).toBe("on");
  await checkGrid(page);
});

// Booking and transcript have different original timeline durations. A saved percentage must
// mean the same visible frame when switching between simultaneous and sequential playback.
test("Kehsun keeps the same demonstration frame when resized mid-play in both directions", async ({ page }) => {
  const snapshot = () => page.locator("#kehsun .stack").evaluate(root => {
    const values = (selector: string) => [...root.querySelectorAll(selector)].map(e => Number(getComputedStyle(e).opacity));
    return { booking: values(".booking-step,.call-connected"), transcript: values(".transcript-word,.reply-word,.transcript-note,.transcript-approved,.transcript-saved") };
  });
  const park = async (index: number) => {
    const [top, end] = await range(page, "kehsun");
    const height = page.viewportSize()!.height;
    const samples = await sweep(page, top, end, 12);
    return plateaus(series(samples, "kehsun", "card", index).filter(p => p.top < height * 0.6), 40).at(-1)!;
  };
  await page.setViewportSize({ width: 1280, height: 800 });
  await open(page);
  const row = await park(0);
  await scrollToY(page, Math.round(row.from + (row.to - row.from) * 0.45), 600);
  const before = (await snapshot()).booking;
  await page.setViewportSize({ width: 900, height: 800 });
  await page.waitForTimeout(1200);
  const after = (await snapshot()).booking;
  before.forEach((value, i) => expect(Math.abs(value - after[i]), `booking frame ${i} survives row → stack`).toBeLessThan(0.02));
  const stack = await park(1);
  await scrollToY(page, Math.round(stack.from + (stack.to - stack.from) * 0.45), 600);
  const transcript = (await snapshot()).transcript;
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.waitForTimeout(1200);
  const restored = (await snapshot()).transcript;
  transcript.forEach((value, i) => expect(Math.abs(value - restored[i]), `transcript frame ${i} survives stack → row`).toBeLessThan(0.02));
  await page.evaluate(() => scrollBy(0, 180));
  await page.waitForTimeout(600);
  expect((await snapshot()).transcript, "scrolling continues to play the note").not.toEqual(restored);
});


test("desktop Skills keeps one frame and four links through every chapter and reverses", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await open(page);
  const links = page.locator("#focus .skills-menu a");
  const anchors = await page.locator("#focus .stack-anchor").evaluateAll(elements => elements.map(e => e.getBoundingClientRect().top + scrollY));
  let top: number | undefined;
  let copyPositions: number[][] | undefined;
  for (const i of [0, 1, 2, 3, 2, 1, 0]) {
    await scrollToY(page, anchors[i], 400);
    await expect(links.nth(i)).toHaveAttribute("aria-current", "step");
    for (let k = 0; k < 4; k++) {
      await expect(links.nth(k)).toBeVisible();
      await expect(page.locator("#focus .skills-menu-detail").nth(k)).toBeVisible();
    }
    const positions = await page.locator("#focus .skills-menu-item").evaluateAll(items => items.map(item => {
      const box = item.getBoundingClientRect();
      const description = item.querySelector("p")!.getBoundingClientRect();
      return [box.top, box.height, description.top, description.height];
    }));
    copyPositions ??= positions;
    expect(positions, "all expanded descriptions stay in place when selection changes").toEqual(copyPositions);
    expect(positions.at(-1)![0] + positions.at(-1)![1], "the complete list fits the viewport").toBeLessThan(800);
    const frame = await page.locator("#focus .skills-stage").boundingBox();
    expect(frame).toBeTruthy();
    top ??= frame!.y;
    expect(Math.abs(frame!.y - top), "one stationary illustration frame").toBeLessThan(1);
    const opacities = await page.locator("#focus .stack-card").evaluateAll(cards => cards.map(c => Number(getComputedStyle(c).opacity)));
    expect(opacities).toEqual([0, 1, 2, 3].map(k => +(i === k)));
    await scrollToY(page, anchors[i] - 800 * 0.75, 300);
    expect(await page.locator("#focus .scene-caption").nth(i).evaluate(e => Number(getComputedStyle(e).opacity)), "assembly rewinds within the active chapter").toBeLessThan(0.1);
  }
  await links.nth(2).click();
  await page.waitForTimeout(1300);
  await expect(links.nth(2)).toHaveAttribute("aria-current", "step");
  expect(await page.locator("#focus .scene-caption").nth(2).evaluate(e => Number(getComputedStyle(e).opacity))).toBe(1);
  expect(Math.abs(await page.evaluate(() => scrollY) - anchors[2])).toBeLessThan(2);
});

test("Skills preserves a partly assembled diagram across desktop and phone layouts", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await open(page);
  const anchor = await page.locator("#focus .stack-anchor").nth(1).evaluate(e => e.getBoundingClientRect().top + scrollY);
  await scrollToY(page, anchor - 800 * .45, 400);
  const state = () => page.locator("#focus .stack-card").nth(1).evaluate(card => [...card.querySelectorAll(".scene-piece, .scene-caption")].map(e => [Number(getComputedStyle(e).opacity), getComputedStyle(e).transform]));
  const before = await state();
  await page.setViewportSize({ width: 412, height: 812 });
  await page.waitForTimeout(1300);
  const after = await state();
  before.forEach((value, i) => expect(Math.abs(Number(value[0]) - Number(after[i][0])), `part ${i} survives resizing`).toBeLessThan(.025));
  await expect(page.locator("#focus .skills-menu")).toBeHidden();
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.waitForTimeout(1300);
  const restored = await state();
  before.forEach((value, i) => expect(Math.abs(Number(value[0]) - Number(restored[i][0])), `part ${i} survives return`).toBeLessThan(.025));
  await page.mouse.wheel(0, 350);
  await page.waitForTimeout(500);
  expect(await state(), "scrolling continues after both switches").not.toEqual(restored);
});

test("desktop Skills is centred with aligned edges and no waiting Experience preview", async ({ page }) => {
  for (const [width, height] of [[1024, 657], [1280, 633], [1280, 800], [1366, 657], [1920, 1080]]) {
    await page.setViewportSize({ width, height });
    await open(page);
    const anchors = await page.locator("#focus .stack-anchor").evaluateAll(elements => elements.map(e => e.getBoundingClientRect().top + scrollY));
    // First parking, every reading state, and reverse: no chapter changes the geometry.
    for (const y of [anchors[0] - height * .85, ...anchors, ...anchors.toReversed()]) {
      await scrollToY(page, y, 150);
      const state = await page.evaluate(() => {
        const intro = document.querySelector("#focus .stack-intro")!;
        const copy = intro.getBoundingClientRect();
        const frame = document.querySelector("#focus .skills-stage")!.getBoundingClientRect();
        const next = document.querySelector("#experience-title")!;
        const preview = next.getBoundingClientRect();
        const items = [...document.querySelectorAll("#focus .skills-menu-item")];
        const listTop = items[0].querySelector("a")!.getBoundingClientRect().top;
        const listBottom = items.at(-1)!.querySelector("p")!.getBoundingClientRect().bottom;
        return { copy: { top: copy.top, bottom: copy.bottom },
          frame: { top: frame.top, bottom: frame.bottom }, preview: { top: preview.top, bottom: preview.bottom },
          opacity: Number(getComputedStyle(next).opacity), borders: items.map(item => parseFloat(getComputedStyle(item).borderTopWidth)),
          listTop, listBottom };
      });
      expect(state.borders).toEqual([0, 1, 1, 1]);
      expect(Math.abs(state.frame.top - state.listTop), "frame begins at Computer vision, below the Skills label").toBeLessThan(1);
      expect(Math.abs(state.frame.bottom - state.listBottom), "frame ends at the final Product engineering description").toBeLessThan(1);
      await expect(page.locator("#experience .handoff-lane")).toHaveAttribute("data-handoff", "off");
      const bottom = Math.max(state.copy.bottom, state.frame.bottom);
      expect(state.preview.top - bottom, "clear space before Experience").toBeGreaterThanOrEqual(12);
      expect(state.copy.top, "the composition is no longer pinned to the top edge").toBeGreaterThan(10);
      expect(Math.abs(state.copy.top - (height - 12 - bottom)), "spare height is balanced above and below").toBeLessThan(2);
    }
  }
});

test("About's longer reading interval is desktop-only and finishes while the copy is visible", async ({ page }) => {
  for (const [width, height] of [[1280, 800], [1920, 1080], [412, 812]]) {
    await page.setViewportSize({ width, height });
    await open(page);
    const range = await page.locator(".about-copy").evaluate(copy => {
      const top = copy.getBoundingClientRect().top + scrollY;
      const start = top - innerHeight * .82;
      const distance = Math.max(100, (copy as HTMLElement).offsetHeight - innerHeight * .12);
      return { start, distance };
    });
    await scrollToY(page, range.start + range.distance, 250);
    const last = page.locator(".about-copy .word").last();
    const opacity = () => last.evaluate(word => Number(getComputedStyle(word).opacity));
    if (width > 1000) {
      expect(await opacity(), "desktop keeps revealing beyond the old end").toBeLessThan(.9);
      await scrollToY(page, range.start + range.distance * 1.3 + 1, 250);
    }
    expect(await opacity(), "phone finishes at its original end; desktop finishes 30% later").toBeGreaterThan(.99);
    const rect = await last.boundingBox();
    expect(rect!.y).toBeGreaterThan(0);
    expect(rect!.y + rect!.height).toBeLessThan(height);
    await scrollToY(page, range.start - 1, 250);
    expect(await opacity(), "word reveal reverses").toBeLessThan(.25);
  }
});

test("keyboard returning from Experience restores the expanded Skills list to full opacity", async ({ page, browserName }) => {
  test.skip(browserName === "webkit", "WebKit does not Tab to links by default");
  await page.setViewportSize({ width: 1280, height: 800 });
  await open(page);
  const experience = await page.locator("#experience").evaluate(e => e.getBoundingClientRect().top + scrollY);
  await scrollToY(page, experience + 120, 400);
  await page.keyboard.press("Tab");
  await page.locator("#experience a").first().focus();
  await page.keyboard.press("Shift+Tab");
  await page.waitForTimeout(400);
  await expect(page.locator("#focus .skills-menu a").last()).toBeFocused();
  expect(await page.locator("#focus .skills-menu a").last().evaluate(link => {
    let opacity = 1;
    for (let node: Element | null = link; node; node = node.parentElement) opacity *= Number(getComputedStyle(node).opacity);
    const r = link.getBoundingClientRect();
    return opacity > .99 && r.top >= 0 && r.bottom <= innerHeight;
  })).toBe(true);
});
