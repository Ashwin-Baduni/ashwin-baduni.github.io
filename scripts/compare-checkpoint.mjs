// Compare the phone presentation of the working tree with a checkpoint: npm run compare:checkpoint
//
//   node scripts/compare-checkpoint.mjs [ref] [--engines chromium,firefox,webkit] [--sizes 412x812,…]
//                                       [--step 0.15] [--self] [--keep]
//
// --self compares the reference with itself, loaded twice: the noise any comparison must allow.
//
// The reference (default b8ab234, "Checkpoint Phone Best Version") is exported with `git archive`
// into a temporary folder and built there; the working tree, committed or not, is built into
// another. Both are served locally and opened side by side in isolated Playwright browsers at
// phone and narrow sizes. Each page loads in real time, as for a visitor; then the page clock is
// put under the script's control, so time only advances when the script advances it, by the same
// amount for both builds. At every position, scrolling down the whole page and back up, the
// settled state must be the same:
//   - the rectangle and effective opacity of every section, story, lane, card and introduction;
//   - every inline style in the page (the held lanes, scroll-played demonstrations, reveals);
//   - the story attributes (held or plain, fit reasons, the card on show, handoffs);
//   - the changing text (typed questions, statuses, plate characters, chapter titles);
//   - whether each looping visual plays. Their elapsed frames are deliberately not compared.
// Rectangles are compared to the half pixel; inline lengths may differ by up to half a pixel and
// opacities and scales by 0.01, and every such smaller deviation is still counted and reported, so
// an exact match shows as "identical". Anything else must match exactly. A position that differs
// is settled again for both pages before the difference counts.
// Exits with 1 and lists the first differences if anything differs.
import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(join(root, "package.json"));
const playwright = require("@playwright/test");

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args.splice(i, 2)[1] : fallback;
};
const flag = (name) => args.includes(`--${name}`) && !!args.splice(args.indexOf(`--${name}`), 1);
const keep = flag("keep");
const self = flag("self");
const only = option("sizes", "");
const engines = option("engines", "chromium").split(",");
const step = Number(option("step", "0.15"));
const ref = args[0] ?? "b8ab234";

// Phone and narrow sizes, where the stack must be exactly as at the checkpoint: portrait phones
// (held, mixed and plain), landscape phones, a portrait tablet, and larger text.
const SIZES = [
  { width: 412, height: 812 },
  { width: 393, height: 659 },
  { width: 375, height: 548 },
  { width: 430, height: 932 },
  { width: 360, height: 640 },
  { width: 844, height: 390 },
  { width: 932, height: 430 },
  { width: 768, height: 1024 },
  { width: 412, height: 812, text: 150 },
].filter((size) => !only || only.split(",").includes(`${size.width}x${size.height}${size.text ? `@${size.text}` : ""}`));

const vite = join(root, "node_modules", "vite", "bin", "vite.js");
const work = mkdtempSync(join(tmpdir(), "portfolio-checkpoint-"));
const servers = [];

function freePort() {
  return new Promise((resolvePort, reject) => {
    const server = createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close(() => resolvePort(port));
    });
  });
}

async function serve(cwd, outDir) {
  const port = await freePort();
  const server = spawn(process.execPath, [vite, "preview", "--outDir", outDir, "--port", String(port), "--strictPort", "--host", "127.0.0.1"], { cwd, stdio: "ignore" });
  servers.push(server);
  const url = `http://127.0.0.1:${port}/`;
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(url)).ok) return url;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`preview server for ${outDir} did not start`);
}

const lockfile = (dir) => (existsSync(join(dir, "package-lock.json")) ? readFileSync(join(dir, "package-lock.json"), "utf8") : "");

function prepareReference() {
  const source = join(work, "reference");
  mkdirSync(source);
  console.log(`Exporting ${ref} (${execFileSync("git", ["log", "-1", "--format=%h %s", ref], { cwd: root, encoding: "utf8" }).trim()})`);
  const archive = execFileSync("git", ["archive", "--format=tar", ref], { cwd: root, maxBuffer: 1 << 30 });
  execFileSync("tar", ["-x", "-C", source], { input: archive });
  if (lockfile(source) === lockfile(root)) symlinkSync(join(root, "node_modules"), join(source, "node_modules"), "dir");
  else {
    console.log("The reference has different dependencies; installing them with npm ci.");
    execFileSync("npm", ["ci", "--no-audit", "--no-fund"], { cwd: source, stdio: "inherit" });
  }
  return source;
}

