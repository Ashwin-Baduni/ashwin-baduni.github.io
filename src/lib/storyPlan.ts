/*
  Story geometry as plain numbers, shared by the card stacks (MihawkAI, Kehsun, Skills and
  Projects), MihawkAI's row on wide screens, and the handoffs between sections. Every length is
  in CSS pixels.

  The browser holds everything that waits, parks or leaves. Each card sits in its own lane,
  an absolutely positioned box that ends at the story's common exit. A transparent spacer at
  the top of the lane (`hold`) lets the card's `position: sticky` lift it over that space:
  `bottom` keeps a waiting card's top at the preview line, `top` parks it, and the lane's end
  releases it. Nothing here follows the scroll position frame by frame; these numbers change
  only when the layout does.

  Scroll positions are relative to the moment the story's deck reaches the viewport top.
*/

export type Lane = {
  // Lane top, relative to the deck.
  top: number;
  // Spacer before the card: how far the browser can lift the card while it waits.
  hold: number;
  // Sticky top: where the card parks.
  park: number;
  // Sticky bottom, or null when the card should simply arrive with the page.
  wait: number | null;
  // Card height while held.
  height: number;
  // Distance between the lane's end and the deck's end, so every card leaves together.
  end: number;
};

export type Timing = {
  // In screen heights, after a card parks: stillness, demonstration, reading.
  allow: number;
  play: number;
  read: number;
  // Reading time of the final card before the whole story leaves.
  lastRead: number;
};

export type Exit = {
  // When the final card parks: the next introduction may start to wait below it.
  lastPark: number;
  // Lowest held content while parked, as a viewport position.
  heldBottom: number;
  // The outgoing story starts to fade, then leaves the screen.
  fadeFrom: number;
  release: number;
};

export type StackInput = {
  screen: number;
  intro: number;
  gap: number;
  bottom: number;
  // Visible height of a waiting card.
  preview: number;
  // The smallest preview that is still recognisable.
  minPreview: number;
  // Natural content height of every card.
  content: number[];
  timing: Timing;
  // Scroll from the deck reaching the top to the first card parking, in screens.
  leadScreens?: number;
  // Let a next card preview while the previous one is still arriving, once there is clearance.
  // Useful for compact project cards; demonstration stories keep their existing pacing.
  previewDuringArrival?: boolean;
};

export type StackPlan = {
  fits: boolean;
  problems: string[];
  room: number;
  // Sticky top of a parked card: below the introduction and the gap.
  parked: number;
  // Top of a waiting card, as a viewport position.
  line: number;
  peek: number;
  lead: number;
  deck: number;
  // Intro track's bottom inset within the deck.
  trackEnd: number;
  lanes: Lane[];
  // Per card: the first card's arrival, then parking, the demonstration and its reading.
  // `arrival` is when the first card is a fifth of a screen below the bottom edge; `rise` is its
  // travel from the bottom edge to its parked place.
  arrival: number;
  rise: number;
  park: number[];
  takeoff: number[];
  // When each later card reaches its waiting line, possibly before the previous card parks.
  previewFrom: number[];
  // A rising card reaches the previous card's bottom edge.
  contact: number[];
  playFrom: number[];
  playTo: number[];
  readTo: number[];
  // Chapter links land midway through reading.
  anchors: number[];
  exit: Exit;
};

const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));
// The shortest time, in screens, that a next card waits faintly before it rises.
const MIN_WAIT = 0.2;
// How far below the small viewport's bottom edge the first card is already faintly drawn, so it
// rises into view rather than appearing on screen, also while a phone's toolbar is retracted and
// the visible screen extends below the small viewport.
const BELOW = 0.2;

