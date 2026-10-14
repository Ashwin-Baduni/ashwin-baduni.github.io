export type ReadingRange = {
  start: number;
  end: number;
  // Scroll positions where a small slice enters from below / above.
  enter: number;
  leave: number;
};
export type Destination = { index: number; target: number; pickup: number; direction: number };

// Remember the next section at the beginning of a gesture. The resting position alone cannot
// tell a small approach from a fling that has already passed that section.
export function destination(ranges: ReadingRange[], origin: number, direction: number): Destination | null {
  if (direction > 0) {
    const index = ranges.findIndex(r => r.start > origin + 2);
    if (index < 1) return null;
    const next = ranges[index];
    return { index, target: next.start, pickup: Math.min(next.start, Math.max(ranges[index - 1].end + 6, next.enter)), direction };
  }
  if (direction < 0) {
    const index = ranges.findLastIndex(r => r.end < origin - 2);
    if (index < 0 || index >= ranges.length - 1) return null;
    const previous = ranges[index];
    return { index, target: previous.end, pickup: Math.max(previous.end, Math.min(ranges[index + 1].start - 6, previous.leave)), direction };
  }
  return null;
}

export function reached(intent: Destination, y: number) {
  return (y - intent.pickup) * intent.direction >= 0 && Math.abs(y - intent.target) >= 6;
}

// After repeated or interrupted scrolling, forget the original destination. Resting between two
// sections, go on to the next one in the direction of travel, however little of it shows: a
// low-sensitivity wheel must never be sent back. Inside a reading interval, stay put.
export function settleTarget(ranges: ReadingRange[], y: number, direction: number): Destination | null {
  if (ranges.some(r => y >= r.start - 2 && y <= r.end + 2)) return null;
  return destination(ranges, y, direction);
}

export type WheelSample = { time: number; delta: number; momentum?: boolean };
export type WheelBurst = {
  first: number;
  last: number;
  direction: number;
  peak: number;
  magnitude: number;
  decaying: boolean;
  lastDecay: number;
  momentum: boolean;
  released: boolean;
};

// No device classification. A decaying tail belongs to its original gesture. A pause,
// renewed impulse, reversal or sustained drive releases its original destination. Platforms
// exposing WheelEvent.momentum also let us recognise new physical input after inertia.
// Without that signal this is necessarily a conservative heuristic, not finger-lift detection.
export function wheelBurst(previous: WheelBurst | null, sample: WheelSample): WheelBurst {
  const magnitude = Math.abs(sample.delta);
  const direction = Math.sign(sample.delta);
  if (!previous) return {
    first: sample.time, last: sample.time, direction, peak: magnitude, magnitude,
    decaying: false, lastDecay: sample.time, momentum: sample.momentum === true, released: false,
  };
  const decaying = previous.decaying || magnitude < previous.peak * .65;
  const lastDecay = magnitude < previous.magnitude * .95 ? sample.time : previous.lastDecay;
  const renewed = direction !== previous.direction ||
    (previous.momentum && sample.momentum === false) ||
    (sample.momentum !== true && (sample.time - previous.last > 100 ||
      (previous.decaying && magnitude > Math.max(8, previous.magnitude * 1.6))));
  const sustained = sample.time - previous.first > 350 && sample.time - lastDecay > 180 && sample.momentum !== true;
  return {
    first: previous.first, last: sample.time, direction, magnitude,
    peak: Math.max(previous.peak, magnitude), decaying, lastDecay,
    momentum: sample.momentum === true,
    released: previous.released || renewed || sustained,
  };
}

/*
  The settling motion, like falling through a tunnel through the earth: the section pulls the
  page with a force that grows with the distance from it, as gravity does inside a planet.
  - Falling in, nothing is lost: the page speeds up all the way and is fastest at the section.
    Each fall takes PULL_SECONDS from wherever it begins; only the speed differs.
  - Flying out, the pull acts like a rubber band that absorbs energy as it stretches: the braking
    builds from nothing at the section, and each overshoot keeps FALLOFF of the swing (the first,
    FALLOFF of the pull).
  - Like a falling object's top speed, no pull arrives faster than one whose overshoot reaches
    SWING_MAX of the screen. A longer pull falls under a proportionally gentler pull instead, so
    its fall takes longer, and the band never changes.
  - It swings on alternate sides until the next overshoot would be under REST of the screen,
    then glides into place.
  No length is a pixel value.
*/
export const PULL_SECONDS = .3;
export const FALLOFF = .33;
export const SWING_MAX = .15;
export const REST = .003;

