import { test, expect, open, scrollToY } from "./helpers";
import type { Page } from "@playwright/test";

// Keep the real scrollbar in screenshots; Playwright normally hides it in Chromium.
test.use({ launchOptions: { ignoreDefaultArgs: ["--hide-scrollbars"] } });

// Read the rendered lane and content bounds, not the settling controller's state/decisions.
const ranges = (page: Page) => page.evaluate(() => {
  const top = (element: HTMLElement) => {
    let y = 0;
    for (let e: HTMLElement | null = element; e; e = e.offsetParent as HTMLElement | null) y += e.offsetTop;
    return y;
  };
  const max = document.documentElement.scrollHeight - innerHeight;
  const clamp = (y: number) => Math.max(0, Math.min(max, y));
  return [...document.querySelectorAll<HTMLElement>("[data-segment]")].map(section => {
    const root = section.querySelector<HTMLElement>(".stack");
    const deck = section.querySelector<HTMLElement>(".stack-cards");
    const lane = section.querySelector<HTMLElement>(".skills-stage-lane, .stack-lane");
    if (root?.dataset.stack === "on" && lane && deck) {
      const style = getComputedStyle(lane);
      const hold = parseFloat(style.getPropertyValue("--lane-hold"));
      const park = parseFloat(style.getPropertyValue("--lane-park"));
      const height = parseFloat(style.getPropertyValue("--lane-height"));
      return { id: section.id, start: clamp(top(deck) + hold - park), end: clamp(top(deck) + deck.offsetHeight - park - height) };
    }
    const content = section.querySelector<HTMLElement>(":scope > .wrap") ?? section;
    const height = content.offsetHeight;
    const inset = Math.max(16, (innerHeight - height) / 2);
    const start = clamp(top(content) - inset);
    return { id: section.id, start, end: Math.max(start, clamp(top(content) + height - innerHeight + inset)) };
  });
});

test("desktop wheel gestures settle between every section in both directions", async ({ page }) => {
  await open(page);
  const points = await ranges(page);
  await page.mouse.move(850, 350);
  for (const direction of [1, -1]) {
    const pairs = points.slice(1).map((next, i) => ({ previous: points[i], next }));
    for (const { previous, next } of direction > 0 ? pairs : pairs.toReversed()) {
      const gap = next.start - previous.end;
      if (gap < 30) continue;
      const y = previous.end + gap * (direction > 0 ? .56 : .44);
      const target = direction > 0 ? next.start : previous.end;
      await scrollToY(page, y - direction * 24, 250);
      await page.mouse.wheel(0, direction * 24);
      await expect(page.locator("html")).toHaveAttribute("data-settling", "on");
      await expect(page.locator("html")).not.toHaveAttribute("data-settling", "on");
      expect(Math.abs(await page.evaluate(() => scrollY) - target), `${previous.id} / ${next.id}, direction ${direction}`).toBeLessThan(2);
    }
  }
});

test("settling never advances a demonstration or responds to a programmatic scroll", async ({ page }) => {
  await open(page);
  const points = await ranges(page);
  for (const id of ["building", "kehsun", "focus"]) {
    const r = points.find(p => p.id === id)!;
    for (const part of [.2, .5, .8]) {
      await scrollToY(page, r.start + (r.end - r.start) * part, 300);
      const from = await page.evaluate(() => scrollY);
      await page.mouse.move(850, 350);
      await page.mouse.wheel(0, 50);
      await page.waitForTimeout(1200);
      expect(Math.abs(await page.evaluate(() => scrollY) - from - 50), `${id} remains controlled by the wheel`).toBeLessThan(2);
      await expect(page.locator("html")).not.toHaveAttribute("data-settling", "on");
    }
  }
  await page.keyboard.press("Shift");
  await scrollToY(page, 520, 1300);
  expect(await page.evaluate(() => scrollY), "a programmatic scroll never settles").toBe(520);
  await scrollToY(page, 720, 250);
  // Between sections even a small scroll goes on in its own direction: up to the Hero.
  await page.mouse.wheel(0, -20);
  await expect(page.locator("html")).toHaveAttribute("data-settling", "on");
  await expect(page.locator("html")).not.toHaveAttribute("data-settling", "on");
  expect(await page.evaluate(() => scrollY)).toBe(0);
});

