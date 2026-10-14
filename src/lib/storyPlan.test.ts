// Run with `npm run test:unit`. The plan's lengths are fed into an independent model of the
// CSS sticky rules (not the planner's own milestones), and the resulting positions are checked
// against the required sequence, cover, clearance and exit behaviour.
import { test } from "node:test";
import assert from "node:assert/strict";
import { exitOpacity, handoffOpacity, planHandoff, planRow, planStack, rowBudget, rowOpacity, stackBudget, stackOpacity, type Lane } from "./storyPlan.ts";

// CSS Positioned Layout 3, simplified to one axis: `bottom` only pushes a box up and `top`
// only pushes it down, neither beyond the containing block, and `top` wins a conflict.
function sticky(lane: Lane, deck: number, y: number, screen: number) {
  const natural = lane.top + lane.hold - y;
  const blockTop = lane.top - y;
  const blockBottom = deck - lane.end - y;
  let top = natural;
  if (lane.wait !== null) {
    const limit = screen - lane.wait - lane.height;
    if (top > limit) top = Math.max(limit, blockTop);
  }
  const pushed = Math.min(lane.park, blockBottom - lane.height);
  if (top < pushed) top = pushed;
  return top;
}

const screens = [548, 600, 659, 667, 740, 812, 852, 892, 956, 1024];
// Demonstration cards (MihawkAI, Kehsun, Skills) and Projects, whose cards have no
// scroll-played demonstration and are held for a shorter reading time.
const timing = { allow: 0.06, play: 0.8, read: 0.16, lastRead: 0.02 };
const projectTiming = { allow: 0.04, play: 0.34, read: 0.12, lastRead: 0.02 };
const near = (a: number, b: number, message: string) => assert.ok(Math.abs(a - b) <= 0.5, `${message}: ${a} vs ${b}`);

test("stack: wait at the line, rise with the scroll, park, cover and leave together", () => {
  let checked = 0;
  for (const S of screens)
    for (const intro of [110, 170, 240])
      for (const content of [[300, 320], [420, 410, 430, 400], [520, 500], [260, 250, 270]])
      for (const pace of [timing, projectTiming])
      for (const previewDuringArrival of [false, true]) {
        const preview = Math.round(S * 0.1);
        const plan = planStack({ screen: S, intro, gap: 24, bottom: 14, preview, minPreview: 48, content, timing: pace, previewDuringArrival });
        if (!plan.fits) continue;
        checked++;
        const { lanes, deck, park, parked, line, room, exit } = plan;
        const at = (i: number, y: number) => sticky(lanes[i], deck, y, S);
        for (let y = -S; y <= deck + S; y += 2) {
          for (let i = 1; i < lanes.length; i++) {
            const top = at(i, y);
            const previous = at(i - 1, y);
            // A waiting card never comes closer than half the gap to the parked card.
            if (top >= line - 0.5) assert.ok(top - (previous + room) >= 12 - 0.5 || previous < parked - 0.5);
            if (y >= plan.previewFrom[i] && y <= plan.takeoff[i]) near(top, line, `card ${i} waits (S=${S}, y=${y})`);
            if (y > plan.takeoff[i] && y < park[i]) near(top, line - (y - plan.takeoff[i]), `card ${i} rises 1:1`);
            if (y >= park[i] && y <= exit.release) {
              near(top, parked, `card ${i} parks`);
              near(previous, parked, `card ${i - 1} stays covered`);
            }
            // The rising card reaches the previous card only after its demonstration is read.
            if (top < previous + room - 0.5 && y < exit.release) assert.ok(y >= plan.readTo[i - 1] - 1, `card ${i} covers early at ${y}`);
          }
          if (y > exit.release)
            for (let i = 0; i < lanes.length; i++) near(at(i, y), parked - (y - exit.release), `card ${i} leaves together`);
        }
        // The first card rises into view: drawn faintly before its top reaches the bottom edge
        // (and throughout the strip a retracted toolbar uncovers), never appearing on screen,
        // brightening steadily, solid when it parks.
        let before = 0;
        for (let y = park[0] - S * 1.5; y <= park[0]; y += 2) {
          const top = sticky(lanes[0], deck, y, S);
          const o = stackOpacity(plan, 0, y);
          if (top < S * 1.2) assert.ok(o >= 0.2 - 1e-9, `card 0 is drawn at ${top.toFixed(0)}px (S=${S}): ${o}`);
          if (top <= S && top >= S - 4) assert.ok(o <= 0.25, `card 0 is faint at the bottom edge (${o})`);
          assert.ok(o >= before - 1e-9, "card 0 only brightens while it rises");
          before = o;
        }
        assert.equal(stackOpacity(plan, 0, park[0]), 1);
        for (let i = 1; i < lanes.length; i++) {
          assert.ok(plan.takeoff[i] - plan.previewFrom[i] >= S * 0.2 - 0.5, `card ${i} waits recognisably long (S=${S})`);
          const waiting = stackOpacity(plan, i, (plan.previewFrom[i] + plan.takeoff[i]) / 2);
          assert.ok(waiting > 0.2 && waiting < 0.4, `waiting preview is faint (${waiting})`);
          assert.equal(stackOpacity(plan, i, park[i]), 1);
          assert.ok(stackOpacity(plan, i, park[i] - 1) > 0.99, "opaque before parking");
          assert.ok(plan.playFrom[i] > park[i], "demonstration starts after parking");
        }
      }
  assert.ok(checked > 80, `enough fitting layouts (${checked})`);
});

