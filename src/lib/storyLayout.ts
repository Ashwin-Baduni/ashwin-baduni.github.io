import { ScrollTrigger } from "@/lib/gsap";
import type { Exit, Lane } from "@/lib/storyPlan";

/*
  One layout pass for every scroll story. Each story registers a participant; whenever the
  layout may have changed (mount, viewport width or height, fonts, text size, content size),
  a single pass runs every participant's phases together, so the document is written, then
  read, then written again, instead of interleaving reads and writes per story:

    prepare (write)  put each story into its held layout, so it can be measured
    read             measure stable elements and plan
    write            apply the plan as CSS lengths
    check (read)     confirm that every card's content fits
    finish (write)   choose the held or the plain layout; enable or disable the story's motion

  Handoff participants (`late`) run the same phases afterwards, once every story's final
  geometry is known. ScrollTrigger is then refreshed once, after the complete change.
  Before any of this, a story that can be arranged in more than one way may hand itself to the
  controller for its current arrangement (see watchLayout), so a pass never measures a story
  with the wrong controller.
  Planning runs on layout changes, not on each scroll update; refreshes wait for scrolling to end.
  The only scroll it ever makes is the deliberate return to the
  reading position after a width change (see below), which any new input from the visitor cancels.
*/

export type Metrics = {
  desktop: boolean;
  screen: number;
  gap: number;
  bottom: number;
  cardGap: number;
  preview: number;
  em: number;
};

export type Participant = {
  late?: boolean;
  // Stories: the card on show at a scroll position (held layout only) and how far through its
  // demonstration that position is (0 at its start, 1 at its end, below 0 before and above 1
  // after it); the card elements; and the scroll position that shows a card at that point of its
  // demonstration in the current layout (null: where it is read).
  cardAt?: (y: number) => number | null;
  phaseAt?: (index: number, y: number) => number | null;
  cards?: () => HTMLElement[];
  scrollFor?: (index: number, phase: number | null) => number | null;
  prepare?: () => void;
  read: (metrics: Metrics) => void;
  write: () => void;
  check?: () => void;
  finish?: () => void;
  // Elements whose size change calls for a new plan. They must not be sized by the plan.
  observe?: () => Element[];
};

const participants = new Set<Participant>();
// The section each story participant shows. A reading position is kept by section and card, so it
// survives a story changing controller (useStoryArrangement).
const sections = new Map<Participant, Element>();
// Run first in every pass; each returns true when it changed a story's arrangement.
const watchers = new Set<() => boolean>();
// Every story's exit in document positions, by section, for the handoffs that follow it.
const exits = new Map<Element, () => Exit | null>();
let probe: HTMLDivElement | undefined;
let sizes: ResizeObserver | undefined;
let page: ResizeObserver | undefined;
let observed = new Set<Element>();
let queued = false;
let frame = 0;
let pageFrame = 0;
let height = 0;
let width = 0;

// The story tokens resolve to pixels on this hidden probe. Its height is the small viewport.
function readMetrics(): Metrics {
  const style = getComputedStyle(probe!);
  const skills = document.querySelector("#focus .stack-cards");
  return {
    desktop: !!skills && getComputedStyle(skills).getPropertyValue("--story-arrangement").trim() === "split",
    screen: probe!.getBoundingClientRect().height || innerHeight,
    gap: parseFloat(style.paddingTop),
    bottom: parseFloat(style.paddingBottom),
    cardGap: parseFloat(style.marginTop),
    preview: parseFloat(style.marginBottom),
    em: parseFloat(getComputedStyle(document.documentElement).fontSize),
  };
}

function pass() {
  // A change of controller registers and unregisters participants; while `queued` is still set,
  // that requests no further pass, because this one covers it.
  let rearranged = false;
  watchers.forEach((watch) => (rearranged = watch() || rearranged));
  queued = false;
  cancelAnimationFrame(frame);
  frame = 0;
  if (!participants.size) return;
  // A width change found by any route (resize event or observer) returns to the reading position,
  // and so does a story changing its arrangement.
  if (innerWidth !== width) widened();
  else if (rearranged) restoreUntil = performance.now() + 1000;
  const metrics = readMetrics();
  // Desktop section spacing must be applied before anyone measures its document position.
  // Publishing this in a late participant leaves the handoff geometry one layout behind.
  const mode = metrics.desktop ? "on" : "off";
  if (document.documentElement.dataset.desktop !== mode) document.documentElement.dataset.desktop = mode;
  for (const group of [false, true]) {
    const list = [...participants].filter((p) => !!p.late === group);
    list.forEach((p) => p.prepare?.());
    list.forEach((p) => p.read(metrics));
    list.forEach((p) => p.write());
    list.forEach((p) => p.check?.());
    list.forEach((p) => p.finish?.());
  }
  // The probe (small viewport and spacing tokens) is always observed, with every participant's
  // stable elements.
  const next = new Set<Element>([probe!, ...[...participants].flatMap((p) => p.observe?.() ?? [])]);
  observed.forEach((element) => !next.has(element) && sizes!.unobserve(element));
  next.forEach((element) => !observed.has(element) && sizes!.observe(element));
  observed = next;
  if (restoring()) restore();
  refresh(immediate);
  height = document.documentElement.scrollHeight;
  capture();
}