// Where the page may rest: a section's resting point or inside its reading interval.
const restsAt = (points: Awaited<ReturnType<typeof ranges>>, y: number) => points.some(p => y > p.start - 2 && y < p.end + 2);

test("new input takes over an active settle at once; keys and clicks leave the page where it is", async ({ page }) => {
  await open(page);
  const points = await ranges(page);
  for (const type of ["wheel", "key", "pointer"]) {
    await page.keyboard.press("Shift");
    await scrollToY(page, 0, 250);
    await page.mouse.move(850, 350);
    await page.mouse.wheel(0, 500);
    await expect(page.locator("html")).toHaveAttribute("data-settling", "on");
    // Well inside the 0.3s fall.
    await page.waitForTimeout(40);
    if (type === "wheel") await page.mouse.wheel(0, -30);
    else if (type === "key") await page.keyboard.press("Shift");
    else { await page.mouse.down(); await page.mouse.up(); }
    await expect(page.locator("html"), `${type} stops the motion at once`).not.toHaveAttribute("data-settling", "on", { timeout: 150 });
    const cancelled = await page.evaluate(() => scrollY);
    expect(cancelled).toBeLessThan(780);
    await page.waitForTimeout(2800);
    await expect(page.locator("html")).not.toHaveAttribute("data-settling", "on");
    const final = await page.evaluate(() => scrollY);
    if (type === "wheel") expect(restsAt(points, final), `wheel input settles again from where it left the page (${final})`).toBe(true);
    else expect(Math.abs(final - cancelled), `${type} leaves the page where it is`).toBeLessThan(2);
  }
  await scrollToY(page, 0, 250);
  await page.mouse.wheel(0, 500);
  await expect(page.locator("html")).toHaveAttribute("data-settling", "on");
  // A programmatic click also cancels: no pointer event is needed to protect link navigation.
  await page.locator('#focus .skills-menu a[href="#focus-learning"]').evaluate((link: HTMLAnchorElement) => link.click());
  await page.waitForTimeout(1600);
  const anchor = await page.locator("#focus-learning").evaluate(e => e.getBoundingClientRect().top + scrollY);
  expect(Math.abs(await page.evaluate(() => scrollY) - anchor)).toBeLessThan(2);
});

test("phone previews stay and reduced motion or narrowing cancels desktop settling", async ({ page }) => {
  await open(page);
  await page.mouse.move(850, 350);
  await page.mouse.wheel(0, 500);
  await expect(page.locator("html")).toHaveAttribute("data-settling", "on");
  await page.setViewportSize({ width: 412, height: 812 });
  await page.waitForTimeout(1200);
  await expect(page.locator("html")).toHaveAttribute("data-desktop", "off");
  await expect(page.locator("html")).not.toHaveAttribute("data-settling", "on");
  await expect(page.locator("#experience .handoff-lane")).toHaveAttribute("data-handoff", "on");
  await scrollToY(page, 0, 250);
  await page.mouse.move(200, 350);
  await page.mouse.wheel(0, 500);
  await page.waitForTimeout(1400);
  expect(await page.evaluate(() => scrollY)).toBe(500);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.waitForTimeout(1200);
  await scrollToY(page, 0, 250);
  await page.mouse.move(850, 350);
  await page.mouse.wheel(0, 500);
  await page.waitForTimeout(1400);
  expect(await page.evaluate(() => scrollY)).toBe(500);
});