test("stack: falls back when content or the preview cannot fit", () => {
  const tight = planStack({ screen: 548, intro: 240, gap: 24, bottom: 14, preview: 55, minPreview: 48, content: [360, 360], timing });
  assert.equal(tight.fits, false);
  const noPreview = planStack({ screen: 700, intro: 120, gap: 24, bottom: 14, preview: 70, minPreview: 48, content: [530, 530], timing });
  assert.equal(noPreview.fits, false);
  assert.match(noPreview.problems.join(), /recognisable/);
});

test("compact project cards arrive after their heading and preview successors as space opens", () => {
  for (const screen of screens) {
    const intro = 70;
    const gap = 24;
    const plan = planStack({ screen, intro, gap, bottom: 14, preview: screen * 0.1,
      minPreview: 48, content: [300, 300, 300], timing: projectTiming,
      leadScreens: 0.12, previewDuringArrival: true });
    assert.equal(plan.fits, true);
    const at = (i: number, y: number) => sticky(plan.lanes[i], plan.deck, y, screen);
    const headingBottom = intro;
    assert.ok(at(0, 0) - headingBottom > gap + screen * 0.08, "the first card is still rising when the heading parks");
    assert.ok(at(0, 0) - headingBottom < gap + screen * 0.2, "a short heading has only a short continuation");
    near(at(0, plan.park[0]), intro + gap, "the first card then parks below the heading");
    for (let i = 1; i < plan.lanes.length; i++) {
      assert.ok(plan.previewFrom[i] < plan.park[i - 1], "available space previews the next project before parking");
      near(at(i, plan.previewFrom[i]) - (at(i - 1, plan.previewFrom[i]) + plan.room), gap / 2, "early preview starts with clear space");
      assert.ok(plan.contact[i] >= plan.readTo[i - 1], "early previews do not shorten reading");
      // On a tall phone there is enough travel below the card to begin rising promptly.
      if (screen >= 812) assert.ok(plan.takeoff[i] - plan.park[i - 1] < screen * 0.17, "no extra post-parking wait");
    }
  }
});

test("handoff opacity completes at reachable page ends and reverses continuously", () => {
  const natural = 2000;
  const screen = 800;
  const plan = planHandoff({ screen, preview: 80, clearance: 12, minVisible: 32,
    inset: 0, height: 60, natural, previous: { lastPark: 1000, heldBottom: 400, fadeFrom: 1200, release: 1300 } });
  for (const active of [true, false]) {
    const current = { ...plan, active };
    const start = active ? plan.enterFrom : natural - screen;
    // Plenty of room, a short closing section, and a footer that ends during the waiting phase.
    for (const maxScroll of active ? [2200, 1500, 1200] : [2200, 1500, 1250]) {
      assert.equal(handoffOpacity(current, maxScroll, natural, screen, maxScroll), 1);
      const values = [];
      for (let y = start; y <= maxScroll; y++) values.push(handoffOpacity(current, y, natural, screen, maxScroll));
      for (let i = 1; i < values.length; i++) {
        assert.ok(values[i] >= values[i - 1], "the fade progresses monotonically");
        assert.ok(values[i] - values[i - 1] < 0.03, "no opacity jump at the end");
      }
      for (let i = values.length - 1; i >= 0; i--)
        assert.equal(handoffOpacity(current, start + i, natural, screen, maxScroll), values[i], "reverse visits show the same state");
    }
  }
});