function build(cwd, outDir) {
  execFileSync(process.execPath, [join(cwd, "node_modules", "vite", "bin", "vite.js"), "build", "--outDir", outDir, "--emptyOutDir", "--logLevel", "error"], { cwd, stdio: "inherit" });
}

// Everything compared at one scroll position. Elements are named by their path from <main>, so
// both builds name the same element alike even where a class name differs.
function capture() {
  const main = document.querySelector("main");
  const path = (element) => {
    const steps = [];
    for (let node = element; node && node !== main; node = node.parentElement)
      steps.unshift(`${node.tagName.toLowerCase()}${[...node.parentElement.children].indexOf(node)}`);
    return steps.join(">");
  };
  const half = (value) => Math.round(value * 2) / 2;
  const opacity = (element) => {
    let value = 1;
    for (let node = element; node; node = node.parentElement) value *= Number(getComputedStyle(node).opacity);
    return Math.round(value * 100) / 100;
  };
  const loops = [...main.querySelectorAll("[data-playing]")];
  const insideLoop = (element) => loops.some((loop) => loop.contains(element));
  const story = [...main.querySelectorAll("[data-segment], .stack, .stack-intro-track, .stack-intro, .stack-cards, .stack-lane, .stack-card, [data-story-intro], .handoff-lane")]
    .map((element) => {
      const rect = element.getBoundingClientRect();
      const { stack, storyFit, active, handoff } = element.dataset;
      return [path(element), `${half(rect.left)}px ${half(rect.top)}px ${half(rect.width)}px ${half(rect.height)}px ${opacity(element)}`, [stack, storyFit, active, handoff].join("|")];
    });
  const styles = [...main.querySelectorAll("[style]")]
    .filter((element) => !insideLoop(element))
    .map((element) => [path(element), element.getAttribute("style")]);
  const text = [...main.querySelectorAll("[data-rest-text], .mseq-q, .mseq-status, .review-status, .focus-intro-copy.is-active h3")]
    .filter((element) => !insideLoop(element))
    .map((element) => `${path(element)} ${element.textContent}`);
  return {
    height: document.documentElement.scrollHeight,
    story,
    styles,
    text,
    playing: loops.map((loop) => `${path(loop)} ${loop.dataset.playing}`),
  };
}

