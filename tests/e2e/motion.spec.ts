import type { Page } from "@playwright/test";
import { test, expect, open, stories, maxScroll, scrollToY } from "./helpers";

/*
  Interrupted gestures and fast passes. Every state is a function of the scroll position, so
  however the page got there, it must settle into exactly the state a direct visit shows.
*/
async function gesture(page: Page, browserName: string, dy: number, speed = 3000) {
  if (browserName === "chromium") {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Input.synthesizeScrollGesture", { x: 200, y: 300, yDistance: -dy, speed, gestureSourceType: "mouse" });
    await cdp.detach();
  } else if (browserName === "firefox") {
    await page.mouse.move(200, 300);
    const step = Math.sign(dy) * Math.min(120, Math.abs(dy));
    for (let moved = 0; Math.abs(moved) < Math.abs(dy); moved += step) await page.mouse.wheel(0, step);
  } else {
    await page.evaluate(async (dy) => {
      const step = Math.sign(dy) * 60;
      for (let moved = 0; Math.abs(moved) < Math.abs(dy); moved += step) {
        window.scrollBy(0, step);
        await new Promise(requestAnimationFrame);
      }
    }, dy);
  }
}

// Positions, opacities, demonstration progress and changing text of every story element.
function state(page: Page) {
  return page.evaluate(() => {
    const opacity = (element: Element) => {
      let value = 1;
      for (let node: Element | null = element; node; node = node.parentElement) value *= Number(getComputedStyle(node).opacity);
      return Math.round(value * 50) / 50;
    };
    const cards = [...document.querySelectorAll(".stack-card, [data-story-intro]")].map((element) => ({
      top: Math.round(element.getBoundingClientRect().top),
      opacity: opacity(element),
    }));
    const demos = [...document.querySelectorAll(".mseq-record, .mseq-answer, .call-connected, .transcript-saved, .scene-caption, .booking-step")]
      .map((element) => opacity(element));
    const text = [...document.querySelectorAll("[data-rest-text], .review-status, .focus-intro-copy.is-active h3")].map((element) => element.textContent);
    return { y: scrollY, cards, demos, text };
  });
}

// On a desktop a gesture may end with a settling motion; the state is judged once it has finished.
async function settledState(page: Page) {
  await page.waitForTimeout(1200);
  await page.waitForFunction(() => document.documentElement.dataset.settling !== "on");
  return state(page);
}

test("an interrupted and reversed gesture settles exactly like a direct visit", async ({ page, browserName }) => {
  await open(page);
  const screen = page.viewportSize()!.height;
  const story = (await stories(page)).find((s) => s.on);
  test.skip(!story, "no held story at this size");
  const top = await page.evaluate((id) => document.getElementById(id)!.getBoundingClientRect().top + scrollY, story!.section);
  for (const start of [top + screen * 0.4, top + screen * 1.4, top + screen * 2.2]) {
    await scrollToY(page, Math.round(start), 600);
    await gesture(page, browserName, 420);
    await page.waitForTimeout(80);
    await gesture(page, browserName, -260);
    const after = await settledState(page);
    // Leave, then come straight back to the same position.
    await scrollToY(page, 0, 300);
    await scrollToY(page, after.y, 0);
    const direct = await settledState(page);
    expect(after, `state after an interrupted gesture near ${Math.round(start)}`).toEqual(direct);
  }
});

test("a fast pass down and back up leaves no stuck or half-finished state", async ({ page, browserName }) => {
  await open(page);
  const max = await maxScroll(page);
  await gesture(page, browserName, max, 20000);
  await settledState(page);
  await gesture(page, browserName, -max, 20000);
  await settledState(page);
  const probes = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>(".stack")].flatMap((root) => {
      const rect = root.getBoundingClientRect();
      return [0.25, 0.5, 0.75].map((f) => Math.round(rect.top + scrollY + rect.height * f));
    }),
  );
  for (const y of [...probes, max]) {
    // Arrive with one fast jump from far away, then compare with a slow arrival.
    await scrollToY(page, y > max / 2 ? 0 : max, 100);
    await gesture(page, browserName, y - (y > max / 2 ? 0 : max), 20000);
    const fast = await settledState(page);
    // Desktop may finish a gesture by settling in the inter-section gap. Compare that actual
    // destination with a direct visit; don't overwrite the gesture while it is still settling.
    await scrollToY(page, fast.y - 400, 400);
    await scrollToY(page, fast.y, 0);
    const slow = await settledState(page);
    expect(fast, `state at ${y} after a fast pass`).toEqual(slow);
  }
  // At the end of the page every demonstration shows its finished wording.
  await scrollToY(page, max, 1200);
  const words = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>("[data-rest-text]")].every((element) => element.textContent === element.dataset.restText),
  );
  expect(words, "finished wording after the pass").toBe(true);
});