export function planStack(input: StackInput): StackPlan {
  const { screen: S, intro, gap, bottom, preview, minPreview, content, timing } = input;
  const count = content.length;
  const problems: string[] = [];
  const tallest = Math.max(...content);
  const room = Math.floor(Math.min(tallest, S - intro - gap - bottom));
  const parked = intro + gap;
  // A waiting card stays clear of the parked card above it.
  const line = Math.max(S - preview, parked + room + gap / 2);
  const peek = S - line;
  const lead = clamp(S * (input.leadScreens ?? 0.28), 0, Math.max(0, S - intro - gap));
  if (room <= 0) problems.push("no room below the introduction");
  if (tallest > room + 1) problems.push(`a card needs ${Math.ceil(tallest)}px, ${room}px available`);
  if (count > 1 && peek < Math.min(preview, minPreview))
    problems.push(`the next card would show ${Math.round(peek)}px, below a recognisable preview`);

  const park: number[] = [lead];
  const takeoff: number[] = [lead];
  const contact: number[] = [lead];
  const playFrom: number[] = [];
  const playTo: number[] = [];
  const readTo: number[] = [];
  const reading = (i: number) => (i === count - 1 ? timing.lastRead : timing.read);
  const below = line - (parked + room);
  const advance = input.previewDuringArrival ? Math.max(0, below - gap / 2) : 0;
  const previewFrom: number[] = [lead];
  for (let i = 0; i < count; i++) {
    if (i > 0) {
      // Spare space below a compact card can show its successor during arrival. At that point
      // the two cards still have half the gap between them. Count this actual preview time
      // towards the minimum wait, rather than starting another wait when the first card parks.
      // Rising with the scroll, it reaches the previous card only after its reading interval.
      previewFrom[i] = park[i - 1] - advance;
      takeoff[i] = Math.max(previewFrom[i] + S * MIN_WAIT, readTo[i - 1] - below);
      contact[i] = takeoff[i] + below;
      park[i] = takeoff[i] + (line - parked);
    }
    playFrom[i] = park[i] + S * timing.allow;
    playTo[i] = playFrom[i] + S * timing.play;
    readTo[i] = playTo[i] + S * reading(i);
  }
  const release = readTo[count - 1];
  const heldBottom = parked + room;
  const lanes: Lane[] = content.map((_, i) =>
    i === 0
      ? { top: 0, hold: parked + lead, park: parked, wait: null, height: room, end: 0 }
      : {
          top: previewFrom[i] + line,
          hold: takeoff[i] - previewFrom[i],
          park: parked,
          wait: S - line - room,
          height: room,
          end: 0,
        },
  );
  return {
    fits: problems.length === 0,
    problems,
    room,
    parked,
    line,
    peek,
    lead,
    deck: release + heldBottom,
    trackEnd: heldBottom - intro,
    lanes,
    arrival: lead - (S - parked) - S * BELOW,
    rise: S - parked,
    park,
    takeoff,
    previewFrom,
    contact,
    playFrom,
    playTo,
    readTo,
    anchors: playTo.map((end, i) => end + (S * reading(i)) / 2),
    exit: { lastPark: park[count - 1], heldBottom, fadeFrom: playTo[count - 1], release },
  };
}

// The tallest card content planStack can hold: below the introduction and above the bottom
// spacing, and, with more than one card, low enough that the next card's preview stays
// recognisable below it.
export function stackBudget(input: Omit<StackInput, "content" | "timing"> & { count: number }) {
  const { screen: S, intro, gap, bottom, preview, minPreview, count } = input;
  return S - intro - gap - (count > 1 ? Math.max(bottom, gap / 2 + Math.min(preview, minPreview)) : bottom);
}

// The first card rises into view faint from the bottom edge and is solid once it has covered
// 70% of its rise; every later card waits faintly, then becomes solid while it rises, before it
// parks.
export function stackOpacity(plan: StackPlan, i: number, y: number, faint = 0.26) {
  if (i === 0) {
    if (y <= plan.arrival) return 0;
    // 0 with the card's top at the bottom edge, 1 when it parks.
    const risen = (y - (plan.park[0] - plan.rise)) / Math.max(1, plan.rise);
    return 0.2 + 0.8 * clamp(risen / 0.7);
  }
  if (y >= plan.park[i]) return 1;
  const entering = plan.peek > 0 ? clamp((y - (plan.previewFrom[i] - plan.peek)) / plan.peek) : 1;
  const moving = clamp((y - plan.takeoff[i]) / Math.max(1, plan.park[i] - plan.takeoff[i]));
  return entering * (faint + (1 - faint) * clamp(moving / 0.62));
}

/*
  A row: two cards side by side, for a wide screen. Both sit in identical lanes, so the browser
  holds them level and equal in height (the taller card's content sets the height). The row
  rises into view as one, exactly like a stack's first card. Once it parks, both demonstrations
  play over the same interval; the completed row then stays fully visible for its reading time,
  and only then does the story leave and fade. Nothing waits below the cards: the cue for what
  comes next is the following section's heading, waiting from the moment the row parks.
*/
export type RowTiming = {
  // In screen heights, after the row parks: stillness, both demonstrations together, then
  // reading the completed row before the story leaves.
  allow: number;
  play: number;
  read: number;
};

export type RowInput = {
  screen: number;
  intro: number;
  gap: number;
  bottom: number;
  // Natural content height of every card in the row.
  content: number[];
  timing: RowTiming;
  // Scroll from the deck reaching the top to the row parking, in screens.
  leadScreens?: number;
  // Wide product rows centre their visible introduction and cards as one composition.
  center?: boolean;
  introInset?: number;
};

export type RowPlan = {
  fits: boolean;
  problems: string[];
  // Height of every card: the tallest card's content.
  room: number;
  parked: number;
  introOffset: number;
  lead: number;
  deck: number;
  trackEnd: number;
  lanes: Lane[];
  // As for a stack's first card: `arrival` is when the row is a fifth of a screen below the
  // bottom edge; `rise` is its travel from the bottom edge to its parked place.
  arrival: number;
  rise: number;
  park: number;
  playFrom: number;
  playTo: number;
  readTo: number;
  // Chapter links and the reading position land midway through reading the completed row.
  anchor: number;
  exit: Exit;
};

