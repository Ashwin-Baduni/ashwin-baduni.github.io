import type { Page } from "@playwright/test";
import { test, expect, open, sweep, stories, series, plateaus, scrollToY, frames } from "./helpers";

/*
  What the compositor actually shows during fast scrolling. Settled measurements cannot see a
  hold that is performed by JavaScript: the browser scrolls first and the script catches up a
  frame later, so the "held" element bobs. These tests record real frames while the page is
  scrolled at 3000px/s and find a marked element's top edge in each frame.

  Chromium: DevTools screencast frames carry the compositor's scroll offset, and the scroll is a
  synthesized wheel gesture handled off the main thread. Firefox and WebKit: Playwright's
  screencast during a burst of wheel events; held elements must stay still in every frame.
*/
const MARK = "#ff00ff";

type Window = { label: string; section: string; index: number; heading?: boolean; from: number; to: number; edge: number };

// Still windows found from the DOM: cards waiting at the bottom or parked, introductions waiting.
async function windows(page: Page): Promise<Window[]> {
  const screen = page.viewportSize()!.height;
  const found: Window[] = [];
  for (const story of (await stories(page)).filter((s) => s.on)) {
    const range = await page.evaluate((id) => {
      const rect = document.getElementById(id)!.getBoundingClientRect();
      return [rect.top + scrollY, rect.bottom + scrollY];
    }, story.section);
    // One frame per step, so positions set by scripts (not only by the browser) are included.
    const samples = await sweep(page, Math.max(0, Math.round(range[0] - screen)), Math.round(range[1]), 8, 1);
    for (let i = 1; i < story.cards; i++) {
      const points = series(samples, story.section, "card", i);
      const waiting = plateaus(points.filter((p) => p.top > screen * 0.6 && p.top < screen), 200)[0];
      const parked = plateaus(points.filter((p) => p.top < screen * 0.6), 200).at(-1);
      const card = { section: story.section, index: i };
      if (waiting) found.push({ label: `${story.section} card ${i} waiting`, ...card, from: waiting.from, to: waiting.to, edge: waiting.top });
      if (parked) found.push({ label: `${story.section} card ${i} parked`, ...card, from: parked.from, to: parked.to, edge: parked.top });
    }
    // The next section's heading, waiting below this story's final card.
    const order = [...new Set(samples[0].items.map((item) => item.section))];
    const following = order[order.indexOf(story.section) + 1];
    if (following) {
      const heading = plateaus(series(samples, following, "text", 0).filter((p) => p.top > screen * 0.6 && p.top < screen - 4 && p.opacity > 0), 100)[0];
      if (heading) found.push({ label: `${following} heading waiting`, section: following, index: 0, heading: true, from: heading.from, to: heading.to, edge: heading.top });
    }
  }
  return found;
}

async function edgeIn(page: Page, images: string[], x: number, near: number, type: string) {
  return page.evaluate(async ({ images, x, near, type }) => {
    const edges: number[] = [];
    for (const data of images) {
      const image = new Image();
      image.src = `data:${type};base64,${data}`;
      await image.decode();
      const canvas = new OffscreenCanvas(image.width, image.height);
      const context = canvas.getContext("2d")!;
      context.drawImage(image, 0, 0);
      const scale = image.height / innerHeight;
      const column = context.getImageData(Math.round(x * scale), 0, 1, image.height).data;
      let edge = -1;
      for (let y = Math.max(0, Math.round((near - 160) * scale)); y < image.height; y++) {
        const [r, g, b] = [column[y * 4], column[y * 4 + 1], column[y * 4 + 2]];
        if (r > 200 && g < 90 && b > 200) {
          edge = y / scale;
          break;
        }
      }
      edges.push(edge);
    }
    return edges;
  }, { images, x, near, type });
}

