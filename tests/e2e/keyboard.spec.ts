import type { Page } from "@playwright/test";
import { test, expect, open, frames } from "./helpers";

/*
  Every link and control can be reached with the keyboard, in both directions, and each is
  fully visible and not covered by a held card or introduction when it has focus (WCAG 2.4.11).
*/
async function focused(page: Page) {
  await frames(page, 2);
  await page.waitForTimeout(350);
  return page.evaluate(() => {
    const element = document.activeElement as HTMLElement | null;
    // Focus has left the page (for the browser's own interface) after its last element.
    if (!element || element === document.body || !document.hasFocus()) return null;
    const rect = element.getBoundingClientRect();
    let opacity = 1;
    for (let node: Element | null = element; node; node = node.parentElement) opacity *= Number(getComputedStyle(node).opacity);
    const x = Math.min(innerWidth - 1, Math.max(0, rect.left + Math.min(rect.width, 24) / 2));
    const y = Math.min(innerHeight - 1, Math.max(0, rect.top + rect.height / 2));
    const hit = document.elementFromPoint(x, y);
    const focusable = [...document.querySelectorAll("a[href], button, [tabindex]:not([tabindex='-1'])")];
    return {
      // Firefox keeps focus on the page's last element when Tab would leave the page.
      last: focusable.at(-1) === element,
      name: (element.getAttribute("aria-label") ?? element.textContent ?? "").trim().slice(0, 40),
      inView: rect.bottom > 0 && rect.top < innerHeight && rect.height > 0,
      // The hit may also be the element's own container between its lines of text, never another card.
      uncovered: !!hit && (element.contains(hit) || (hit.contains(element) && hit.closest(".stack-card") === element.closest(".stack-card"))),
      opacity: Math.round(opacity * 100) / 100,
    };
  });
}

test("every focusable element is reachable, visible and uncovered, forwards and backwards", async ({ page, browserName }) => {
  test.skip(browserName === "webkit", "WebKit does not move focus to links with Tab by default");
  await open(page);
  const forwards: NonNullable<Awaited<ReturnType<typeof focused>>>[] = [];
  for (let i = 0; i < 60; i++) {
    await page.keyboard.press("Tab");
    const state = await focused(page);
    if (process.env.KEYS_DEBUG) console.log(i, JSON.stringify(state));
    if (!state || (i > 5 && state.name === forwards[0].name)) break;
    // Tab must always move on: focus stuck on one element means the next one cannot be reached.
    if (state.last && state.name === forwards.at(-1)?.name) break;
    expect(state.name === forwards.at(-1)?.name, `Tab moves on from ${state.name}`).toBe(false);
    forwards.push(state);
  }
  const names = forwards.map((f) => f.name);
  for (const expected of ["Skip introduction", "LinkedIn", "GitHub", "View CV", "MihawkAI", "Kehsun", "Back to the top"])
    expect(names.some((name) => name.includes(expected)), `${expected} is reachable`).toBe(true);
  expect(names.filter((name) => name.startsWith("View ") && name !== "View CV").length, "all three projects").toBe(3);
  const problems = forwards.filter((f) => !f.inView || !f.uncovered || f.opacity < 0.9);
  expect(problems, "focused elements are visible and uncovered").toEqual([]);
  const backwards: string[] = [];
  for (let i = 0; i < forwards.length - 1; i++) {
    await page.keyboard.press("Shift+Tab");
    const state = await focused(page);
    if (!state) break;
    if (!state.inView || !state.uncovered || state.opacity < 0.9) backwards.push(`${state.name}: ${JSON.stringify(state)}`);
  }
  expect(backwards, "backwards too").toEqual([]);
});