test("desktop has neutral dividers and no waiting section previews", async ({ page, browserName }) => {
  await open(page);
  await expect(page.locator("html")).toHaveAttribute("data-desktop", "on");
  expect(await page.locator('[data-handoff="on"]').count()).toBe(0);
  for (let i = 0; i < 4; i++) {
    const y = await page.locator("#focus .stack-anchor").nth(i).evaluate(e => e.getBoundingClientRect().top + scrollY);
    await scrollToY(page, y, 250);
    const colors = await page.locator("#focus .skills-menu-item").evaluateAll(items => items.slice(1).map(item => getComputedStyle(item).borderTopColor));
    expect(new Set(colors).size).toBe(1);
  }
  if (browserName === "chromium") {
    for (const selector of ["html", "body"]) {
      const gradient = await page.locator(selector).evaluate(e => getComputedStyle(e, "::-webkit-scrollbar-thumb").backgroundImage);
      expect(gradient).toContain("rgb(159, 211, 242)");
      expect(gradient).toContain("rgb(245, 191, 208)");
    }
  } else if (browserName === "firefox") {
    expect(await page.locator("html").evaluate(e => getComputedStyle(e).scrollbarColor)).toContain("159, 211, 242");
  }
});

test("product compositions are centred and Certifications settles as a compact footer", async ({ page }) => {
  for (const [width, height] of [[1280, 633], [1422, 704], [1280, 800], [1920, 1080]]) {
    await page.setViewportSize({ width, height });
    await open(page);
    const points = await ranges(page);
    for (const id of ["building", "kehsun"]) {
      const reading = points.find(p => p.id === id)!;
      for (const phase of [.25, .8, .25]) {
        await scrollToY(page, reading.start + phase * (reading.end - reading.start), 450);
        const space = await page.locator(`#${id}`).evaluate(section => {
          const top = Math.min(...[...section.querySelectorAll(".kind, .product-summary")].map(e => e.getBoundingClientRect().top));
          const bottom = Math.max(...[...section.querySelectorAll(".stack-card")].map(e => e.getBoundingClientRect().bottom));
          return { top, bottom: innerHeight - bottom };
        });
        expect(Math.abs(space.top - space.bottom), `${id}: balanced at ${width}×${height}`).toBeLessThan(2);
        expect(Math.min(space.top, space.bottom)).toBeGreaterThanOrEqual(14);
      }
    }
    const projects = points.find(p => p.id === "projects")!;
    const certifications = points.find(p => p.id === "certifications")!;
    await scrollToY(page, projects.start, 450);
    expect(await page.locator("#certifications-title").evaluate(e => e.getBoundingClientRect().top), "no certification preview while Projects is centred").toBeGreaterThanOrEqual(height);
    const footerHeight = await page.locator("#certifications").evaluate(e => e.getBoundingClientRect().height);
    expect(footerHeight, "Certifications is content-sized, not a full viewport").toBeLessThan(height * .55);
    expect(certifications.start - projects.end, "only the footer's height is left to scroll").toBeLessThanOrEqual(footerHeight + 1);
    expect(certifications.start - projects.end).toBeGreaterThan(60);
    await scrollToY(page, projects.end + (certifications.start - projects.end) * .6 - 24, 250);
    await page.mouse.move(width * .65, height * .55);
    await page.mouse.wheel(0, 24);
    await expect(page.locator("html")).toHaveAttribute("data-settling", "on");
    await expect(page.locator("html")).not.toHaveAttribute("data-settling", "on");
    expect(Math.abs(await page.evaluate(() => scrollY) - certifications.start)).toBeLessThan(2);
    const end = await page.locator("#certifications .wrap").evaluate(e => {
      const r = e.getBoundingClientRect();
      return {
        top: r.top, bottom: innerHeight - r.bottom,
        remaining: document.documentElement.scrollHeight - innerHeight - scrollY,
        opacity: getComputedStyle(e.querySelector("h2")!).opacity,
        reveals: [...e.querySelectorAll("[data-enter]")].map(el => Number(getComputedStyle(el).opacity)),
      };
    });
    expect(end.top, "the compact footer occupies the bottom of the screen").toBeGreaterThan(height * .4);
    expect(end.bottom, "Back to the top sits at the page bottom").toBeGreaterThanOrEqual(0);
    expect(end.bottom).toBeLessThanOrEqual(16);
    expect(Math.abs(end.remaining), "the final settle reaches the end of the page").toBeLessThan(2);
    expect(end.opacity).toBe("1");
    expect(end.reveals.every(opacity => opacity > .99), "the cards and return link finish revealing").toBe(true);
    // Reverse scrolling must still return to the Projects reading position.
    await scrollToY(page, projects.end + (certifications.start - projects.end) * .4 + 24, 250);
    await page.mouse.wheel(0, -24);
    await expect(page.locator("html")).toHaveAttribute("data-settling", "on");
    await expect(page.locator("html")).not.toHaveAttribute("data-settling", "on");
    expect(Math.abs(await page.evaluate(() => scrollY) - projects.end)).toBeLessThan(2);
  }
});