export function planRow(input: RowInput): RowPlan {
  const { screen: S, intro, gap, bottom, content, timing } = input;
  const problems: string[] = [];
  const tallest = Math.max(...content);
  const room = Math.floor(Math.min(tallest, S - intro - gap - bottom));
  const introOffset = input.center ? Math.max(0, (S - intro - gap - room - (input.introInset ?? 0)) / 2) : 0;
  const parked = introOffset + intro + gap;
  const lead = clamp(S * (input.leadScreens ?? 0.28), 0, Math.max(0, S - intro - gap));
  if (room <= 0) problems.push("no room below the introduction");
  if (tallest > room + 1) problems.push(`the row needs ${Math.ceil(tallest)}px, ${room}px available`);
  const park = lead;
  const playFrom = park + S * timing.allow;
  const playTo = playFrom + S * timing.play;
  const readTo = playTo + S * timing.read;
  const heldBottom = parked + room;
  return {
    fits: problems.length === 0,
    problems,
    room,
    parked,
    introOffset,
    lead,
    deck: readTo + heldBottom,
    trackEnd: heldBottom - intro - introOffset,
    lanes: content.map(() => ({ top: 0, hold: parked + lead, park: parked, wait: null, height: room, end: 0 })),
    arrival: lead - (S - parked) - S * BELOW,
    rise: S - parked,
    park,
    playFrom,
    playTo,
    readTo,
    anchor: playTo + (S * timing.read) / 2,
    // Leaving and fading begin together, after the reading time.
    exit: { lastPark: park, heldBottom, fadeFrom: readTo, release: readTo },
  };
}

// The tallest card content planRow can hold: below the introduction and above the bottom spacing.
export function rowBudget(input: Pick<RowInput, "screen" | "intro" | "gap" | "bottom">) {
  return input.screen - input.intro - input.gap - input.bottom;
}

// The row enters exactly like a stack's first card: drawn faintly from below the bottom edge,
// solid once it has covered 70% of its rise.
export function rowOpacity(plan: RowPlan, y: number) {
  if (y <= plan.arrival) return 0;
  const risen = (y - (plan.park - plan.rise)) / Math.max(1, plan.rise);
  return 0.2 + 0.8 * clamp(risen / 0.7);
}

export type HandoffInput = {
  screen: number;
  preview: number;
  // Minimum clearance between the incoming text and the outgoing content.
  clearance: number;
  // Smallest visible slice that makes a waiting heading worth showing.
  minVisible: number;
  // Distance from the introduction's top to its first line of text, and its height.
  inset: number;
  height: number;
  // Document position of the introduction in normal flow.
  natural: number;
  // The preceding story, in document positions.
  previous: Exit;
};

export type HandoffPlan = {
  active: boolean;
  // How far the introduction's lane reaches back over the previous story.
  reach: number;
  // Sticky bottom of the waiting introduction.
  wait: number;
  // Text top while waiting, as a viewport position.
  line: number;
  // The text enters the viewport, then waits from the moment the final card parks.
  enterFrom: number;
  waitFrom: number;
  takeoff: number;
  origin: number;
};

/* The next section's introduction waits below the parked final card from the moment that card
   parks, then rises with the page and joins its own section. Its text never comes closer to
   the held content than the clearance, because it waits below it and then moves in normal
   document flow, which keeps the CSS spacing between the two sections. */
export function planHandoff(input: HandoffInput): HandoffPlan {
  const { screen: S, preview, clearance, minVisible, inset, height, natural, previous } = input;
  const line = Math.max(S - preview, previous.heldBottom + clearance);
  const boxTop = line - inset;
  const reach = natural - (previous.lastPark + boxTop);
  return {
    active: S - line >= minVisible && reach > 0,
    reach: Math.max(0, reach),
    wait: S - boxTop - height,
    line,
    enterFrom: previous.lastPark - (S - line),
    waitFrom: previous.lastPark,
    takeoff: natural - boxTop,
    origin: natural,
  };
}

// A short closing section must finish fading within the page's reachable scroll distance.
// Keep the ordinary wait and rise timing wherever it fits; shorten only an unreachable ending.
export function handoffOpacity(plan: HandoffPlan, y: number, natural: number, screen: number, maxScroll: number) {
  if (!plan.active) {
    const start = natural - screen;
    const end = Math.min(start + screen * 0.42, maxScroll);
    return y >= end ? 1 : clamp((y - start) / Math.max(1, end - start));
  }
  const end = Math.min(plan.takeoff + (plan.origin - plan.takeoff) * 0.6, maxScroll);
  if (y >= end) return 1;
  // On a very tall viewport a small footer can reach the page end while its heading is still
  // waiting. In that case use the visible arrival to finish the fade instead of jumping at the end.
  if (end <= plan.takeoff) return clamp((y - plan.enterFrom) / Math.max(1, end - plan.enterFrom));
  const entering = clamp((y - plan.enterFrom) / Math.max(1, plan.waitFrom - plan.enterFrom));
  const moving = clamp((y - plan.takeoff) / Math.max(1, end - plan.takeoff));
  return entering * (0.28 + 0.72 * moving);
}

export function exitOpacity(exit: Exit, y: number, screen: number) {
  return 1 - clamp((y - exit.fadeFrom) / Math.max(1, exit.release + screen * 0.6 - exit.fadeFrom));
}