/*
  Reading position across width changes. Rotating a phone can switch stories between the held
  and the plain layout and halve the page's height, which moves different content under the
  same scroll offset; the browser's scroll anchoring is suppressed by those layout switches
  (and Safari has none). So the card on show, or the content at the reading line, is recorded
  whenever scrolling ends, and after a width change the page returns to it, at the same point of
  the card's demonstration, so a demonstration half played is still half played. A story changing
  its arrangement (a row of cards becoming a stack, say) moves content in the same way, so it
  returns too, whatever caused the change. Other toolbar and font changes never do this, and any
  new input from the visitor cancels a pending return.
  A width change can take more than one pass to settle (WebKit may report the new small
  viewport a frame later), so for a second afterwards every pass returns to the same place.
*/
type Anchor = { section: Element; index: number; phase: number | null } | { element: Element; offset: number };
let anchor: Anchor | null = null;
let restoreUntil = 0;
let settle = 0;
const restoring = () => performance.now() < restoreUntil;
function widened() {
  width = innerWidth;
  restoreUntil = performance.now() + 1000;
}

function capture() {
  // Never while a width change is waiting for its pass: the browser's own clamping of the scroll
  // position would otherwise replace the place the visitor was reading.
  if (restoring() || innerWidth !== width) return;
  if (scrollY < 4) {
    anchor = null;
    return;
  }
  for (const participant of participants) {
    const index = participant.cardAt?.(scrollY);
    const section = sections.get(participant);
    if (index !== null && index !== undefined && section) {
      anchor = { section, index, phase: participant.phaseAt?.(index, scrollY) ?? null };
      return;
    }
  }
  const hit = document.elementFromPoint(innerWidth / 2, innerHeight * 0.4);
  const card = hit?.closest<HTMLElement>(".stack-card");
  const owner = card && [...participants].find((p) => p.cards?.().includes(card) && sections.has(p));
  if (card && owner) {
    anchor = { section: sections.get(owner)!, index: owner.cards!().indexOf(card), phase: null };
    return;
  }
  const element = hit?.closest(".experience-row, .certification-list li, [data-segment] > .wrap > *, [data-segment]");
  anchor = element ? { element, offset: element.getBoundingClientRect().top } : null;
}

function restore() {
  if (!anchor) return;
  let target: number | null = null;
  if ("section" in anchor) {
    const { section, index, phase } = anchor;
    const owner = [...participants].find((p) => sections.get(p) === section);
    if (owner) target = owner.scrollFor?.(index, phase) ?? null;
  } else if (anchor.element.isConnected) {
    target = anchor.element.getBoundingClientRect().top + scrollY - anchor.offset;
  }
  if (target === null) return;
  target = Math.max(0, Math.min(target, document.documentElement.scrollHeight - innerHeight));
  if (Math.abs(target - scrollY) > 2) window.scrollTo({ top: target, behavior: "instant" });
}

const scrolled = () => {
  immediate = false;
  clearTimeout(settle);
  settle = window.setTimeout(capture, 200);
};
const interacted = () => {
  restoreUntil = 0;
};

/* ScrollTrigger measures by briefly scrolling to the top and back within one task. Before the
   visitor has scrolled that is harmless, so the first plan is applied at once. Later refreshes
   use ScrollTrigger's safe mode, which waits until scrolling has ended, so a fling in progress
   is never interrupted. Positions themselves are sticky and update immediately either way. */
let immediate = true;
function refresh(now: boolean) {
  if (now) ScrollTrigger.refresh();
  else ScrollTrigger.refresh(true);
}

// Mount and unmount run the pass before the next paint; later changes run in the next frame.
export function requestLayout(soon = false) {
  if (queued) return;
  queued = true;
  if (soon) queueMicrotask(() => queued && pass());
  else frame = requestAnimationFrame(pass);
}


// Content elsewhere on the page changed height (a late image, say): positions moved, plans did not.
function pageResized() {
  cancelAnimationFrame(pageFrame);
  pageFrame = requestAnimationFrame(() => {
    if (queued || document.documentElement.scrollHeight === height) return;
    height = document.documentElement.scrollHeight;
    refresh(immediate);
  });
}

const resized = () => {
  // Width changes always re-plan. Height-only changes re-plan when the small viewport itself
  // changed; the probe's ResizeObserver reports that, while toolbar movement leaves svh alone.
  if (innerWidth !== width) {
    widened();
    requestLayout();
  }
};
const fontsChanged = () => requestLayout();