test.describe("painted scrollbar", () => {
  test("the actual viewport thumb contains blue and pink pixels", async ({ page, browserName }) => {
    test.skip(browserName !== "chromium", "Chromium custom thumb; Firefox's solid fallback is checked separately");
    await open(page);
    await scrollToY(page, 2200, 500);
    const png = (await page.screenshot()).toString("base64");
    const painted = await page.evaluate(async data => {
      const image = new Image(); image.src = `data:image/png;base64,${data}`; await image.decode();
      const canvas = new OffscreenCanvas(image.width, image.height);
      const ctx = canvas.getContext("2d")!; ctx.drawImage(image, 0, 0);
      const pixels = ctx.getImageData(image.width - 5, 0, 5, image.height).data;
      let blue = 0, pink = 0;
      for (let i = 0; i < pixels.length; i += 4) {
        const [r, g, b] = pixels.slice(i, i + 3);
        if (r > 140 && b > 225 && g - r > 20 && b - g > 8) blue++;
        if (r > 225 && g > 170 && r - g > 20 && b > g) pink++;
      }
      return { blue, pink };
    }, png);
    expect(painted.blue, "painted blue end of the thumb").toBeGreaterThan(10);
    expect(painted.pink, "painted pink end of the thumb").toBeGreaterThan(10);
  });
});

// Sample actual rendered geometry: scrollY alone cannot show whether sticky cards bounced.
const recordMotion = (page: Page, id: string, duration = 2700) => page.evaluate(({ id, duration }) =>
  new Promise<Array<{ y: number; top: number; card: number | null; height: number; previousBottom: number | null; t: number; settling: boolean }>>(resolve => {
    const section = document.getElementById(id)!;
    const heading = section.querySelector("h1, h2")!;
    const card = section.querySelector(".skills-stage, .stack-card");
    const values: Array<{ y: number; top: number; card: number | null; height: number; previousBottom: number | null; t: number; settling: boolean }> = [];
    const start = performance.now();
    const tick = () => {
      values.push({ y: scrollY, top: heading.getBoundingClientRect().top, card: card?.getBoundingClientRect().top ?? null,
        height: document.documentElement.scrollHeight,
        previousBottom: id === "certifications" ? Math.max(...[...document.querySelectorAll("#projects article")].map(e => e.getBoundingClientRect().bottom)) : null,
        t: performance.now() - start,
        settling: document.documentElement.dataset.settling === "on" });
      if (performance.now() - start > duration) resolve(values);
      else requestAnimationFrame(tick);
    };
    tick();
  }), { id, duration });

type Sample = Awaited<ReturnType<typeof recordMotion>>[number];