test("handoff: incoming text keeps its clearance through the whole transition", () => {
  for (const S of screens)
    for (const flowGap of [16, 24, 40])
      for (const inset of [0, 24, 40])
      // Ordinary cards, and cards so tall that the waiting line must move below them.
      for (const tall of [S * 0.5, S - 140 - 24 - 14 - 60]) {
        const plan = planStack({ screen: S, intro: 140, gap: 24, bottom: 14, preview: Math.round(S * 0.1), minPreview: 48, content: [Math.round(tall), Math.round(tall * 0.96)], timing });
        if (!plan.fits) continue;
        const clearance = 12;
        // The next introduction follows the deck in normal flow.
        const natural = plan.deck + flowGap;
        const handoff = planHandoff({
          screen: S, preview: Math.round(S * 0.1), clearance, minVisible: 24, inset, height: 120, natural,
          previous: plan.exit,
        });
        const lane: Lane = { top: natural - handoff.reach, hold: handoff.reach, park: -Infinity, wait: handoff.wait, height: 120, end: 0 };
        for (let y = plan.exit.lastPark - S; y <= plan.deck + S; y += 2) {
          const text = (handoff.active ? sticky(lane, natural + 120, y, S) : natural - y) + inset;
          const held = Math.max(...plan.lanes.map(l => sticky(l, plan.deck, y, S))) + plan.room;
          if (text < S && held > 0) assert.ok(text - held >= Math.min(clearance, flowGap + inset) - 0.5, `clearance ${text - held} at ${y} (S=${S})`);
          if (handoff.active && y >= plan.exit.lastPark && y <= handoff.takeoff) {
            near(text, handoff.line, "heading waits at its line");
            assert.ok(text - held >= clearance - 0.5, `waiting heading clears the parked card (${text - held})`);
          }
        }
      }
});

// MihawkAI's row on wide screens (desktop sizes, and the agreed pacing).
const wide = [560, 600, 700, 720, 768, 800, 864, 900, 1080, 1200];
const rowTiming = { allow: 0.06, play: 0.9, read: 0.25 };

test("centred rows balance the visible composition and release the header with both cards", () => {
  for (const screen of [633, 704, 800, 1080]) {
    const intro = 120, inset = 30, gap = 24;
    const plan = planRow({ screen, intro, introInset: inset, gap, bottom: 14,
      content: [420, 400], timing: rowTiming, center: true });
    assert.equal(plan.fits, true);
    near(plan.introOffset + inset, screen - plan.exit.heldBottom, "equal visible space above and below");
    const header: Lane = { top: 0, hold: 0, park: plan.introOffset, wait: null, height: intro, end: plan.trackEnd };
    for (const after of [0, 25, 80]) {
      const y = plan.exit.release + after;
      near(sticky(header, plan.deck, y, screen), plan.introOffset - after, "header releases with the row");
      near(sticky(plan.lanes[0], plan.deck, y, screen), plan.parked - after, "card releases with the header");
    }
    const plain = planRow({ screen, intro, gap, bottom: 14, content: [420, 400], timing: rowTiming });
    assert.equal(plain.introOffset, 0, "centering is opt-in, not a change to the phone/shared defaults");
    near(plan.playTo - plan.playFrom, plain.playTo - plain.playFrom, "playback distance is unchanged");
  }
});

test("row: rises as one, parks level, plays together, stays complete for its reading time, then leaves together", () => {
  let checked = 0;
  for (const S of wide)
    for (const intro of [104, 120, 160])
      for (const content of [[470, 396], [425, 395], [300, 520], [250, 250]]) {
        const plan = planRow({ screen: S, intro, gap: 24, bottom: 14, content, timing: rowTiming });
        if (!plan.fits) continue;
        checked++;
        const { lanes, deck, park, parked, room, exit } = plan;
        assert.deepEqual(lanes[1], lanes[0], "both cards share one lane geometry");
        assert.equal(room, Math.max(...content), "every card is as tall as the tallest content");
        const at = (i: number, y: number) => sticky(lanes[i], deck, y, S);
        for (let y = -S; y <= deck + S; y += 2) {
          near(at(1, y), at(0, y), `the cards stay level (S=${S}, y=${y})`);
          const top = at(0, y);
          if (y < park) near(top, parked + plan.lead - y, "the row rises with the page");
          if (y >= park && y <= exit.release) near(top, parked, "the row is held below the introduction");
          if (y > exit.release) near(top, parked - (y - exit.release), "the row leaves with the page");
        }
        assert.ok(at(0, park) + room <= S - 14 + 0.5, "the parked row fits above the bottom spacing");
        // Both demonstrations share one interval after parking, then the completed row is read.
        assert.ok(plan.playFrom > park, "the demonstrations start after parking");
        near(plan.playTo - plan.playFrom, S * rowTiming.play, "one shared demonstration interval");
        assert.ok(plan.readTo - plan.playTo >= S * 0.25 - 0.5, "a quarter of a screen to read the completed row");
        for (let y = park; y <= exit.release; y += 2) assert.equal(exitOpacity(exit, y, S), 1, `fully visible while held (${y})`);
        for (let y = exit.release + 2; y <= exit.release + S * 0.5; y += 2) {
          assert.ok(at(0, y) < parked, "leaving begins after the reading time");
          assert.ok(exitOpacity(exit, y, S) < 1, "fading begins with leaving");
        }
        // The row enters exactly like a stack's first card of the same height.
        const single = planStack({ screen: S, intro, gap: 24, bottom: 14, preview: S * 0.1, minPreview: 48, content: [room], timing });
        assert.deepEqual({ ...lanes[0], end: 0 }, { ...single.lanes[0], end: 0 }, "the same lane as a stack's first card");
        let before = 0;
        for (let y = park - S * 1.5; y <= park; y += 2) {
          const o = rowOpacity(plan, y);
          assert.equal(o, stackOpacity(single, 0, y), `the same entrance as a stack's first card (${y})`);
          const top = at(0, y);
          if (top < S * 1.2) assert.ok(o >= 0.2 - 1e-9, `the row is drawn at ${top.toFixed(0)}px (S=${S})`);
          if (top <= S && top >= S - 4) assert.ok(o <= 0.25, "the row is faint at the bottom edge");
          assert.ok(o >= before - 1e-9, "the row only brightens while it rises");
          before = o;
        }
        assert.equal(rowOpacity(plan, park), 1);
        // Two demonstrations together take less scrolling than the same cards stacked one after another.
        const stacked = planStack({ screen: S, intro, gap: 24, bottom: 14, preview: S * 0.1, minPreview: 48, content, timing });
        if (stacked.fits) assert.ok(deck < stacked.deck, `the row is shorter than the stack (${deck} vs ${stacked.deck})`);
      }
  assert.ok(checked > 80, `enough fitting rows (${checked})`);
});