function start() {
  probe = document.createElement("div");
  probe.setAttribute("aria-hidden", "true");
  probe.style.cssText = [
    "position:fixed", "top:0", "left:0", "width:0", "height:100svh", "visibility:hidden",
    "pointer-events:none", "box-sizing:border-box", "padding-top:var(--story-gap)",
    "padding-bottom:var(--story-bottom)", "margin-top:var(--story-card-gap)",
    "margin-bottom:var(--story-preview)",
  ].join(";");
  document.body.append(probe);
  width = innerWidth;
  sizes = new ResizeObserver(() => requestLayout());
  sizes.observe(probe);
  observed = new Set([probe]);
  page = new ResizeObserver(pageResized);
  page.observe(document.body);
  addEventListener("resize", resized);
  addEventListener("scroll", scrolled, { passive: true });
  for (const type of ["wheel", "touchstart", "keydown", "pointerdown"]) addEventListener(type, interacted, { passive: true });
  document.fonts.addEventListener("loadingdone", fontsChanged);
  document.fonts.ready.then(() => participants.size && requestLayout());
}

function stop() {
  delete document.documentElement.dataset.desktop;
  cancelAnimationFrame(frame);
  cancelAnimationFrame(pageFrame);
  queued = false;
  sizes?.disconnect();
  page?.disconnect();
  probe?.remove();
  probe = sizes = page = undefined;
  observed = new Set();
  removeEventListener("resize", resized);
  removeEventListener("scroll", scrolled);
  for (const type of ["wheel", "touchstart", "keydown", "pointerdown"]) removeEventListener(type, interacted);
  clearTimeout(settle);
  anchor = null;
  restoreUntil = 0;
  document.fonts.removeEventListener("loadingdone", fontsChanged);
}

export function register(participant: Participant, section?: Element, exit?: () => Exit | null) {
  if (!participants.size) start();
  participants.add(participant);
  if (section) sections.set(participant, section);
  if (section && exit) exits.set(section, exit);
  requestLayout(true);
  return () => {
    participants.delete(participant);
    sections.delete(participant);
    if (section && exits.get(section) === exit) exits.delete(section);
    if (!participants.size) stop();
    else requestLayout(true);
  };
}

/* A check that runs at the start of every pass, before any story is measured. It returns true
   when it changed a story's arrangement, which it does by replacing the story's controller there
   and then. Every route that can change an arrangement (a resize, a parent's width, the text
   size) changes the size of an observed element, so it always reaches a pass. */
export function watchLayout(watch: () => boolean) {
  watchers.add(watch);
  return () => {
    watchers.delete(watch);
  };
}

export function exitOf(section: Element | null | undefined) {
  return section ? exits.get(section)?.() ?? null : null;
}

// The entire demonstration sequence is protected from desktop settling, including chapter
// transitions and reading intervals. Reuse the active controller's geometry after every resize.
export function heldRangeOf(section: Element) {
  const exit = exitOf(section);
  if (!exit) return null;
  const owner = [...participants].find(p => sections.get(p) === section);
  const firstPark = owner?.scrollFor?.(0, -1);
  return firstPark == null ? null : { start: firstPark, end: exit.release };
}

// Sets an inline style only when it differs, so an unchanged plan causes no style or layout work.
export function setStyle(element: HTMLElement | SVGElement, name: string, value: string | null) {
  const current = element.style.getPropertyValue(name);
  if (value === null) {
    if (current) element.style.removeProperty(name);
  } else if (current !== value) element.style.setProperty(name, value);
}

export const px = (value: number) => `${Math.round(value * 100) / 100}px`;

const LANE = ["--lane-top", "--lane-hold", "--lane-park", "--lane-wait", "--lane-height", "--lane-end"];

// Writes a story's lanes (see the scroll story rules in index.css).
export function writeLanes(root: HTMLElement, elements: HTMLElement[], plan: { deck: number; trackEnd: number; lanes: Lane[] }) {
  setStyle(root, "--story-deck", px(plan.deck));
  setStyle(root, "--story-track-end", px(plan.trackEnd));
  plan.lanes.forEach((lane, i) => {
    const element = elements[i];
    setStyle(element, "--lane-top", px(lane.top));
    setStyle(element, "--lane-hold", px(lane.hold));
    setStyle(element, "--lane-park", px(lane.park));
    setStyle(element, "--lane-wait", lane.wait === null ? null : px(lane.wait));
    setStyle(element, "--lane-height", px(lane.height));
    setStyle(element, "--lane-end", px(lane.end));
  });
}

export function clearLanes(root: HTMLElement, elements: HTMLElement[]) {
  root.style.removeProperty("--story-deck");
  root.style.removeProperty("--story-track-end");
  elements.forEach((element) => LANE.forEach((name) => element.style.removeProperty(name)));
}

export function setFit(root: HTMLElement, problems: string[] | null) {
  if (problems?.length) root.dataset.storyFit = problems.join("; ");
  else delete root.dataset.storyFit;
}