// The rendered heading along the correction: past the destination is positive, back towards
// where the gesture rested is negative. Falls take 0.3s and swings out 0.15s; the first overshoot
// is a third of the pull, at most 15% of the screen, and each later one a third of the last.
const swingOf = (samples: Sample[], correction: number) => {
  const final = samples.at(-1)!;
  const past = (s: Sample) => (final.top - s.top) * correction;
  const begin = samples.findIndex(s => s.settling);
  const active = samples.filter(s => s.settling);
  const peak = active.reduce((best, s) => past(s) > past(best) ? s : best);
  const crossed = active.findLast(s => s.t < peak.t && past(s) <= 0)!;
  // A motion that never comes back past the destination has no snap and no bounce.
  const returned = active.find(s => s.t > peak.t && past(s) <= 0);
  const end = samples.find(s => s.t > peak.t && !s.settling)!;
  return {
    resting: samples[Math.max(0, begin - 1)].y, peak, swing: past(peak),
    out: peak.t - crossed.t, back: returned ? returned.t - peak.t : Infinity,
    bounce: Math.max(0, ...active.filter(s => returned && s.t > returned.t).map(s => -past(s))),
    bouncing: returned ? end.t - returned.t : 0,
    duration: end.t - active[0].t,
  };
};
const expectPhysics = (motion: ReturnType<typeof swingOf>, distance: number, height: number, label: string) => {
  // WebKit can report the resting scroll position a few pixels late, hence 4%.
  const swing = Math.min(.33 * distance, .15 * height);
  expect(Math.abs(motion.swing - swing), `${label}: swing ${motion.swing} past a ${distance}px pull`).toBeLessThan(Math.max(2, swing * .04));
  expect(Math.abs(motion.out - 150), `${label}: swings out for ${motion.out}ms`).toBeLessThan(40);
  expect(Math.abs(motion.back - 300), `${label}: falls back in ${motion.back}ms`).toBeLessThan(50);
  expect(Math.abs(motion.bounce / motion.swing - .33), `${label}: bounce ${motion.bounce} on the other side`).toBeLessThan(.06);
};

test("a continuous decaying burst stays native, then is pulled in, swings past, snaps back and bounces to rest", async ({ page }) => {
  await open(page);
  await page.mouse.move(850, 350);
  let expected = 0;
  let previous = 0;
  for (const delta of [180, 120, 90, 60, 30, 15]) {
    expected += delta;
    await page.mouse.wheel(0, delta);
    await page.waitForTimeout(50);
    await expect(page.locator("html")).not.toHaveAttribute("data-settling", "on");
    const y = await page.evaluate(() => scrollY);
    expect(y).toBeGreaterThan(previous);
    expect(y).toBeLessThanOrEqual(expected + 1);
    previous = y;
  }
  const samples = await recordMotion(page, "about");
  const final = samples.at(-1)!;
  const motion = swingOf(samples, 1);
  expectPhysics(motion, 800 - motion.resting, 800, "about");
  const pull = samples.filter(s => s.settling && s.t < motion.peak.t && s.y < 799);
  expect(pull.every((s, i) => !i || s.y >= pull[i - 1].y), "the pull only moves towards the section").toBe(true);
  expect(Math.max(...samples.map(s => s.y)), "actual scroll never advances past the landing").toBeLessThanOrEqual(800);
  expect(Math.abs(final.y - 800)).toBeLessThan(2);
  expect(await page.locator(".about-copy .word").last().evaluate(e => Number(getComputedStyle(e).opacity))).toBe(1);
});

