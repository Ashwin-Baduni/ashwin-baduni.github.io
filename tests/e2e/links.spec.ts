import { test, expect, open, stories, maxScroll, scrollToY, sectionTop } from "./helpers";

/* Shared links, in-page links, the skip link, Back and reload. */
const SECTIONS = ["building", "kehsun", "focus", "experience", "projects", "certifications"];
const CHAPTERS = ["focus-vision", "focus-agents", "focus-learning", "focus-product"];
const AREAS = ["Computer vision", "AI agents", "Machine learning", "Product engineering"];

for (const id of SECTIONS)
  test(`a shared link to #${id} lands on the section`, async ({ page }) => {
    await open(page, `/#${id}`);
    await page.waitForTimeout(1800);
    const expected = Math.min(await sectionTop(page, id), await maxScroll(page));
    expect(Math.abs((await page.evaluate(() => scrollY)) - expected)).toBeLessThanOrEqual(2);
  });

test("chapter links show their capability", async ({ page }) => {
  await open(page);
  const focus = (await stories(page)).find((s) => s.section === "focus")!;
  for (const [i, chapter] of CHAPTERS.entries()) {
    await open(page, `/#${chapter}`);
    await page.waitForTimeout(1800);
    const shown = await page.evaluate(({ held, split }) => {
      if (split) {
        // Wide diagrams deliberately ignore pointer input. Check the single fully drawn
        // card and the selected link instead of hit-testing through that decorative layer.
        const visible = [...document.querySelectorAll<HTMLElement>("#focus .stack-card")].filter(card => {
          const rect = card.getBoundingClientRect();
          return Number(getComputedStyle(card).opacity) === 1 && rect.top >= 0 && rect.bottom <= innerHeight;
        });
        if (visible.length !== 1) return [];
        return [visible[0].querySelector("h3")!.textContent, document.querySelector("#focus .skills-menu a[aria-current]")!.textContent];
      }
      if (held) {
        // The card on top, at the middle of the held cards, and the introduction's words.
        const cards = [...document.querySelectorAll<HTMLElement>("#focus .stack-card")];
        const rect = cards[0].getBoundingClientRect();
        const card = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2)!.closest(".stack-card")!;
        return [card.querySelector("h3")!.textContent, document.querySelector("#focus .focus-intro-copy.is-active h3")!.textContent];
      }
      const card = document.elementFromPoint(innerWidth / 2, 40)!.closest(".stack-card")!;
      return [card.querySelector("h3")!.textContent, card.querySelector("h3")!.textContent];
    }, { held: focus.on, split: focus.sharedFrame });
    expect(shown, chapter).toEqual([AREAS[i], AREAS[i]]);
  }
});

test("back to the top, and Back returns to the shared section", async ({ page }) => {
  await open(page, "/#projects");
  await page.waitForTimeout(1800);
  await scrollToY(page, await maxScroll(page), 300);
  await page.locator(".back-to-top").click();
  await expect.poll(() => page.evaluate(() => scrollY), { timeout: 4000 }).toBeLessThanOrEqual(1);
  expect(await page.evaluate(() => document.activeElement?.id)).toBe("top");
  expect(new URL(page.url()).hash).toBe("#top");
  await page.goBack();
  await expect.poll(() => page.evaluate(() => scrollY), { timeout: 4000 }).toBeGreaterThan(100);
  const expected = Math.min(await sectionTop(page, "projects"), await maxScroll(page));
  expect(Math.abs((await page.evaluate(() => scrollY)) - expected)).toBeLessThanOrEqual(2);
});

test("the skip link moves focus past the introduction", async ({ page, browserName }) => {
  test.skip(browserName === "webkit", "WebKit does not move focus to links with Tab by default");
  await open(page);
  await page.keyboard.press("Tab");
  const skip = await page.evaluate(() => {
    const element = document.activeElement as HTMLElement;
    const rect = element.getBoundingClientRect();
    return { text: element.textContent, visible: rect.top >= 0 && rect.bottom <= innerHeight && rect.width > 0 };
  });
  expect(skip).toEqual({ text: "Skip introduction", visible: true });
  await page.keyboard.press("Enter");
  await expect.poll(() => page.evaluate(() => document.activeElement?.id), { timeout: 3000 }).toBe("about");
  await expect.poll(async () => Math.abs((await page.evaluate(() => scrollY)) - (await sectionTop(page, "about"))), { timeout: 3000 }).toBeLessThanOrEqual(2);
});

test("a reload opens at the top", async ({ page }) => {
  await open(page, "/#experience");
  await page.waitForTimeout(1200);
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  expect(await page.evaluate(() => [scrollY, location.hash])).toEqual([0, ""]);
});
