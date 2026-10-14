/*
  Pure analysis of sampled DOM geometry, shared by the browser checks and unit-tested on its own
  (tests/analysis.test.ts). Nothing here reads the planner's numbers.
*/
export type Item = {
  section: string;
  kind: "card" | "intro" | "text" | "content";
  index: number;
  top: number;
  bottom: number;
  left: number;
  right: number;
  ty: number;
  opacity: number;
};
export type Sample = { y: number; items: Item[] };

export const CLEARANCE = 10;

/*
  Visible incoming introduction text never meets visible outgoing content, faint or not. The
  outgoing section is the one before it in document order (`order`). Any outgoing element that
  overlaps the text horizontally must lie wholly above it with the clearance to spare: touching,
  intersecting, or passing below the text's top all fail.
*/
export function clearanceFailures(samples: Sample[], screen: number, order: string[]) {
  const failures: string[] = [];
  const visible = (it: Item) => it.opacity > 0.01 && it.bottom > 0 && it.top < screen && it.bottom > it.top;
  for (const { y, items } of samples) {
    for (const text of items.filter((it) => it.kind === "text" && visible(it))) {
      const previous = order[order.indexOf(text.section) - 1];
      if (!previous) continue;
      for (const out of items.filter((it) => it.section === previous && it.kind !== "intro" && visible(it))) {
        if (out.right <= text.left || out.left >= text.right) continue;
        const gap = text.top - out.bottom;
        if (gap < CLEARANCE)
          failures.push(`y=${y}: ${text.section} heading (opacity ${text.opacity.toFixed(2)}) is ${gap.toFixed(1)}px from ${out.section} ${out.kind} ${out.index} (opacity ${out.opacity.toFixed(2)})`);
      }
    }
  }
  return failures;
}

// Held, waiting and introduction elements are positioned by the browser, never by a transform
// that follows the scroll position.
export function transformFailures(samples: Sample[], screen: number) {
  const failures = new Map<string, string>();
  for (let s = 1; s < samples.length; s++)
    samples[s].items.forEach((item, i) => {
      if (item.kind === "content") return;
      const before = samples[s - 1].items[i];
      const visible = item.bottom > 0 && item.top < screen && item.opacity > 0.01;
      if (visible && Math.abs(item.ty - before.ty) > 0.5) {
        const key = `${item.section} ${item.kind} ${item.index}`;
        if (!failures.has(key))
          failures.set(key, `${key}: transform moved ${(item.ty - before.ty).toFixed(1)}px for ${samples[s].y - samples[s - 1].y}px of scroll at y=${samples[s].y}`);
      }
    });
  return [...failures.values()];
}

export function series(samples: Sample[], section: string, kind: Item["kind"], index: number) {
  return samples.map((sample) => {
    const item = sample.items.find((it) => it.section === section && it.kind === kind && it.index === index)!;
    return { y: sample.y, ...item };
  });
}

// Runs of scroll positions over which a value stays still (within 0.5px).
export function plateaus(points: Array<{ y: number; top: number }>, minLength: number) {
  const runs: Array<{ from: number; to: number; top: number }> = [];
  let start = 0;
  for (let i = 1; i <= points.length; i++) {
    if (i < points.length && Math.abs(points[i].top - points[start].top) <= 0.5) continue;
    const run = { from: points[start].y, to: points[i - 1].y, top: points[start].top };
    if (Math.abs(run.to - run.from) >= minLength) runs.push(run);
    start = i;
  }
  return runs;
}
