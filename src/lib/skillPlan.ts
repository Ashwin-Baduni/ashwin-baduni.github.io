import { planRow, type RowInput } from "./storyPlan.ts";

// One browser-held frame, four scroll chapters. The transition occupies its own interval:
// finish reading the old diagram before fading it, then build the next after its fade-in.
export function planSkills(input: Omit<RowInput, "timing"> & { count: number; preview: number }) {
  // Centre the composition in the space above the next heading's preview, not in the full
  // screen. On shorter windows the offset contracts to zero without shrinking the content.
  const height = input.intro + input.gap + Math.max(...input.content);
  const clearance = Math.max(12, input.gap / 2);
  const introOffset = Math.max(0, (input.screen - input.preview - clearance - height) / 2);
  const base = planRow({ ...input, intro: input.intro + introOffset,
    timing: { allow: 0.06, play: 0.7, read: 0.2 } });
  const span = input.screen * 0.96;
  const transition = input.screen * 0.14;
  const starts = Array.from({ length: input.count }, (_, i) => base.park + i * (span + transition));
  const from = starts.map(start => start + input.screen * 0.06);
  const to = from.map(start => start + input.screen * 0.7);
  const ends = to.map(end => end + input.screen * 0.2);
  const release = ends.at(-1)!;
  return {
    ...base, introOffset, starts, from, to, ends, transition,
    anchors: to.map(end => end + input.screen * 0.1),
    deck: release + base.exit.heldBottom,
    // There is only one frame to park. Experience waits below it throughout all four chapters.
    exit: { ...base.exit, lastPark: base.park, fadeFrom: release, release },
  };
}
export type SkillPlan = ReturnType<typeof planSkills>;
export function skillAt(plan: SkillPlan, y: number) {
  return plan.starts.reduce((active, start, i) => i > 0 && y >= start - plan.transition / 2 ? i : active, 0);
}
const clamp = (n: number) => Math.min(1, Math.max(0, n));
export function skillOpacity(plan: SkillPlan, index: number, y: number) {
  const entering = index === 0 ? 1 : clamp((y - (plan.starts[index] - plan.transition / 2)) / (plan.transition / 2));
  const leaving = index === plan.starts.length - 1 ? 1 : 1 - clamp((y - plan.ends[index]) / (plan.transition / 2));
  return Math.min(entering, leaving);
}