test("row: falls back when it cannot fit below the introduction", () => {
  const tall = planRow({ screen: 560, intro: 120, gap: 24, bottom: 14, content: [470, 396], timing: rowTiming });
  assert.equal(tall.fits, false);
  assert.match(tall.problems.join(), /the row needs 470px, 402px available/);
});

test("handoff after a row: the next heading waits from parking, near the bottom, with its clearance", () => {
  for (const S of wide)
    for (const inset of [0, 24])
      for (const content of [[470, 396], [S - 120 - 24 - 14 - 40, 300]]) {
        const plan = planRow({ screen: S, intro: 120, gap: 24, bottom: 14, content, timing: rowTiming });
        if (!plan.fits) continue;
        const clearance = 12;
        const natural = plan.deck + 24;
        const handoff = planHandoff({ screen: S, preview: Math.round(S * 0.1), clearance, minVisible: 32, inset, height: 120, natural, previous: plan.exit });
        assert.equal(handoff.active, true, `the next heading previews (S=${S})`);
        assert.equal(handoff.waitFrom, plan.park, "it waits from the moment the row parks");
        assert.ok(handoff.line >= S - Math.round(S * 0.1) - 0.5, "near the bottom of the screen");
        const lane: Lane = { top: natural - handoff.reach, hold: handoff.reach, park: -Infinity, wait: handoff.wait, height: 120, end: 0 };
        for (let y = plan.park - S; y <= plan.deck + S; y += 2) {
          const text = sticky(lane, natural + 120, y, S) + inset;
          const held = sticky(plan.lanes[0], plan.deck, y, S) + plan.room;
          if (text < S && held > 0) assert.ok(text - held >= Math.min(clearance, 24 + inset) - 0.5, `clearance ${text - held} at ${y} (S=${S})`);
          if (y >= plan.park && y <= handoff.takeoff) near(text, handoff.line, "the heading waits at its line");
        }
      }
});

// A picture shrinks to fit exactly these budgets (fitPicture), so each must be the planner's own limit.
test("budgets: the tallest content each planner holds, and no more", () => {
  for (const S of [...screens, ...wide])
    for (const intro of [104, 170])
      for (const count of [1, 2, 4]) {
        const size = { screen: S, intro, gap: 24, bottom: 14, preview: Math.round(S * 0.1), minPreview: 48 };
        const budget = Math.floor(stackBudget({ ...size, count }));
        if (budget <= 0) continue;
        const at = (height: number) => planStack({ ...size, content: Array(count).fill(height), timing }).fits;
        assert.equal(at(budget), true, `a stack holds ${budget}px (S=${S}, ${count} cards)`);
        assert.equal(at(budget + 2), false, `a stack does not hold ${budget + 2}px (S=${S}, ${count} cards)`);
        const row = Math.floor(rowBudget(size));
        assert.equal(planRow({ ...size, content: [row, row - 40], timing: rowTiming }).fits, true, `a row holds ${row}px (S=${S})`);
        assert.equal(planRow({ ...size, content: [row + 2, row - 40], timing: rowTiming }).fits, false, `a row does not hold ${row + 2}px (S=${S})`);
      }
});