test("sticky sections and the page-end footer swing and bounce in both directions without extending the page", async ({ page }) => {
  await open(page);
  const points = await ranges(page);
  await page.mouse.move(850, 350);
  for (const id of ["building", "kehsun", "focus", "certifications", "top"]) {
    for (const direction of [1, -1]) {
      const index = points.findIndex(p => p.id === id);
      if ((!index && direction > 0) || (index === points.length - 1 && direction < 0)) continue;
      const r = points[index];
      const target = direction > 0 ? r.start : r.end;
      await page.keyboard.press("Shift");
      await scrollToY(page, target, 450);
      const expectedHeight = await page.evaluate(() => document.documentElement.scrollHeight);
      const words = await page.locator(`#${id} [data-rest-text]`).allTextContents();
      const neighbor = direction > 0 ? points[index - 1].end : points[index + 1].start;
      const from = target + (neighbor - target) * .3;
      await scrollToY(page, from - direction * 24, 300);
      await page.mouse.wheel(0, direction * 24);
      const samples = await recordMotion(page, id);
      const final = samples.at(-1)!;
      const motion = swingOf(samples, direction);
      expectPhysics(motion, Math.abs(target - motion.resting), 800, `${id}, direction ${direction}`);
      if (final.card !== null) {
        const cardMovement = Math.max(...samples.filter(s => s.settling).map(s => (final.card! - s.card!) * direction));
        expect(Math.abs(cardMovement - motion.swing), `${id}: cards move with the heading`).toBeLessThan(Math.max(2, motion.swing * .02));
      }
      expect(samples.every(s => s.height === expectedHeight), `${id}: no extra scrollable space`).toBe(true);
      expect(Math.abs(final.y - target)).toBeLessThan(2);
      expect(await page.locator(`#${id} [data-rest-text]`).allTextContents(), `${id}: rebound does not play the demo`).toEqual(words);
      expect(await page.locator(`#${id}`).evaluate((e: HTMLElement) => e.style.translate)).toBe("");
    }
  }
});

test("small and overshooting gestures reach the same adjacent section; repeated input can move on", async ({ page }) => {
  await open(page);
  const points = await ranges(page);
  const about = points.find(p => p.id === "about")!;
  await page.mouse.move(850, 350);
  for (const delta of [300, 950, 1500, 1900]) {
    await page.keyboard.press("Shift");
    await scrollToY(page, 0, 250);
    await page.mouse.wheel(0, delta);
    await expect(page.locator("html")).toHaveAttribute("data-settling", "on");
    await expect(page.locator("html")).not.toHaveAttribute("data-settling", "on");
    expect(Math.abs(await page.evaluate(() => scrollY) - about.start), `single ${delta}px gesture returns to About`).toBeLessThan(2);
  }
  await page.keyboard.press("Shift");
  await scrollToY(page, about.start, 250);
  await page.mouse.wheel(0, -550);
  await expect(page.locator("html")).toHaveAttribute("data-settling", "on");
  await expect(page.locator("html")).not.toHaveAttribute("data-settling", "on");
  expect(await page.evaluate(() => scrollY), "reverse gesture returns to Hero").toBe(0);

  await page.keyboard.press("Shift");
  await scrollToY(page, 0, 250);
  // Deliberate renewed impulses go past About, rather than returning to the first destination.
  for (const delta of [600, 300, 150, 600, 300, 150]) {
    await page.mouse.wheel(0, delta);
    await page.waitForTimeout(45);
  }
  await page.waitForTimeout(1900);
  expect(Math.abs(await page.evaluate(() => scrollY) - 2100)).toBeLessThan(2);
  await page.mouse.wheel(0, 40);
  await page.waitForTimeout(1700);
  expect(Math.abs(await page.evaluate(() => scrollY) - 2140), "a fresh gesture inside Vision does not reuse Hero's destination").toBeLessThan(2);

  for (const id of ["building", "kehsun", "focus"]) {
    const i = points.findIndex(p => p.id === id);
    await page.keyboard.press("Shift");
    await scrollToY(page, points[i - 1].end, 300);
    await page.mouse.wheel(0, points[i].start - points[i - 1].end + 300);
    await expect(page.locator("html")).toHaveAttribute("data-settling", "on");
    await expect(page.locator("html")).not.toHaveAttribute("data-settling", "on");
    expect(Math.abs(await page.evaluate(() => scrollY) - points[i].start), `${id}: one fling recovers to the entrance`).toBeLessThan(2);
  }
});

