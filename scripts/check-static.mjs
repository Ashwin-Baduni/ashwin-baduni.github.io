// Static checks: npm run check:static
// 1. Every source file is reachable from src/main.tsx (tests excepted).
// 2. Every CSS class in src/index.css is used by reachable code.
// 3. The scroll-story hooks never position elements per scroll frame: their only per-frame
//    setters are for opacity, so waiting, parked and leaving elements stay browser-held.
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(root, "src");
const problems = [];

const files = [];
(function walk(directory) {
  for (const name of readdirSync(directory)) {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) walk(path);
    else if (/\.(tsx?|css)$/.test(name) && !name.endsWith(".test.ts")) files.push(path);
  }
})(src);

function resolveImport(from, specifier) {
  const base = specifier.startsWith("@/") ? join(src, specifier.slice(2)) : specifier.startsWith(".") ? resolve(dirname(from), specifier) : null;
  if (!base) return null;
  for (const suffix of ["", ".ts", ".tsx", "/index.ts", "/index.tsx"])
    if (existsSync(base + suffix) && statSync(base + suffix).isFile()) return base + suffix;
  return null;
}

const reachable = new Set();
const queue = [join(src, "main.tsx")];
while (queue.length) {
  const file = queue.pop();
  if (reachable.has(file)) continue;
  reachable.add(file);
  const text = readFileSync(file, "utf8");
  for (const match of text.matchAll(/(?:import|export)[^'"]*?from\s*["']([^"']+)["']|import\s*["']([^"']+)["']/g)) {
    const target = resolveImport(file, match[1] ?? match[2]);
    if (target) queue.push(target);
  }
}
for (const file of files) if (!reachable.has(file)) problems.push(`unreachable source file: ${relative(root, file)}`);

const code = [...reachable].filter((file) => /\.tsx?$/.test(file)).map((file) => readFileSync(file, "utf8")).join("\n");
const css = readFileSync(join(src, "index.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
const classes = new Set([...css.matchAll(/(?<![\w-])\.(-?[a-z][a-z0-9-]*)/gi)].map((match) => match[1]));
for (const name of classes)
  if (!new RegExp(`(?<![\\w-])${name}(?![\\w-])`).test(code)) problems.push(`unused CSS class: .${name}`);

for (const hook of ["useCardStack.ts", "useCardRow.ts", "useProjectGrid.ts", "useSkillSequence.ts", "useSectionHandoffs.ts"]) {
  const text = readFileSync(join(src, "hooks", hook), "utf8");
  for (const match of text.matchAll(/quickSetter\([^,]+,\s*"([^"]+)"/g))
    if (match[1] !== "opacity") problems.push(`${hook}: per-frame setter for "${match[1]}" (only opacity may follow the scroll)`);
  // Position keys inside GSAP calls (gsap.set / to / from / fromTo / quickTo and timeline methods).
  for (const call of text.matchAll(/(?:gsap|timeline|\))\s*\.(?:set|to|from|fromTo|quickTo)\(/g)) {
    let depth = 0;
    let end = call.index + call[0].length - 1;
    for (; end < text.length; end++) {
      if (text[end] === "(") depth++;
      else if (text[end] === ")" && --depth === 0) break;
    }
    for (const key of text.slice(call.index, end).matchAll(/[{,]\s*["']?(y|x|yPercent|xPercent|top|left|translate\w*)["']?\s*:/g))
      problems.push(`${hook}: animates "${key[1]}"; story elements must be positioned by the browser`);
  }
}

if (problems.length) {
  console.error(problems.map((problem) => `✗ ${problem}`).join("\n"));
  process.exit(1);
}
console.log(`✓ ${reachable.size} reachable modules, ${classes.size} CSS classes in use, story hooks set only opacity per frame`);