async function open(browser, url, size, browserName) {
  const mobile = browserName !== "firefox";
  const context = await browser.newContext({ viewport: { width: size.width, height: size.height }, deviceScaleFactor: 1, isMobile: mobile, hasTouch: mobile });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  if (size.text) await page.addInitScript((scale) => document.addEventListener("DOMContentLoaded", () => (document.documentElement.style.fontSize = `${scale}%`)), size.text);
  await page.goto(url, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(2500);
  // From here time stands still unless advanced, identically for both builds.
  await page.clock.install();
  await page.clock.pauseAt(Date.now() + 10_000);
  return { page, context, errors };
}

async function settleAt(page, y) {
  await page.evaluate((y) => window.scrollTo({ top: y, behavior: "instant" }), y);
  // Scroll events and layout are native; animation frames and timers run as the clock advances.
  await page.clock.runFor(1500);
  return { y: await page.evaluate(() => Math.round(scrollY)), ...(await page.evaluate(capture)) };
}

// A ScrollTrigger refresh that happens to start late in the sampling window can leave one page
// still catching up. A difference therefore counts only if it persists after both pages have
// been given the same extra time at that position; the summary reports how often this was needed.
async function compareAt(before, now, y) {
  const recorded = deviations.length;
  let [a, b] = await Promise.all([settleAt(before, y), settleAt(now, y)]);
  let found = differences(a, b);
  if (!found.length) return { found, resettled: false };
  // Only the second capture's sub-pixel deviations are kept.
  deviations.length = recorded;
  [a, b] = await Promise.all([settleAt(before, y), settleAt(now, y)]);
  found = differences(a, b);
  return { found, resettled: true };
}

// Two values match when their words are equal and every number is within tolerance: half a
// pixel for lengths, 0.01 otherwise (opacity, scale). Smaller deviations are recorded.
const NUMBER = /-?(?:\d+\.?\d*|\.\d+)(?:e-?\d+)?(px)?/g;
const deviations = [];
function close(a, b, where) {
  if (a === b) return true;
  if (a.replace(NUMBER, "#") !== b.replace(NUMBER, "#")) return false;
  const x = [...a.matchAll(NUMBER)];
  const y = [...b.matchAll(NUMBER)];
  const within = x.every((match, i) => Math.abs(Number.parseFloat(match[0]) - Number.parseFloat(y[i][0])) <= (match[1] ? 0.5 : 0.01));
  if (within) deviations.push(`${where}: ${b} (was ${a})`);
  return within;
}

function differences(a, b) {
  const found = [];
  if (a.y !== b.y) found.push(`scroll position ${b.y} vs ${a.y}`);
  if (Math.abs(a.height - b.height) > 1) found.push(`page height ${b.height} vs ${a.height}`);
  // Rectangles and styles by element; story attributes, text and loop states exactly.
  for (const key of ["story", "styles"]) {
    const before = new Map(a[key].map(([path, ...values]) => [path, values]));
    const now = new Map(b[key].map(([path, ...values]) => [path, values]));
    for (const [path, values] of now) {
      const old = before.get(path);
      if (!old) found.push(`${key} only now: ${path} ${values.join(" ")}`);
      else if (!close(old[0], values[0], `y=${b.y} ${key} ${path}`) || old[1] !== values[1]) found.push(`${key} ${path}: ${values.join(" ")} (was ${old.join(" ")})`);
    }
    for (const [path, values] of before) if (!now.has(path)) found.push(`${key} only before: ${path} ${values.join(" ")}`);
  }
  for (const key of ["text", "playing"]) {
    const left = new Set(a[key]);
    const right = new Set(b[key]);
    for (const item of b[key]) if (!left.has(item)) found.push(`${key} now:    ${item}`);
    for (const item of a[key]) if (!right.has(item)) found.push(`${key} before: ${item}`);
  }
  return found;
}

let failed = false;
try {
  const reference = prepareReference();
  console.log("Building the reference and the working tree…");
  build(reference, join(work, "reference-dist"));
  if (!self) build(root, join(work, "current-dist"));
  const urls = {
    before: await serve(reference, join(work, "reference-dist")),
    now: self ? await serve(reference, join(work, "reference-dist")) : await serve(root, join(work, "current-dist")),
  };
  for (const browserName of engines) {
    const browser = await playwright[browserName].launch(browserName === "chromium" ? { channel: "chromium" } : {});
    for (const size of SIZES) {
      const label = `${browserName} ${size.width}x${size.height}${size.text ? ` text ${size.text}%` : ""}`;
      const [before, now] = await Promise.all([open(browser, urls.before, size, browserName), open(browser, urls.now, size, browserName)]);
      const max = await before.page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
      const down = [];
      for (let y = 0; y < max; y += Math.round(size.height * step)) down.push(y);
      down.push(max);
      const positions = [...down, ...down.toReversed().slice(1)];
      const found = [];
      let resettled = 0;
      deviations.length = 0;
      for (const y of positions) {
        const result = await compareAt(before.page, now.page, y);
        if (result.resettled) resettled++;
        for (const difference of result.found) found.push(`y=${y}: ${difference}`);
        if (found.length > 40) break;
      }
      for (const errors of [before.errors, now.errors]) found.push(...errors.map((error) => `page error: ${error}`));
      const verdict = found.length ? `${found.length} differences` : deviations.length ? `the same within tolerance (${deviations.length} sub-pixel deviations)` : "identical";
      console.log(`${found.length ? "✗" : "✓"} ${label}: ${positions.length} positions down and up, ${verdict}${resettled ? `; ${resettled} position${resettled > 1 ? "s" : ""} needed more time to settle` : ""}`);
      if (deviations.length) console.log(deviations.slice(0, 5).map((line) => `    ~ ${line}`).join("\n"));
      if (found.length) {
        failed = true;
        console.log(found.slice(0, 20).map((line) => `    ${line}`).join("\n"));
      }
      await Promise.all([before.context.close(), now.context.close()]);
    }
    await browser.close();
  }
} finally {
  servers.forEach((server) => server.kill());
  if (keep) console.log(`Kept ${work}`);
  else rmSync(work, { recursive: true, force: true });
}
process.exit(failed ? 1 : 0);
