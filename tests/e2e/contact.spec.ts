import { test, expect, open, sweep, series, plateaus, scrollToY, stories } from "./helpers";

/* Email copying, the CV preview, the project loops and the hero map. */
const EMAIL = "baduniashwin@gmail.com";
const status = (page: import("@playwright/test").Page) => page.locator(".email-copy [aria-live]");

test("copying the email with the Clipboard API", async ({ page, browserName, context }) => {
  test.skip(browserName !== "chromium", "clipboard permissions are granted only in Chromium");
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await open(page);
  await page.locator(".email-copy").click();
  await expect(status(page)).toHaveText("Copied");
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(EMAIL);
});

test("copying the email without the Clipboard API (an http preview)", async ({ page, browserName, context }) => {
  if (browserName === "chromium") await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.addInitScript(() => {
    // Hide the Clipboard API from the page, keeping a private way to read the real clipboard.
    const real = Object.getOwnPropertyDescriptor(Navigator.prototype, "clipboard");
    (window as unknown as { readClipboard?: () => Promise<string> }).readClipboard = () => real!.get!.call(navigator).readText();
    Object.defineProperty(Navigator.prototype, "clipboard", { get: () => undefined });
  });
  await open(page);
  const button = page.locator(".email-copy");
  await button.click();
  await expect(status(page)).toHaveText(/^(Copied|Select and copy)$/);
  const result = await status(page).textContent();
  expect(await button.evaluate((element) => element === document.activeElement), "focus stays on the button").toBe(true);
  // "Copied" is only shown when the address really reached the clipboard.
  if (browserName === "chromium") {
    expect(result).toBe("Copied");
    expect(await page.evaluate(() => (window as unknown as { readClipboard: () => Promise<string> }).readClipboard())).toBe(EMAIL);
  }
  if (result === "Select and copy") expect(await page.evaluate(() => getSelection()?.toString())).toBe(EMAIL);
});

test("a failed copy selects the address and never claims success", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(Navigator.prototype, "clipboard", { get: () => undefined });
    document.execCommand = () => false;
  });
  await open(page);
  const button = page.locator(".email-copy");
  await button.click();
  await expect(status(page)).toHaveText("Select and copy");
  expect(await page.evaluate(() => getSelection()?.toString())).toBe(EMAIL);
  await expect(button).toHaveAttribute("aria-label", `Copy email address ${EMAIL}`);
});

test("the CV preview opens, traps nothing, and returns focus", async ({ page }) => {
  await open(page);
  const opener = page.getByRole("button", { name: "View CV" });
  await opener.click();
  const dialog = page.locator("dialog.cv-dialog");
  await expect(dialog).toHaveAttribute("open", "");
  await expect(page.locator("[data-close-cv]")).toBeFocused();
  expect(await page.evaluate(() => document.body.style.overflow)).toBe("hidden");
  await expect(dialog.locator("iframe")).toHaveAttribute("src", /\/files\/CV\.pdf#view=FitH$/);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(opener).toBeFocused();
  expect(await page.evaluate(() => document.body.style.overflow)).toBe("");
  await opener.click();
  await page.locator("[data-close-cv]").click();
  await expect(dialog).toHaveCount(0);
  await expect(opener).toBeFocused();
});

test("project loops play only while their card is on show", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "loop state is engine-independent");
  await open(page);
  const story = (await stories(page)).find((s) => s.section === "projects");
  test.skip(!story?.on, "Projects is a plain list at this size");
  const screen = page.viewportSize()!.height;
  const top = await page.evaluate(() => document.getElementById("projects")!.getBoundingClientRect().top + scrollY);
  const bottom = await page.evaluate(() => document.getElementById("projects")!.getBoundingClientRect().bottom + scrollY);
  const samples = await sweep(page, Math.round(top - screen), Math.round(bottom), 8, 1);
  const [analytics, captcha] = [1, 2].map((i) => series(samples, "projects", "card", i));
  const analyticsWaiting = plateaus(analytics.filter((p) => p.top > screen * 0.6 && p.top < screen), 60)[0];
  const captchaWaiting = plateaus(captcha.filter((p) => p.top > screen * 0.6 && p.top < screen), 60)[0];
  const analyticsParked = plateaus(analytics.filter((p) => p.top < screen * 0.6), 60)[0];
  const captchaParked = plateaus(captcha.filter((p) => p.top < screen * 0.6), 60)[0];
  // Motion amplification, Analytics chatbot, CAPTCHA recognition.
  const playing = () => page.evaluate(() =>
    ["#projects .wave-raw", "#projects .chart-demo", "#projects .captcha-demo"].map((selector) => {
      const element = document.querySelector(selector)!;
      return (element.closest("[data-playing]") as HTMLElement | null)?.dataset.playing;
    }));
  // The early preview can finish waiting before Motion amplification parks on a roomy
  // viewport. Sample its actual waiting interval, not an assumed post-parking interval.
  await scrollToY(page, Math.round((analyticsWaiting.from + analyticsWaiting.to) / 2), 500);
  const waitingTop = await page.locator("#projects .stack-card").nth(1).evaluate(el => el.getBoundingClientRect().top);
  expect(Math.abs(waitingTop - analyticsWaiting.top), "Analytics is still at its waiting line").toBeLessThanOrEqual(1);
  expect(await playing(), "Motion amplification plays; Analytics waits without playing").toEqual(["true", "false", "false"]);
  await scrollToY(page, Math.round((captchaWaiting.from + captchaWaiting.to) / 2), 500);
  const captchaTop = await page.locator("#projects .stack-card").nth(2).evaluate(el => el.getBoundingClientRect().top);
  expect(Math.abs(captchaTop - captchaWaiting.top), "CAPTCHA is still at its waiting line").toBeLessThanOrEqual(1);
  expect((await playing()).slice(1), "Analytics plays while the CAPTCHA preview waits without playing").toEqual(["true", "false"]);
  await scrollToY(page, Math.round(analyticsParked.from + 20), 500);
  // CAPTCHA may already be rising here on a roomy screen, so its waiting state is checked
  // independently above. Motion amplification must be paused as soon as it is fully covered.
  expect((await playing()).slice(0, 2), "Analytics covers Motion amplification").toEqual(["false", "true"]);
  await scrollToY(page, Math.round(captchaParked.from + 20), 500);
  expect(await playing(), "CAPTCHA covers Analytics").toEqual(["false", "false", "true"]);
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  expect(await playing(), "a background tab pauses every loop").toEqual(["false", "false", "false"]);
});

test("the hero map keeps native pinch zoom", async ({ page }) => {
  await open(page);
  const touchAction = await page.evaluate(() => getComputedStyle(document.querySelector("canvas")!.parentElement!).touchAction);
  expect(touchAction).toContain("pinch-zoom");
});