test("wheel input during the swing takes over at once, then the page settles from where it was left", async ({ page }) => {
  await open(page);
  const points = await ranges(page);
  await page.mouse.move(850, 350);
  await page.mouse.wheel(0, 500);
  await page.waitForFunction(() => {
    const value = getComputedStyle(document.getElementById("about")!).translate;
    return document.documentElement.dataset.settling === "on" && parseFloat(value.split(" ")[1]) < -40;
  });
  const before = await page.evaluate(() => scrollY);
  await page.mouse.wheel(0, 50);
  await expect(page.locator("html")).not.toHaveAttribute("data-settling", "on", { timeout: 150 });
  await page.waitForFunction(before => scrollY - before >= 48, before);
  expect(await page.evaluate(() => scrollY) - before, "the wheel moves the page natively").toBeLessThanOrEqual(51);
  await page.waitForTimeout(2800);
  await expect(page.locator("html")).not.toHaveAttribute("data-settling", "on");
  expect(restsAt(points, await page.evaluate(() => scrollY)), "then it settles on a section").toBe(true);
  expect(await page.locator("#about").evaluate((e: HTMLElement) => e.style.translate)).toBe("");
});

// Firefox caps one large wheel event below a screenful. A short burst models one gesture
// without that per-event cap, so the recovery tests genuinely begin past the destination.
const fastGesture = async (page: Page, delta: number) => {
  const direction = Math.sign(delta);
  for (let remaining = Math.abs(delta); remaining > 0; remaining -= 500)
    await page.mouse.wheel(0, direction * Math.min(500, remaining));
};

test("native overtravel is pulled back, swings past against the input and bounces in both directions", async ({ page }) => {
  await open(page);
  const points = await ranges(page);
  await page.mouse.move(850, 350);
  for (const id of ["about", "building", "kehsun", "focus", "projects"]) {
    const index = points.findIndex(p => p.id === id);
    for (const direction of [1, -1]) {
      const target = direction > 0 ? points[index].start : points[index].end;
      const origin = direction > 0 ? points[index - 1].end : points[index + 1].start;
      await page.keyboard.press("Shift");
      await scrollToY(page, target, 450);
      const expectedHeight = await page.evaluate(() => document.documentElement.scrollHeight);
      const words = await page.locator(`#${id} [data-rest-text]`).allTextContents();
      await scrollToY(page, origin, 300);
      await fastGesture(page, target - origin + direction * 240);
      const samples = await recordMotion(page, id);
      const final = samples.at(-1)!;
      const active = samples.filter(s => s.settling);
      expect((active[0].y - target) * direction, `${id}: native input really passed the destination`).toBeGreaterThan(200);
      // The section pulls the page back, and the swing passes it against the original input.
      const motion = swingOf(samples, -direction);
      expectPhysics(motion, Math.abs(target - motion.resting), 800, `${id}, direction ${direction}`);
      if (final.card !== null) {
        expect(Math.abs((motion.peak.card! - final.card) * direction - motion.swing), `${id}: the card follows its heading`).toBeLessThan(Math.max(2, motion.swing * .02));
      }
      // The first sampled frame can precede the browser applying the wheel. Only automatic
      // motion is constrained to the recovery side; native input first crosses the target.
      expect(active.every(s => (s.y - target) * direction >= -1), `${id}: visual overshoot never scrolls beyond the destination`).toBe(true);
      expect(samples.every(s => s.height === expectedHeight), `${id}: page height is stable`).toBe(true);
      expect(Math.abs(final.y - target)).toBeLessThan(2);
      expect(await page.locator(`#${id} [data-rest-text]`).allTextContents()).toEqual(words);
      expect(await page.locator("[data-segment]").evaluateAll(sections => sections.every(e => !(e as HTMLElement).style.translate))).toBe(true);
    }
  }
});

