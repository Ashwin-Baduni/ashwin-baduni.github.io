import { test, expect, open, scrollToY } from "./helpers";

// A GSAP context reversion can rewind callback-owned text even when all styles have reverted
// to their finished, reduced-motion state. Assert the words, not just a visible final card.
for (const [width, height] of [[412, 812], [445, 570]]) {
  test(`product wording restores its finished state with reduced motion at ${width}x${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await open(page);
    const end = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
    await scrollToY(page, end, 600);
    await expect(page.locator(".review-status")).toHaveText("Reviewed by practitioner");
    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect(page.locator("#kehsun .stack")).toHaveAttribute("data-stack", "off");
    await expect(page.locator(".review-status")).toHaveText("Reviewed by practitioner");
    await expect(page.locator(".mseq-plate-num")).toHaveText("UP 16 BX 4471");
    await expect(page.locator(".mseq-q")).toHaveText("Which cars with UP plates arrived today?");
    await expect(page.locator(".mseq-status")).toHaveText("History open");
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await expect(page.locator("#kehsun .stack")).toHaveAttribute("data-stack", "on");
    await scrollToY(page, 0, 600);
    await expect(page.locator(".review-status")).toHaveText("Ready for practitioner review");
    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect(page.locator("#kehsun .stack")).toHaveAttribute("data-stack", "off");
    await expect(page.locator(".review-status")).toHaveText("Reviewed by practitioner");
    expect(await page.locator(".transcript-saved").evaluate((e) => getComputedStyle(e).opacity)).toBe("1");
  });
}
