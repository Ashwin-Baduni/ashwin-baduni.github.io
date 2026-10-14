import type { Page } from "@playwright/test";
import { test, expect, open, sweep, stories, series, plateaus, scrollToY, frames, CLEARANCE, clearanceFailures, documentOrder, transformFailures } from "./helpers";

/*
  MihawkAI on a wide screen: Vision Tech and Yoru side by side. Judged from rendered rectangles,
  opacities and what each demonstration visibly shows, never from the planner's numbers. Then the
  fallbacks (too short to hold, reduced motion, landscape phones), the arrangement boundary, and
  switching between the row and the stack as the window, a parent's width or the text size changes.
*/
const SIZES = [[1024, 768], [1280, 720], [1280, 800], [1366, 768], [1440, 900], [1920, 1080]];

const sectionRange = (page: Page, id: string) =>
  page.evaluate((id) => {
    const rect = document.getElementById(id)!.getBoundingClientRect();
    return [rect.top + scrollY, rect.bottom + scrollY];
  }, id);

// What each demonstration visibly shows. Opacities are within the card, so the story's own fade
// does not count as an unfinished demonstration.
function demos(page: Page) {
  return page.evaluate(() => {
    const [vision, yoru] = [...document.querySelectorAll<HTMLElement>("#building .stack-card")];
    const within = (card: Element, selector: string) => {
      let value = 1;
      for (let node: Element | null = card.querySelector(selector); node && node !== card; node = node.parentElement) value *= Number(getComputedStyle(node).opacity);
      return value;
    };
    const plate = [...vision.querySelectorAll(".mseq-plate-num tspan")];
    return {
      // Plate characters read so far (spaces are always shown), and the recorded event.
      read: plate.filter((tspan) => tspan.textContent !== "·" && tspan.textContent !== " ").length,
      box: within(vision, ".mseq-plate-box"),
      record: within(vision, ".mseq-record"),
      // Characters of the question typed so far, and the history Yoru opens.
      typed: yoru.querySelector(".mseq-q")!.textContent!.length,
      answer: within(yoru, ".mseq-answer"),
    };
  });
}

function row(page: Page) {
  return page.evaluate(() => {
    const root = document.querySelector<HTMLElement>("#building .stack")!;
    const effective = (element: Element) => {
      let value = 1;
      for (let node: Element | null = element; node; node = node.parentElement) value *= Number(getComputedStyle(node).opacity);
      return value;
    };
    const cards = [...root.querySelectorAll<HTMLElement>(".stack-card")].map((card) => {
      const rect = card.getBoundingClientRect();
      return { top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right, height: rect.height, opacity: effective(card) };
    });
    const intro = root.querySelector(".stack-intro")!.getBoundingClientRect();
    const camera = root.querySelector(".mseq-camera")!.getBoundingClientRect();
    const content = root.querySelector(".vision-card .product-card-content")!;
    const inner = content.clientWidth - parseFloat(getComputedStyle(content).paddingLeft) - parseFloat(getComputedStyle(content).paddingRight);
    const heading = document.querySelector<HTMLElement>("#kehsun [data-story-intro] h2, #kehsun [data-story-intro] p")!;
    const text = heading.getBoundingClientRect();
    return {
      held: root.dataset.stack === "on",
      arrangement: root.dataset.arrangement ?? "",
      cards,
      introBottom: intro.bottom,
      camera: { ratio: camera.width / camera.height, fill: camera.width / inner },
      kehsun: { top: text.top, left: text.left, right: text.right, opacity: effective(heading) },
    };
  });
}

