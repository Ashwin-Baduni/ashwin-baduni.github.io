import { test } from "node:test";
import assert from "node:assert/strict";
import { planSkills, skillAt, skillOpacity } from "./skillPlan.ts";
import { handoffOpacity, planHandoff, planStack } from "./storyPlan.ts";

test("desktop Skills balances its spare height and previews Experience throughout the sequence", () => {
  for (const screen of [560, 633, 657, 800, 1080]) {
    const plan = planSkills({ screen, intro: 0, gap: 24, bottom: 18,
      content: [474], count: 4, preview: screen * .15 });
    assert.equal(plan.fits, true);
    const handoff = planHandoff({ screen, preview: screen * .15, clearance: 12,
      minVisible: 32, inset: 0, height: 60, natural: plan.deck + 40, previous: plan.exit });
    assert.equal(handoff.active, true);
    assert.ok(handoff.line >= plan.exit.heldBottom + 12);
    assert.ok(handoff.line <= screen - 32);
    if (plan.introOffset > 0) {
      assert.ok(Math.abs(plan.introOffset - (handoff.line - 12 - plan.exit.heldBottom)) < 1e-8,
        "spare height is shared above and below the composition");
    }
    for (const y of [...plan.starts, ...plan.anchors]) {
      assert.ok(handoffOpacity(handoff, y, handoff.origin, screen, Infinity) >= .28,
        "the real Experience heading is visible throughout every held chapter");
    }
  }
});

test("shared frame chapters complete, hold, then change without overlapping illustrations", () => {
  for (const screen of [560, 657, 768, 800, 1080]) {
    const plan = planSkills({ screen, intro: 0, gap: 24, bottom: 18, content: [474], count: 4, preview: screen * .15 });
    assert.equal(plan.fits, true);
    assert.equal(plan.lanes.length, 1, "one sticky frame serves all chapters");
    for (let i = 0; i < 4; i++) {
      assert.ok(plan.from[i] > plan.starts[i], "assembly starts after arrival");
      assert.ok(plan.anchors[i] > plan.to[i] && plan.anchors[i] < plan.ends[i]);
      assert.equal(skillAt(plan, plan.anchors[i]), i);
      assert.deepEqual([0, 1, 2, 3].map(index => skillOpacity(plan, index, plan.anchors[i])), [0, 1, 2, 3].map(index => +(i === index)));
      if (i) assert.ok(plan.starts[i] > plan.ends[i - 1], "transition follows the completed reading interval");
    }
    for (let y = plan.starts[0]; y <= plan.exit.release; y++) {
      const visible = [0, 1, 2, 3].map(i => skillOpacity(plan, i, y));
      assert.ok(visible.filter(n => n > 0).length <= 1, "diagrams never overlap during transitions");
      assert.ok(visible.every(n => n >= 0 && n <= 1));
    }
    assert.equal(plan.exit.release, plan.ends[3]);
    assert.equal(plan.exit.lastPark, plan.starts[0], "Experience previews from the first chapter");
  }
});

test("15% preview rises where space permits and preserves clearance on short screens", () => {
  for (const screen of [548, 659, 812, 932, 1080]) {
    for (const content of [screen * 0.35, screen * 0.55]) {
      const plan = planStack({ screen, intro: 120, gap: 24, bottom: 16, preview: screen * .15,
        minPreview: 48, content: [content, content], timing: { allow: .06, play: .8, read: .16, lastRead: .02 } });
      if (!plan.fits) continue;
      assert.ok(Math.abs(plan.line - Math.max(screen * .85, plan.parked + plan.room + 12)) < 1e-8);
      const handoff = planHandoff({ screen, preview: screen * .15, clearance: 12, minVisible: 32,
        inset: 0, height: 100, natural: plan.deck + 24, previous: plan.exit });
      assert.ok(handoff.line >= plan.exit.heldBottom + 12);
      assert.ok(handoff.line >= screen * .85 - 1e-8);
    }
  }
});
