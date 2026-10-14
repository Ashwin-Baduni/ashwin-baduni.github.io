import { test } from "node:test";
import assert from "node:assert/strict";
import {
  destination, reached, settleTarget, settleMotion, wheelBurst, FALLOFF, PULL_SECONDS, REST, SWING_MAX,
  type WheelBurst, type WheelSample,
} from "./desktopSettle.ts";

const ranges = [
  { start: 0, end: 0, enter: -800, leave: 650 },
  { start: 800, end: 800, enter: 240, leave: 1440 },
  { start: 1600, end: 3000, enter: 980, leave: 3630 },
  { start: 3800, end: 6000, enter: 3200, leave: 6600 },
  { start: 6800, end: 7400, enter: 6260, leave: 7600 },
];

test("between sections the page goes on in the direction of travel, however little shows", () => {
  assert.equal(settleTarget(ranges, 1, 1), null, "at a resting point");
  for (const y of [10, 239, 240, 790]) assert.equal(settleTarget(ranges, y, 1)?.target, 800);
  for (const y of [10, 650, 790]) assert.equal(settleTarget(ranges, y, -1)?.target, 0);
  assert.equal(settleTarget(ranges, 3010, 1)?.target, 3800);
  assert.equal(settleTarget(ranges, 3630, -1)?.target, 3000);
  assert.equal(settleTarget(ranges, 3790, -1)?.target, 3000);
});

test("a single gesture keeps its adjacent destination through under- and overshoot", () => {
  const down = destination(ranges, 0, 1)!;
  assert.equal(down.target, 800);
  assert.equal(reached(down, 180), false);
  for (const y of [250, 500, 1100, 1900]) assert.equal(reached(down, y), true);
  const up = destination(ranges, 3800, -1)!;
  assert.equal(up.target, 3000);
  for (const y of [3620, 3100, 2750, 1800]) assert.equal(reached(up, y), true);
});

test("reading intervals stay native and repeated scrolling cannot recover to a stale section", () => {
  for (const { start, end } of ranges) for (let y = start; y <= end; y += 1) {
    assert.equal(settleTarget(ranges, y, 1), null);
    assert.equal(settleTarget(ranges, y, -1), null);
  }
  // Starting a new gesture inside a demo targets the NEXT section, only after this demo ends.
  const next = destination(ranges, 2000, 1)!;
  assert.equal(next.target, 3800);
  assert.equal(reached(next, 2100), false);
  assert.equal(reached(next, 3001), false);
  assert.equal(reached(next, 3200), true);
  assert.equal(settleTarget(ranges, 1900, 1), null);
  assert.equal(settleTarget(ranges, 3400, 1)?.target, 3800);
  assert.equal(destination(ranges, 0, -1), null);
  assert.equal(destination(ranges, 7400, 1), null);
  assert.equal(settleTarget(ranges, 500, 0), null);
});

const burst = (samples: WheelSample[]) => samples.reduce<WheelBurst | null>((p, sample) => wheelBurst(p, sample), null)!;
const trace = (deltas: number[], interval = 55) => deltas.map((delta, i) => ({ delta, time: i * interval }));

test("one decaying gesture retains its destination regardless of sensitivity", () => {
  for (const scale of [.1, 1, 10]) {
    assert.equal(burst(trace([180, 120, 90, 60, 30, 15].map(d => d * scale))).released, false);
  }
  assert.equal(burst([{ delta: 1600, time: 0 }]).released, false);
  assert.equal(burst([
    { delta: 400, time: 0, momentum: false },
    { delta: 100, time: 80, momentum: true },
    { delta: 20, time: 240, momentum: true },
    { delta: 5, time: 550, momentum: true },
  ]).released, false, "explicit inertia stays with the original gesture, even with sparse tail events");
});

test("renewed input, a pause, reversal and sustained movement release the old destination", () => {
  for (const samples of [
    trace([180, 120, 60, 180, 120, 60]),
    trace([180, 180, 180, 180, 180, 180, 180, 180]),
    trace([180, 60, 60, 60, 60, 60, 60, 60, 60]),
    trace([200, 100, -30]),
    [{ delta: 100, time: 0 }, { delta: 100, time: 120 }],
    [{ delta: 30, time: 0, momentum: true }, { delta: 35, time: 16, momentum: false }],
  ]) assert.equal(burst(samples).released, true);
  assert.equal(burst(trace([180, 120, 60, 180, 120, 60, 20, 5])).released, true);
});

