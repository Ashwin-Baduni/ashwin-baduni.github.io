import { test, expect, open, sweep, maxScroll, clearanceFailures, documentOrder, transformFailures } from "./helpers";

/*
  Larger text (WCAG 1.4.4 asks for 200%). The root font size grows before the page loads, as a
  browser text-size setting does. Stories re-plan from their real content, fall back to the plain
  list where a card can no longer fit, and no text may be cut off or pushed off the side.
*/
for (const scale of [125, 150, 200])
  for (const [width, height] of [[412, 812], [375, 667], [320, 568]])
    test(`text at ${scale}% on ${width}x${height}`, async ({ page, browserName }) => {
      test.skip(browserName !== "chromium" && !(scale === 200 && width === 412), "the full matrix runs in Chromium");
      await page.setViewportSize({ width, height });
      await page.addInitScript((scale) => {
        document.addEventListener("DOMContentLoaded", () => (document.documentElement.style.fontSize = `${scale}%`));
      }, scale);
      await open(page);
      const report = await page.evaluate(() => {
        const clippedText: string[] = [];
        const walker = document.createTreeWalker(document.querySelector("main")!, NodeFilter.SHOW_TEXT);
        // Text meant only for assistive technology is clipped on purpose and does not count.
        const hidden = (element: Element | null): boolean => {
          for (let node = element; node; node = node.parentElement) {
            const style = getComputedStyle(node);
            if (style.visibility === "hidden" || style.display === "none" || style.clipPath !== "none" || style.clip !== "auto") return true;
          }
          return false;
        };
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
          if (!node.textContent!.trim() || hidden(node.parentElement)) continue;
          const range = document.createRange();
          range.selectNodeContents(node);
          for (const rect of range.getClientRects())
            if (rect.width && (rect.right > innerWidth + 1 || rect.left < -1)) clippedText.push(node.textContent!.trim().slice(0, 40));
        }
        return {
          clippedText: [...new Set(clippedText)],
          stories: [...document.querySelectorAll<HTMLElement>(".stack")].map((root) => ({
            section: root.closest("[data-segment]")!.id,
            on: root.dataset.stack === "on",
            reason: root.dataset.storyFit ?? "",
            clipped: [...root.querySelectorAll<HTMLElement>(".stack-card")].filter((card) => card.scrollHeight > card.clientHeight + 1).length,
          })),
        };
      });
      expect(report.clippedText, "no text runs off the side").toEqual([]);
      for (const story of report.stories) {
        expect(story.clipped, `${story.section} cards show their whole content`).toBe(0);
        if (!story.on) expect(story.reason, `${story.section} explains its plain layout`).not.toBe("");
      }
      const samples = await sweep(page, 0, await maxScroll(page), 24, 1);
      expect(transformFailures(samples, height)).toEqual([]);
      expect(clearanceFailures(samples, height, await documentOrder(page)).slice(0, 8)).toEqual([]);
    });
