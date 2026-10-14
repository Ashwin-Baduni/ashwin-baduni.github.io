// Run with `npm run test:unit`. The browser checks are only as good as their analysis, so these
// cases prove that the clearance check uses the right predecessor and catches every collision.
import { test } from "node:test";
import assert from "node:assert/strict";
import { clearanceFailures, type Item } from "./e2e/analysis.ts";

const box = (section: string, kind: Item["kind"], top: number, bottom: number, extra: Partial<Item> = {}): Item => ({
  section, kind, index: 0, top, bottom, left: 16, right: 396, ty: 0, opacity: 1, ...extra,
});
const DOCUMENT = ["top", "about", "building", "kehsun", "focus", "experience", "projects", "certifications"];
// The order the sampler lists elements in (cards, then introductions, then content), which the
// first version of the check mistook for document order.
const SELECTOR_ORDER = ["building", "kehsun", "focus", "projects", "experience", "certifications", "about"];

test("an introduction is checked against the section before it in the document", () => {
  // Experience's heading runs into a Skills (focus) card; Projects is elsewhere.
  const samples = [{ y: 0, items: [box("focus", "card", 100, 520), box("projects", "card", 900, 1200), box("experience", "text", 500, 540)] }];
  assert.equal(clearanceFailures(samples, 812, DOCUMENT).length, 1);
  // With selector order Experience's predecessor became Projects, and the collision went unseen.
  assert.equal(clearanceFailures(samples, 812, SELECTOR_ORDER).length, 0);
});

test("text that has passed the outgoing element's top still fails", () => {
  const order = ["kehsun", "focus"];
  // Intersecting, with the heading's top above the card's top (the earlier blind spot).
  const intersecting = [{ y: 0, items: [box("kehsun", "card", 320, 700), box("focus", "text", 300, 340)] }];
  assert.equal(clearanceFailures(intersecting, 812, order).length, 1);
  // Outgoing content wholly below the incoming heading.
  const below = [{ y: 0, items: [box("kehsun", "card", 400, 700), box("focus", "text", 300, 340)] }];
  assert.equal(clearanceFailures(below, 812, order).length, 1);
  // Closer than the clearance, though not touching.
  const close = [{ y: 0, items: [box("kehsun", "card", 100, 295), box("focus", "text", 300, 340)] }];
  assert.equal(clearanceFailures(close, 812, order).length, 1);
});

test("faint previews count; clear, invisible or side-by-side elements do not", () => {
  const order = ["kehsun", "focus"];
  const faint = [{ y: 0, items: [box("kehsun", "card", 100, 520, { opacity: 0.2 }), box("focus", "text", 500, 540, { opacity: 0.28 })] }];
  assert.equal(clearanceFailures(faint, 812, order).length, 1);
  const clear = [{ y: 0, items: [box("kehsun", "card", 100, 476), box("focus", "text", 500, 540)] }];
  assert.deepEqual(clearanceFailures(clear, 812, order), []);
  const invisible = [{ y: 0, items: [box("kehsun", "card", 100, 520, { opacity: 0 }), box("focus", "text", 500, 540)] }];
  assert.deepEqual(clearanceFailures(invisible, 812, order), []);
  const beside = [{ y: 0, items: [box("kehsun", "card", 100, 520, { left: 600, right: 900 }), box("focus", "text", 500, 540, { right: 560 })] }];
  assert.deepEqual(clearanceFailures(beside, 1280, order), []);
});