const sample = (distance: number, screen: number, rate = 1000) => {
  const motion = settleMotion(distance, screen);
  const positions: number[] = [];
  for (let i = 0; i <= Math.ceil(motion.duration * rate); i++) positions.push(motion.at(Math.min(i / rate, motion.duration)));
  const speeds = positions.map((x, i) => i ? (x - positions[i - 1]) * rate : 0);
  const extremes = positions.flatMap((x, i) => i && i < positions.length - 1 &&
    (x - positions[i - 1]) * (positions[i + 1] - x) < 0 ? [{ i, x }] : []);
  const crossings = positions.flatMap((x, i) => i && positions[i - 1] * x < 0 ? [i] : []);
  return { motion, positions, speeds, extremes, crossings, rate };
};

test("settling falls in like a tunnel through the earth and swings out against a stretching band", () => {
  const limit = SWING_MAX / FALLOFF;
  for (const [distance, screen] of [[20, 800], [100, 800], [240, 800], [364, 800], [640, 800], [700, 1080]]) {
    const { motion, positions, speeds, extremes, crossings: all, rate } = sample(distance, screen);
    const at = `${distance} of ${screen}`;
    // Crossings back over the section, after the first overshoot.
    const crossings = all.filter(i => i > extremes[0].i);
    assert.equal(positions[0], -distance);
    assert.equal(positions.at(-1), 0, `${at}: rests on the destination`);
    assert.ok(Math.abs(speeds.at(-1)!) < 1 && positions[1] + distance < distance * .005, `${at}: starts and ends at rest`);
    // Falling in: PULL_SECONDS from any distance up to the limit, proportionally longer beyond it;
    // faster all the way, and fastest exactly at the section.
    assert.ok(Math.abs(motion.arrival - PULL_SECONDS * Math.max(1, distance / (limit * screen))) < 1e-9, `${at}: fall time`);
    const arrival = Math.round(motion.arrival * rate);
    for (let i = 2; i <= arrival; i++) assert.ok(speeds[i] >= speeds[i - 1], `${at}: speeds up into the section`);
    const fastest = speeds.reduce((best, v, i) => Math.abs(v) > Math.abs(speeds[best]) ? i : best, 0);
    assert.ok(Math.abs(fastest - arrival) <= 1, `${at}: fastest at the section`);
    // Flying out: braking builds from nothing; the overshoot keeps FALLOFF of the arrival's swing,
    // at most SWING_MAX of the screen.
    const swing = FALLOFF * Math.min(distance, limit * screen);
    assert.ok(Math.abs(extremes[0].x - swing) < swing * .002 && Math.abs(motion.swing - swing) < 1e-9, `${at}: swing ${extremes[0].x} against ${swing}`);
    const brake = (i: number) => (speeds[i - 1] - speeds[i + 1]) * rate / 2;
    const out = extremes[0].i - arrival;
    let peak = 0;
    for (let i = arrival + 1; i < extremes[0].i; i++) peak = Math.max(peak, brake(i));
    assert.ok(brake(arrival + 2) < .1 * peak, `${at}: braking builds from nothing`);
    // Alternate sides, each FALLOFF of the one before; each swing out and each fall back takes the
    // same time; it glides in once the next overshoot would be under REST of the screen.
    for (let k = 1; k < extremes.length; k++) {
      assert.ok(extremes[k].x * extremes[k - 1].x < 0 && Math.abs(extremes[k].x / extremes[k - 1].x + FALLOFF) < .01, `${at}: overshoot ${k}`);
      assert.ok(Math.abs(extremes[k].i - crossings[k - 1] - out) <= 2, `${at}: swing ${k} out on time`);
    }
    for (let k = 0; k < crossings.length; k++)
      assert.ok(Math.abs(crossings[k] - extremes[k].i - PULL_SECONDS * rate) <= 2, `${at}: fall ${k} on time`);
    assert.ok(extremes.slice(0, -1).every(e => Math.abs(e.x) * FALLOFF >= REST * screen) &&
      Math.abs(extremes.at(-1)!.x) * FALLOFF < REST * screen, `${at}: glides in once the swings are small`);
  }
});

test("the motion has no pixel values: scaling the pull and the screen scales every position", () => {
  for (const scale of [.5, 1.35, 3]) {
    const small = settleMotion(240, 800), large = settleMotion(240 * scale, 800 * scale);
    assert.equal(large.duration, small.duration);
    for (let t = 0; t <= small.duration; t += 1 / 64) assert.ok(Math.abs(large.at(t) - scale * small.at(t)) < 1e-6 * scale * 240);
  }
});