export type Motion = { duration: number; arrival: number; swing: number; at: (time: number) => number };

type Outward = { shape: (share: number) => number; end: number };
let outward: Outward | undefined;

// An outward swing in units of its undamped amplitude and of 1/ω: X'' = -X - k·X·X' from X = 0
// at unit speed, with k chosen so that it turns at FALLOFF. Solved once, on first use.
function outwardSwing(): Outward {
  if (outward) return outward;
  const step = 1 / 1024;
  const solve = (k: number) => {
    const force = (x: number, v: number) => -x - k * x * v;
    const path = [0];
    let x = 0;
    let v = 1;
    for (;;) {
      const a1 = force(x, v);
      const x2 = x + step / 2 * v, v2 = v + step / 2 * a1, a2 = force(x2, v2);
      const x3 = x + step / 2 * v2, v3 = v + step / 2 * a2, a3 = force(x3, v3);
      const x4 = x + step * v3, v4 = v + step * a3, a4 = force(x4, v4);
      const nextX = x + step / 6 * (v + 2 * v2 + 2 * v3 + v4);
      const nextV = v + step / 6 * (a1 + 2 * a2 + 2 * a3 + a4);
      if (nextV <= 0) {
        const share = v / (v - nextV);
        return { path, end: (path.length - 1 + share) * step, top: x + (nextX - x) * share };
      }
      x = nextX;
      v = nextV;
      path.push(x);
    }
  };
  let low = 0, high = 1000;
  for (let i = 0; i < 50; i++) {
    const mid = (low + high) / 2;
    if (solve(mid).top > FALLOFF) low = mid; else high = mid;
  }
  const { path, end, top } = solve((low + high) / 2);
  const last = path.length - 1;
  const shape = (share: number) => {
    const time = share * end;
    const i = Math.floor(time / step);
    if (i >= last) return (path[last] + (top - path[last]) * (time - last * step) / (end - last * step)) / top;
    return (path[i] + (path[i + 1] - path[i]) * (time / step - i)) / top;
  };
  return outward = { shape, end };
}

type Part = { end: number; at: (t: number) => number };

// Displacement from the destination along the correction: -distance at rest when it begins,
// positive past the destination, 0 at rest when it ends.
export function settleMotion(distance: number, screen: number): Motion {
  const omega = Math.PI / 2 / PULL_SECONDS;
  const { shape, end } = outwardSwing();
  const parts: Part[] = [];
  let time = 0;
  const add = (length: number, at: (t: number) => number) => {
    const start = time;
    time += length;
    parts.push({ end: time, at: t => at(t - start) });
  };
  // Falling in from rest, undamped: a quarter of a swing, gentler for a pull beyond the limit.
  const limit = SWING_MAX * screen / FALLOFF;
  const fall = omega * Math.min(1, limit / distance);
  const arrival = Math.PI / 2 / fall;
  add(arrival, t => -distance * Math.cos(fall * t));
  // The swing the arrival speed would reach on the band without losses.
  let extent = Math.min(distance, limit);
  let side = 1;
  let first = 0;
  for (;;) {
    // Flying out at the speed it fell in with.
    const overshoot = FALLOFF * extent;
    const out = side * overshoot;
    add(end / omega, t => out * shape(t * omega / end));
    extent = overshoot;
    first ||= overshoot;
    // Falling back in, undamped, or a final glide into place once the swings are small.
    const from = side * extent;
    if (extent * FALLOFF < REST * screen) {
      add(PULL_SECONDS, t => { const u = t / PULL_SECONDS; return from * (1 - u * u * (3 - 2 * u)); });
      break;
    }
    add(PULL_SECONDS, t => from * Math.cos(omega * t));
    side = -side;
  }
  const duration = time;
  const at = (t: number) => {
    if (t <= 0) return -distance;
    if (t >= duration) return 0;
    return parts.find(part => t < part.end)!.at(t);
  };
  return { duration, arrival, swing: first, at };
}