// Paints the chosen card, or a heading's first line, solid magenta (independent of how the page
// structures them); its introduction is made opaque so the colour is exact.
async function mark(page: Page, section: string, index: number, heading = false) {
  await page.addStyleTag({ content: `.e2e-mark{background:${MARK} !important;opacity:1 !important}.e2e-solid{opacity:1 !important}` });
  return page.evaluate(([section, index, heading]) => {
    const intro = document.querySelector<HTMLElement>(`#${section} [data-story-intro]`)!;
    const element = heading
      ? (intro.matches("h2") ? intro : intro.querySelector<HTMLElement>("h2, p")!)
      : document.querySelectorAll<HTMLElement>(`#${section} .stack-card`)[Number(index)];
    if (heading) intro.classList.add("e2e-solid");
    element.classList.add("e2e-mark");
    const rect = element.getBoundingClientRect();
    return heading ? rect.left + Math.min(rect.width, 120) / 2 : rect.left + rect.width / 2;
  }, [section, index, heading] as const);
}

test("held cards stay still in composited frames during fast scrolling", async ({ page, browserName }) => {
  await open(page);
  const found = await windows(page);
  expect(found.length).toBeGreaterThan(3);
  // Firefox and WebKit: one waiting and one parked window keep the run short.
  const desktop = await page.locator("html").getAttribute("data-desktop") === "on";
  expect(found.some((w) => w.heading), "only phone introductions wait as previews").toBe(!desktop);
  const chosen = browserName === "chromium" ? found : [found.find((w) => w.label.includes("card") && w.label.includes("waiting"))!, found.find((w) => w.label.includes("parked"))!, found.find((w) => w.heading)!];
  const failures: string[] = [];
  for (const w of chosen) {
    await scrollToY(page, w.from + 10, 300);
    const x = await mark(page, w.section, w.index, w.heading);
    const distance = Math.min(600, w.to - w.from - 60);
    let edges: number[];
    if (browserName === "chromium") {
      const cdp = await page.context().newCDPSession(page);
      const images: string[] = [];
      cdp.on("Page.screencastFrame", (frame) => {
        images.push(frame.data);
        cdp.send("Page.screencastFrameAck", { sessionId: frame.sessionId }).catch(() => {});
      });
      await cdp.send("Page.startScreencast", { format: "png", everyNthFrame: 1 });
      await page.waitForTimeout(200);
      await cdp.send("Input.synthesizeScrollGesture", { x: Math.round(x), y: 200, yDistance: -distance, speed: 3000, gestureSourceType: "mouse" });
      await page.waitForTimeout(400);
      await cdp.send("Page.stopScreencast");
      await cdp.detach();
      edges = await edgeIn(page, images, x, w.edge, "image/png");
    } else {
      const images: string[] = [];
      await page.screencast.start({ onFrame: ({ data }) => { images.push(data.toString("base64")); } });
      await page.waitForTimeout(200);
      // Firefox takes wheel events; mobile WebKit has none, so the page scrolls itself a step per frame.
      if (browserName === "firefox") for (let moved = 0; moved < distance; moved += 50) await page.mouse.wheel(0, 50);
      else
        await page.evaluate(async (distance) => {
          for (let moved = 0; moved < distance; moved += 50) {
            window.scrollBy(0, 50);
            await new Promise(requestAnimationFrame);
          }
        }, distance);
      await page.waitForTimeout(400);
      await page.screencast.stop();
      edges = await edgeIn(page, images, x, w.edge, "image/jpeg");
    }
    const seen = edges.filter((edge) => edge >= 0);
    const scrolled = await page.evaluate(() => scrollY);
    expect(seen.length, `${w.label}: marked edge visible in frames`).toBeGreaterThan(3);
    expect(scrolled, `${w.label}: the gesture scrolled`).toBeGreaterThan(w.from + 10 + distance * 0.5);
    const spread = Math.max(...seen) - Math.min(...seen);
    if (process.env.FRAMES_DEBUG) console.log(w.label, w.from, w.to, w.edge, JSON.stringify(seen.map(Math.round)));
    if (spread > 1.5) failures.push(`${w.label}: edge moved between ${Math.min(...seen).toFixed(1)} and ${Math.max(...seen).toFixed(1)}px while held`);
    await page.reload({ waitUntil: "networkidle" });
    await frames(page, 3);
  }
  expect(failures).toEqual([]);
});