test("fresh wheel input interrupts a reverse swing at once, then the page settles from there", async ({ page }) => {
  await open(page);
  const points = await ranges(page);
  const index = points.findIndex(p => p.id === "about");
  await page.mouse.move(850, 350);
  for (const direction of [1, -1]) {
    const target = direction > 0 ? points[index].start : points[index].end;
    const origin = direction > 0 ? points[index - 1].end : points[index + 1].start;
    await page.keyboard.press("Shift");
    await scrollToY(page, origin, 300);
    await fastGesture(page, target - origin + direction * 240);
    await expect(page.locator("html")).toHaveAttribute("data-settling", "on");
    // Interrupt while the swing past the destination is visibly in progress.
    await page.waitForFunction(direction => document.documentElement.dataset.settling === "on" &&
      parseFloat(getComputedStyle(document.getElementById("about")!).translate.split(" ")[1]) * direction > 20, direction);
    const before = await page.evaluate(() => scrollY);
    await page.mouse.wheel(0, direction * 50);
    await expect(page.locator("html")).not.toHaveAttribute("data-settling", "on", { timeout: 150 });
    await page.waitForFunction(({ before, direction }) => (scrollY - before) * direction >= 48, { before, direction });
    await page.waitForTimeout(2800);
    await expect(page.locator("html")).not.toHaveAttribute("data-settling", "on");
    expect(restsAt(points, await page.evaluate(() => scrollY)), "then it settles on a section").toBe(true);
    expect(await page.locator("[data-segment]").evaluateAll(sections => sections.every(e => !(e as HTMLElement).style.translate))).toBe(true);
  }
});

test("explicit late momentum keeps the original destination, while fresh input goes on from where it is", async ({ page }) => {
  await open(page);
  const points = await ranges(page);
  await page.mouse.move(850, 350);
  for (const momentum of [true, false]) {
    await page.keyboard.press("Shift");
    await scrollToY(page, 0, 300);
    await page.mouse.wheel(0, 950);
    await expect(page.locator("html")).toHaveAttribute("data-settling", "on");
    await page.waitForTimeout(250);
    // WheelEvent.momentum is not exposed by every test engine. Define the optional signal on
    // this event explicitly, modelling a late native movement before its passive listener runs.
    const nativeEnd = await page.evaluate(momentum => {
      window.scrollBy({ top: 50, behavior: "instant" });
      const event = new WheelEvent("wheel", { bubbles: true, deltaY: 50 });
      Object.defineProperty(event, "momentum", { value: momentum });
      document.elementFromPoint(850, 350)!.dispatchEvent(event);
      return scrollY;
    }, momentum);
    await page.waitForTimeout(2800);
    // Fresh input starts a gesture of its own: from between sections it goes on downwards.
    const expected = momentum ? 800 : points.find(p => p.start > nativeEnd + 2)!.start;
    expect(Math.abs(await page.evaluate(() => scrollY) - expected)).toBeLessThan(2);
  }
});

test("the swing follows the pull up to its limit at any viewport, and keeps footer clearance", async ({ page }) => {
  for (const [width, height] of [[1280, 633], [1920, 1080]]) {
    await page.setViewportSize({ width, height });
    await open(page);
    const points = await ranges(page);
    await page.mouse.move(width * .6, height * .4);
    for (const id of ["building", "certifications"]) {
      const index = points.findIndex(p => p.id === id);
      const r = points[index];
      await page.keyboard.press("Shift");
      const from = r.start - (r.start - points[index - 1].end) * .2;
      await scrollToY(page, from - 20, 300);
      await page.mouse.wheel(0, 20);
      const samples = await recordMotion(page, id);
      const motion = swingOf(samples, 1);
      expectPhysics(motion, r.start - motion.resting, height, `${id} at ${width}×${height}`);
      if (id === "certifications") {
        expect(Math.min(...samples.map(s => s.top - s.previousBottom!)), "footer rebound remains clear of Projects").toBeGreaterThan(16);
      }
      expect(new Set(samples.map(s => s.height)).size, "the rebound does not extend the page").toBe(1);
      expect(await page.locator("[data-segment]").evaluateAll(sections => sections.every(e => !(e as HTMLElement).style.translate))).toBe(true);
    }
  }
});