for (const [width, height] of SIZES)
  test(`MihawkAI shows Vision and Yoru as a row at ${width}x${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await open(page);
    const screen = height;
    const story = (await stories(page)).find((s) => s.section === "building")!;
    expect(story, "MihawkAI is held as a row").toMatchObject({ on: true, row: true });
    const [top] = await sectionRange(page, "building");
    const [, kehsunBottom] = await sectionRange(page, "kehsun");
    const samples = await sweep(page, Math.max(0, Math.round(top - screen)), Math.round(kehsunBottom), 4);
    expect(transformFailures(samples, screen), "nothing is moved by scroll-linked transforms").toEqual([]);
    expect(clearanceFailures(samples, screen, await documentOrder(page)).slice(0, 8), "the Kehsun heading keeps its clearance").toEqual([]);

    // Level, equal, side by side and equally faded at every position.
    const [vision, yoru] = [0, 1].map((i) => series(samples, "building", "card", i));
    for (let k = 0; k < samples.length; k++) {
      const [a, b] = [vision[k], yoru[k]];
      if (a.bottom < 0 || a.top > screen) continue;
      expect(Math.abs(a.top - b.top), `the cards are level at ${a.y}`).toBeLessThanOrEqual(0.5);
      expect(Math.abs(a.bottom - b.bottom), `the cards are equally tall at ${a.y}`).toBeLessThanOrEqual(0.5);
      expect(a.right, `the cards sit side by side at ${a.y}`).toBeLessThan(b.left);
      expect(Math.abs(a.opacity - b.opacity), `the cards fade together at ${a.y}`).toBeLessThanOrEqual(0.01);
    }
    // The row rises faintly into view from the bottom edge, like a stack's first card.
    const first = vision.find((p) => p.opacity > 0.01 && p.top < screen)!;
    expect(first.top, "the row is visible as soon as it enters at the bottom edge").toBeGreaterThanOrEqual(screen * 0.97);
    expect(first.opacity, "the row enters faint").toBeLessThanOrEqual(0.3);
    // The introduction arrives first, then the row rises and parks below it; both leave together.
    const intro = plateaus(series(samples, "building", "intro", 0), 40).filter((run) => run.top >= 0 && run.top < screen * 0.5).at(-1)!;
    expect(intro, "the introduction is held").toBeTruthy();
    const parked = plateaus(vision.filter((p) => p.top < screen * 0.6), 40).at(-1)!;
    expect(parked.from - intro.from, "the row is still rising when the introduction settles").toBeGreaterThan(screen * 0.1);
    expect(Math.abs(intro.to - parked.to), "the introduction leaves with the row").toBeLessThanOrEqual(4);
    expect(Math.abs(plateaus(yoru.filter((p) => p.top < screen * 0.6), 40).at(-1)!.from - parked.from), "both cards park together").toBeLessThanOrEqual(4);

    await scrollToY(page, parked.from + 4, 700);
    const settled = await row(page);
    expect(settled.cards[0].top - settled.introBottom, "the row parks just below the introduction").toBeGreaterThanOrEqual(10);
    expect(settled.cards[0].bottom, "the parked row fits on screen").toBeLessThanOrEqual(screen);
    // Vision's camera fills its card's width without distortion.
    expect(Math.abs(settled.camera.ratio - 1.6), "the camera keeps its 16:10 picture").toBeLessThanOrEqual(0.02);
    expect(settled.camera.fill, "the camera uses the card's full width").toBeGreaterThan(0.99);
    // Desktop has no waiting preview. Kehsun arrives later in ordinary document flow.
    await expect(page.locator("#kehsun .stack-intro-track")).toHaveAttribute("data-handoff", "off");
    expect(settled.kehsun.top, "Kehsun is below the screen when Mihawk parks").toBeGreaterThanOrEqual(screen);
    expect(settled.kehsun.top - settled.cards[0].bottom, "Kehsun's heading clears the row").toBeGreaterThanOrEqual(CLEARANCE);

    // Walk through the held interval: both demonstrations start and finish together, then the
    // completed row stays fully visible for a quarter of a screen before the story leaves and fades.
    const step = Math.round(screen * 0.04);
    const walk: Array<{ y: number; top: number; opacity: number; demo: Awaited<ReturnType<typeof demos>> }> = [];
    for (let y = parked.from + 2; y <= parked.to + screen * 0.2; y += step) {
      await scrollToY(page, y, 500);
      const now = await row(page);
      walk.push({ y, top: now.cards[0].top, opacity: Math.min(now.cards[0].opacity, now.cards[1].opacity), demo: await demos(page) });
    }
    expect(walk[0].demo, "nothing has played when the row parks").toMatchObject({ read: 0, typed: 0 });
    expect(walk[0].demo.box, "nothing has played when the row parks").toBeLessThanOrEqual(0.05);
    const index = (done: (d: (typeof walk)[number]["demo"]) => boolean) => walk.findIndex((w) => done(w.demo));
    const starts = [index((d) => d.read > 0 || d.box > 0.05), index((d) => d.typed > 0)];
    const ends = [index((d) => d.record >= 0.98), index((d) => d.answer >= 0.98)];
    expect(starts.every((i) => i > 0), "both demonstrations start after parking").toBe(true);
    expect(Math.abs(starts[0] - starts[1]), `both demonstrations start together (${starts})`).toBeLessThanOrEqual(1);
    expect(ends.every((i) => i > 0), "both demonstrations finish").toBe(true);
    expect(Math.abs(ends[0] - ends[1]), `both demonstrations finish together (${ends})`).toBeLessThanOrEqual(1);
    const complete = walk[Math.max(...ends)].y;
    const leaving = walk.find((w) => w.top < walk[0].top - 0.5)!;
    const fading = walk.find((w) => w.opacity < 0.99)!;
    expect(leaving.y - complete, "the completed row is read for a quarter of a screen").toBeGreaterThanOrEqual(screen * 0.25 - step);
    expect(Math.abs(fading.y - leaving.y), "fading begins as the story leaves").toBeLessThanOrEqual(step);
    for (const w of walk.filter((w) => w.y >= complete && w.y < leaving.y))
      expect(w.opacity, `the completed row is fully visible at ${w.y}`).toBeGreaterThanOrEqual(0.99);
    // Scrolling back restores every state on the way.
    for (const w of walk.toReversed()) {
      await scrollToY(page, w.y, 500);
      const now = await row(page);
      expect(Math.abs(now.cards[0].top - w.top), `position at ${w.y} going back`).toBeLessThanOrEqual(0.5);
      expect(Math.abs(Math.min(now.cards[0].opacity, now.cards[1].opacity) - w.opacity), `opacity at ${w.y} going back`).toBeLessThanOrEqual(0.02);
      expect(await demos(page), `demonstrations at ${w.y} going back`).toEqual(w.demo);
    }
  });

test("a desktop window too short to hold the row shows both cards side by side, finished", async ({ page }) => {
  // At 560px tall Vision's camera shrinks a little and the row is still held; at 480px Yoru alone
  // is taller than the room below the introduction.
  await page.setViewportSize({ width: 1280, height: 480 });
  await open(page);
  const story = (await stories(page)).find((s) => s.section === "building")!;
  expect(story, "MihawkAI keeps the row arrangement, unheld").toMatchObject({ on: false, row: true });
  const state = await page.evaluate(() => {
    const root = document.querySelector<HTMLElement>("#building .stack")!;
    const cards = [...root.querySelectorAll<HTMLElement>(".stack-card")];
    const rects = cards.map((card) => card.getBoundingClientRect());
    return {
      reason: root.dataset.storyFit ?? "",
      level: Math.abs(rects[0].top - rects[1].top),
      equal: Math.abs(rects[0].height - rects[1].height),
      sideBySide: rects[0].right < rects[1].left,
      clipped: cards.filter((card) => card.scrollHeight > card.clientHeight + 1).length,
      wording: [...root.querySelectorAll<HTMLElement>("[data-rest-text]")].every((element) => element.textContent === element.dataset.restText),
      finished: [".mseq-record", ".mseq-answer"].map((selector) => Number(getComputedStyle(root.querySelector(selector)!).opacity)),
    };
  });
  expect(state.reason, "the plain layout explains itself").toMatch(/the row needs/);
  expect(state).toMatchObject({ level: 0, equal: 0, sideBySide: true, clipped: 0, wording: true, finished: [1, 1] });
  // The rest of the page is unaffected: nothing collides on the way through.
  const [top] = await sectionRange(page, "building");
  const [, end] = await sectionRange(page, "kehsun");
  const samples = await sweep(page, Math.round(top - 480), Math.round(end), 12);
  expect(clearanceFailures(samples, 480, await documentOrder(page)).slice(0, 8)).toEqual([]);
});

test("reduced motion on a desktop shows the row finished and still", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1280, height: 800 });
  await open(page);
  const state = await page.evaluate(() => {
    const root = document.querySelector<HTMLElement>("#building .stack")!;
    const rects = [...root.querySelectorAll(".stack-card")].map((card) => card.getBoundingClientRect());
    return {
      held: root.dataset.stack,
      sideBySide: rects[0].right < rects[1].left && Math.abs(rects[0].top - rects[1].top) < 0.5,
      moved: [...root.querySelectorAll(".stack-card, .stack-lane, [data-story-intro]")].filter((element) => getComputedStyle(element).transform !== "none").length,
      unfinished: [...root.querySelectorAll(".mseq-record, .mseq-answer")].filter((element) => Number(getComputedStyle(element).opacity) < 0.99).length,
      wording: [...root.querySelectorAll<HTMLElement>("[data-rest-text]")].every((element) => element.textContent === element.dataset.restText),
    };
  });
  expect(state).toEqual({ held: "off", sideBySide: true, moved: 0, unfinished: 0, wording: true });
});

// Space decides, never the device: the row needs 28em per card plus the gap (57.5em in all).
test("the row appears exactly where two readable cards fit, and never on landscape phones", async ({ page }) => {
  for (const [width, height] of [[999, 768], [1000, 768], [1100, 700], [960, 800], [844, 390], [932, 430], [768, 1024]]) {
    await page.setViewportSize({ width, height });
    await open(page);
    const { room, row } = await page.evaluate(() => {
      const root = document.querySelector<HTMLElement>("#building .stack")!;
      const em = parseFloat(getComputedStyle(root).fontSize);
      return { room: root.clientWidth / em >= 57.5, row: root.dataset.arrangement === "row" };
    });
    expect(row, `${width}x${height}: row only where two 28em cards fit`).toBe(room);
    if ([844, 932, 768].includes(width)) expect(row, `${width}x${height} keeps the phone stack`).toBe(false);
  }
});

/*
  Switching. Each change leaves the page exactly as a fresh load in the same conditions shows it:
  the same layout, positions and fades, one controller's lanes and markers, and the reading
  position kept on the story.
*/
type Conditions = { width: number; height: number; text?: number; parent?: number };
const CSS = (c: Conditions) =>
  [c.text ? `html { font-size: ${c.text}% }` : "", c.parent ? `#building .wrap { max-width: ${c.parent}px }` : ""].join("\n");

async function apply(page: Page, c: Conditions) {
  await page.setViewportSize({ width: c.width, height: c.height });
  await page.evaluate((css) => {
    let style = document.getElementById("e2e-conditions");
    if (!style) {
      style = document.createElement("style");
      style.id = "e2e-conditions";
      document.head.append(style);
    }
    style.textContent = css;
  }, CSS(c));
  await frames(page, 3);
  await page.waitForTimeout(600);
}

async function snapshot(page: Page) {
  const [top] = await sectionRange(page, "building");
  const [, end] = await sectionRange(page, "kehsun");
  const samples = await sweep(page, Math.round(top), Math.round(end), 40, 2);
  const marks = await page.evaluate(() => {
    const root = document.querySelector<HTMLElement>("#building .stack")!;
    // Declarations in any order: the order only records which was first set.
    const style = (element: Element) => (element.getAttribute("style") ?? "").split(";").map((part) => part.trim()).filter(Boolean).toSorted();
    return {
      arrangement: root.dataset.arrangement ?? "",
      held: root.dataset.stack,
      fit: root.dataset.storyFit ?? "",
      deck: style(root),
      lanes: [...root.querySelectorAll(".stack-lane")].map(style),
      active: [...root.querySelectorAll<HTMLElement>(".stack-card")].map((card) => card.dataset.active ?? ""),
      probes: document.querySelectorAll('body > div[aria-hidden="true"]').length,
    };
  });
  return {
    marks,
    samples: samples.map(({ y, items }) => ({
      y,
      items: items.filter((it) => it.kind !== "content").map((it) => [Math.round(it.top), Math.round(it.left), Math.round(it.opacity * 20) / 20]),
    })),
  };
}

async function fresh(page: Page, c: Conditions) {
  const other = await page.context().newPage();
  await other.setViewportSize({ width: c.width, height: c.height });
  await other.addInitScript((css) => {
    document.addEventListener("DOMContentLoaded", () => {
      const style = document.createElement("style");
      style.id = "e2e-conditions";
      style.textContent = css;
      document.head.append(style);
    });
  }, CSS(c));
  await open(other);
  const result = await snapshot(other);
  await other.close();
  return result;
}

test("switching between the row and the stack settles like a fresh load and keeps the reading position", async ({ page }) => {
  const start: Conditions = { width: 1280, height: 800 };
  await page.setViewportSize({ width: start.width, height: start.height });
  await open(page);
  const steps: Array<[string, Conditions, "row" | "stack"]> = [
    ["narrower window", { width: 900, height: 800 }, "stack"],
    ["wider window", start, "row"],
    ["narrower window again", { width: 900, height: 800 }, "stack"],
    ["wider window again", start, "row"],
    ["larger text", { ...start, text: 125 }, "stack"],
    ["text back to normal", start, "row"],
    ["narrower parent", { ...start, parent: 800 }, "stack"],
    ["parent restored", start, "row"],
    ["larger text again", { ...start, text: 125 }, "stack"],
    ["text back to normal again", start, "row"],
  ];
  for (const [label, conditions, expected] of steps) {
    // Read the middle of the story, then change the conditions.
    const [top] = await sectionRange(page, "building");
    await scrollToY(page, Math.round(top + conditions.height * 1.3), 500);
    const before = (await stories(page)).find((s) => s.section === "building")!;
    expect(before.on, `${label}: MihawkAI is held before the change`).toBe(true);
    await apply(page, conditions);
    const story = (await stories(page)).find((s) => s.section === "building")!;
    expect(story.row ? "row" : "stack", `${label}: arrangement`).toBe(expected);
    // The page returns to what was being read: in the stack, Vision parked below the introduction and
    // uncovered; in the row, both cards parked with their demonstrations complete.
    const shown = await page.evaluate(() => {
      const root = document.querySelector<HTMLElement>("#building .stack")!;
      const introElement = root.querySelector(".stack-intro")!;
      const intro = introElement.getBoundingClientRect();
      const introPark = parseFloat(getComputedStyle(introElement).top);
      const cards = [...root.querySelectorAll<HTMLElement>(".stack-card")];
      const rects = cards.map((card) => card.getBoundingClientRect());
      return cards.map((card, i) => {
        const rect = rects[i];
        const finished = card.querySelector(".mseq-record, .mseq-answer")!;
        // A finished demonstration also shows its finished wording: the plate read, the question typed.
        const wording = [...card.querySelectorAll<HTMLElement>("[data-rest-text]")].every((element) => element.textContent === element.dataset.restText);
        return {
          parked: Math.abs(rect.top - intro.bottom) < 40 && intro.top >= 0 &&
            Math.abs(intro.top - introPark) < 1 && rect.bottom <= innerHeight,
          // No part of the card lies under a card above it (later cards cover earlier ones).
          uncovered: rects.every((other, j) => j <= i || other.top >= rect.bottom - 0.5 || other.bottom <= rect.top + 0.5 || other.left >= rect.right || other.right <= rect.left),
          finished: Number(getComputedStyle(finished).opacity) > 0.98 && wording,
        };
      });
    });
    // Each change starts from a completed demonstration, so the page returns to one: Yoru, after
    // both, in the stack (the row was complete), and the completed row (Vision was complete).
    if (expected === "stack") expect(shown[1], `${label}: Yoru, complete, is on show again`).toEqual({ parked: true, uncovered: true, finished: true });
    else expect(shown, `${label}: the completed row is on show again`).toEqual([{ parked: true, uncovered: true, finished: true }, { parked: true, uncovered: true, finished: true }]);
  }
  // After all of that, each condition matches a fresh load.
  for (const conditions of [start, { width: 900, height: 800 }, { ...start, text: 125 }, { ...start, parent: 800 }]) {
    await apply(page, conditions);
    const now = await snapshot(page);
    const expected = await fresh(page, conditions);
    const label = JSON.stringify(conditions);
    expect(now.marks, `${label}: one controller's lanes and markers`).toEqual(expected.marks);
    expect(now.samples.length).toBe(expected.samples.length);
    const differences = now.samples.flatMap((sample, k) =>
      sample.items.flatMap(([top, left, opacity], i) => {
        const [t, l, o] = expected.samples[k].items[i];
        return Math.abs(top - t) > 1 || Math.abs(left - l) > 1 || Math.abs(opacity - o) > 0.05 ? [`y=${sample.y} item ${i}: ${top},${left}/${opacity} vs fresh ${t},${l}/${o}`] : [];
      }),
    );
    expect(differences.slice(0, 10), `${label}: matches a fresh load`).toEqual([]);
  }
});

/*
  Switching in the middle of the demonstrations. What each demonstration shows (plate characters,
  scan, camera zoom and record; Yoru's question, status, results and history) must continue from
  the same point after the layout changes, and every state on the way forward and back must be
  exactly what a freshly loaded page shows at the same position.
*/
function shows(page: Page) {
  return page.evaluate(() => {
    const [vision, yoru] = [...document.querySelectorAll<HTMLElement>("#building .stack-card")];
    const within = (card: Element, selector: string) => {
      let value = 1;
      for (let node: Element | null = card.querySelector(selector); node && node !== card; node = node.parentElement) value *= Number(getComputedStyle(node).opacity);
      return Math.round(value * 100) / 100;
    };
    const zoom = vision.querySelector(".mseq-subject")!.getAttribute("transform") ?? "";
    return {
      plate: vision.querySelector(".mseq-plate-num")!.textContent,
      scan: within(vision, ".mseq-scan"),
      zoom: Math.round(Number(/matrix\(([-\d.]+)/.exec(zoom)?.[1] ?? 1) * 100) / 100,
      record: within(vision, ".mseq-record"),
      question: yoru.querySelector(".mseq-q")!.textContent,
      status: yoru.querySelector(".mseq-status")!.textContent,
      results: within(yoru, ".mseq-evidence"),
      history: within(yoru, ".mseq-answer"),
    };
  });
}
type Shown = Awaited<ReturnType<typeof shows>>;

async function freshShows(page: Page, width: number, height: number, positions: number[]) {
  const other = await page.context().newPage();
  await other.setViewportSize({ width, height });
  await open(other);
  const result: Shown[] = [];
  for (const y of positions) {
    await other.evaluate((y) => window.scrollTo({ top: y, behavior: "instant" }), y);
    await frames(other, 2);
    await other.waitForTimeout(700);
    result.push(await shows(other));
  }
  await other.close();
  return result;
}

// Positions where the parked card(s) are part-way through, found from what is shown.
async function midway(page: Page, card: number, done: (s: Shown) => boolean) {
  const [top] = await sectionRange(page, "building");
  const screen = page.viewportSize()!.height;
  const samples = await sweep(page, Math.round(top), Math.round(top + screen * 4), 8, 1);
  const parked = plateaus(series(samples, "building", "card", card).filter((p) => p.top < screen * 0.6), 40).at(-1)!;
  for (let y = parked.from; y < parked.to; y += Math.round(screen * 0.02)) {
    await scrollToY(page, y, 600);
    if (done(await shows(page))) return y;
  }
  throw new Error("no position part-way through the demonstrations");
}

test("switching mid-demonstration continues from the same point and matches a fresh page, both ways", async ({ page }) => {
  const row = { width: 1280, height: 800 };
  const stack = { width: 900, height: 800 };
  await page.setViewportSize(row);
  await open(page);
  const read = (s: Shown) => s.plate!.replace(/[ ·]/g, "").length;
  // Row: both demonstrations part-way, the plate partly read and the question partly typed.
  await midway(page, 0, (s) => read(s) > 1 && read(s) < 10 && s.question!.length > 3 && s.question!.length < 30);
  const before = await shows(page);
  await page.setViewportSize(stack);
  await frames(page, 3);
  await page.waitForTimeout(900);
  const after = await shows(page);
  // In the stack, Vision continues from the same point; Yoru has not started yet.
  expect({ plate: after.plate, scan: after.scan, zoom: after.zoom, record: after.record }, "row → stack: Vision continues where it was").toEqual({ plate: before.plate, scan: before.scan, zoom: before.zoom, record: before.record });
  expect({ question: after.question, history: after.history }, "row → stack: Yoru has not started").toEqual({ question: "", history: 0 });
  // Then forward through Vision's end and Yoru's demonstration, and back again.
  const start = await page.evaluate(() => Math.round(scrollY));
  const forward = Array.from({ length: 18 }, (_, k) => start + k * 120);
  const positions = [...forward, ...forward.toReversed().slice(1)];
  const seen: Shown[] = [];
  for (const y of positions) {
    await scrollToY(page, y, 700);
    seen.push(await shows(page));
  }
  expect(seen, "row → stack, then forward and back: as a fresh page shows it").toEqual(await freshShows(page, stack.width, stack.height, positions));
  expect(seen.some((s) => s.record === 1) && seen.some((s) => s.history === 1), "the walk covers both completions").toBe(true);

  // Stack: Yoru part-way, then back to the row, which continues from the same point.
  await midway(page, 1, (s) => s.question!.length > 3 && s.question!.length < 30);
  const yoru = await shows(page);
  await page.setViewportSize(row);
  await frames(page, 3);
  await page.waitForTimeout(900);
  const back = await shows(page);
  expect({ question: back.question, status: back.status, results: back.results, history: back.history }, "stack → row: Yoru continues where it was").toEqual({ question: yoru.question, status: yoru.status, results: yoru.results, history: yoru.history });
  const rowStart = await page.evaluate(() => Math.round(scrollY));
  const rowForward = Array.from({ length: 10 }, (_, k) => rowStart + k * 80);
  const rowPositions = [...rowForward, ...rowForward.toReversed().slice(1)];
  const rowSeen: Shown[] = [];
  for (const y of rowPositions) {
    await scrollToY(page, y, 700);
    rowSeen.push(await shows(page));
  }
  expect(rowSeen, "stack → row, then forward and back: as a fresh page shows it").toEqual(await freshShows(page, row.width, row.height, rowPositions));
});

/*
  Between phone and desktop widths a card reads top to bottom but is wide, so Vision's camera would
  be taller than a short window allows. It shrinks, keeping its proportions and never below 20em,
  and the story stays held; at phone widths it never shrinks.
*/
for (const [width, height] of [[760, 657], [680, 657], [600, 720]])
  test(`at ${width}x${height} Vision's camera shrinks so the story stays held`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await open(page);
    expect((await stories(page)).find((s) => s.section === "building"), "MihawkAI is held as a stack").toMatchObject({ on: true, row: false });
    const camera = await page.evaluate(() => {
      const element = document.querySelector<HTMLElement>("#building .mseq-camera")!;
      const rect = element.getBoundingClientRect();
      const box = element.parentElement!.getBoundingClientRect();
      const em = parseFloat(getComputedStyle(document.documentElement).fontSize);
      return { ratio: rect.width / rect.height, width: rect.width, em, natural: box.width, centred: Math.abs(rect.left + rect.width / 2 - (box.left + box.width / 2)) };
    });
    expect(Math.abs(camera.ratio - 1.6), "the camera keeps its 16:10 picture").toBeLessThanOrEqual(0.02);
    expect(camera.width, "the camera shrinks").toBeLessThan(camera.natural - 1);
    expect(camera.width, "never below 20em").toBeGreaterThanOrEqual(camera.em * 20 - 1);
    expect(camera.centred, "the camera stays centred").toBeLessThanOrEqual(1);
    // The demonstration still plays: the plate is read and the record appears as the page scrolls.
    const [top] = await sectionRange(page, "building");
    const states: Shown[] = [];
    for (let y = top; y < top + height * 2.2; y += Math.round(height * 0.1)) {
      await scrollToY(page, Math.round(y), 500);
      states.push(await shows(page));
    }
    expect(states.some((s) => s.plate!.includes("·")) && states.some((s) => s.record === 1 && !s.plate!.includes("·")), "Vision plays and completes").toBe(true);
    const clipped = await page.evaluate(() => [...document.querySelectorAll<HTMLElement>("#building .stack-card")].filter((card) => card.scrollHeight > card.clientHeight + 1).length);
    expect(clipped, "nothing overflows its card").toBe(0);
  });

test("at phone and narrow widths Vision's camera keeps its natural size", async ({ page }) => {
  for (const [width, height] of [[393, 659], [412, 812], [430, 932], [500, 657], [375, 548]]) {
    await page.setViewportSize({ width, height });
    await open(page);
    expect(await page.evaluate(() => document.querySelector<HTMLElement>("#building .mseq-camera")!.style.maxWidth), `${width}x${height}`).toBe("");
  }
});