test("rising cards follow the scroll exactly in composited frames", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "frame scroll offsets come from the Chromium DevTools protocol");
  await open(page);
  const screen = page.viewportSize()!.height;
  // Prefer a waiting card in a stack. Wide layouts may contain only product rows and the
  // shared Skills frame; their first card still has a native arrival that needs this check.
  const held = (await stories(page)).filter(s => s.on);
  const story = held.find(s => !s.row && !s.sharedFrame) ?? held[0];
  expect(story, "a held story has an arrival to inspect").toBeTruthy();
  const stacked = !story.row && !story.sharedFrame;
  const index = stacked ? 1 : 0;
  const range = await page.evaluate((id) => {
    const rect = document.getElementById(id)!.getBoundingClientRect();
    return [rect.top + scrollY, rect.bottom + scrollY];
  }, story.section);
  const samples = await sweep(page, Math.round(range[0] - screen), Math.round(range[1]), 8, 1);
  const points = series(samples, story.section, "card", index);
  const waiting = stacked ? plateaus(points.filter((p) => p.top > screen * 0.6 && p.top < screen), 200)[0] : undefined;
  const arrival = points.find(p => p.top <= screen * 0.85 && p.top > screen * 0.7 && p.opacity > 0);
  expect(stacked ? waiting : arrival, "the selected card has a visible rise").toBeTruthy();
  await scrollToY(page, waiting ? waiting.to - 40 : arrival!.y, 300);
  const x = await mark(page, story.section, index);
  const cdp = await page.context().newCDPSession(page);
  const frameList: Array<{ data: string; scroll: number }> = [];
  cdp.on("Page.screencastFrame", (frame) => {
    frameList.push({ data: frame.data, scroll: frame.metadata.scrollOffsetY! });
    cdp.send("Page.screencastFrameAck", { sessionId: frame.sessionId }).catch(() => {});
  });
  await cdp.send("Page.startScreencast", { format: "png", everyNthFrame: 1 });
  await page.waitForTimeout(200);
  await cdp.send("Input.synthesizeScrollGesture", { x: Math.round(x), y: 200, yDistance: -400, speed: 3000, gestureSourceType: "mouse" });
  await page.waitForTimeout(400);
  await cdp.send("Page.stopScreencast");
  // A final compositor event can already be in flight when stop resolves. Freeze one list
  // for both image decoding and the offsets, then cancel idle settling before direct probes.
  await cdp.detach();
  const captured = frameList.slice();
  await page.keyboard.press("Shift");
  // The first row's arrival can traverse the full gesture distance (there is no initial wait).
  // Scan the full column so the detector does not clip the final 40px of a 400px rise.
  const edges = await edgeIn(page, captured.map((f) => f.data), x, 0, "image/png");
  const errors: number[] = [];
  for (let k = 0; k < captured.length; k++) {
    if (edges[k] < 0) continue;
    // The settled position at the scroll offset that frame was composited with.
    await page.evaluate((y) => window.scrollTo({ top: y, behavior: "instant" }), captured[k].scroll);
    const settled = await page.evaluate(() => document.querySelector(".e2e-mark")!.getBoundingClientRect().top);
    if (settled > 0 && settled < screen - 2) errors.push(edges[k] - settled);
  }
  expect(errors.length, "frames during the rise").toBeGreaterThan(3);
  expect(Math.max(...errors.map(Math.abs)), `frame error vs settled position (${errors.map((e) => e.toFixed(1)).join(", ")})`).toBeLessThanOrEqual(2);
});
