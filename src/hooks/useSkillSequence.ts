import { useLayoutEffect, useRef, type RefObject } from "react";
import { gsap, redraw, ScrollTrigger, useGSAP } from "@/lib/gsap";
import { layoutTop } from "@/lib/scrollGeometry";
import { rowOpacity } from "@/lib/storyPlan";
import { planSkills, skillAt, skillOpacity, type SkillPlan } from "@/lib/skillPlan";
import { clearLanes, px, register, setFit, setStyle, writeLanes } from "@/lib/storyLayout";
import { useReducedMotion } from "./useReducedMotion";
import { arrangementOf } from "./useStoryArrangement";

type Options = {
  arranged: number | undefined;
  build: (card: HTMLElement) => gsap.core.Timeline;
  onActive: (index: number) => void;
};

// Desktop only. The native sticky frame never moves between chapters; scroll changes the
// illustration's opacity and assembly progress. One DOM copy of each diagram serves both modes.
export function useSkillSequence(scope: RefObject<HTMLElement | null>, options: Options) {
  const reduced = useReducedMotion();
  const latest = useRef(options);
  useLayoutEffect(() => { latest.current = options; });
  useGSAP(() => {
    const root = scope.current!;
    if (arrangementOf(root) !== "split") return;
    const section = root.closest<HTMLElement>("[data-segment]")!;
    const intro = root.querySelector<HTMLElement>(".stack-intro")!;
    const deck = root.querySelector<HTMLElement>(".stack-cards")!;
    const lane = root.querySelector<HTMLElement>(".skills-stage-lane")!;
    const stage = root.querySelector<HTMLElement>(".skills-stage")!;
    const cards = [...root.querySelectorAll<HTMLElement>(".stack-card")];
    const anchors = [...root.querySelectorAll<HTMLElement>(".stack-anchor")];
    const links = [...root.querySelectorAll<HTMLAnchorElement>(".skills-menu a")];
    const lastDescription = root.querySelector<HTMLElement>(".skills-menu-item:last-child .skills-menu-detail")!;
    // oxlint-disable-next-line react/immutability -- the effect owns the layout attributes.
    root.dataset.arrangement = "split";
    let plan: SkillPlan | null = null;
    let next: SkillPlan;
    let deckTop = 0;
    let copyHeight = 0;
    let overflow = false;
    let active = -1;
    const demos = reduced ? [] : cards.map(card => latest.current.build(card));
    const players = demos.map((demo, index) => ScrollTrigger.create({
      trigger: deck,
      start: () => plan ? layoutTop(deck) + plan.from[index] : 0,
      end: () => plan ? layoutTop(deck) + plan.to[index] : 1,
      animation: demo,
      scrub: true,
      invalidateOnRefresh: true,
      onRefresh: () => redraw(demo),
    }));
    const opacity = cards.map(card => gsap.quickSetter(card, "opacity"));
    const frameOpacity = gsap.quickSetter(stage, "opacity");
    const paint = (y: number) => {
      if (!plan) return;
      const relative = y - deckTop;
      frameOpacity(rowOpacity(plan, relative));
      const current = skillAt(plan, relative);
      cards.forEach((card, i) => {
        opacity[i](skillOpacity(plan!, i, relative));
        card.dataset.active = String(i === current);
      });
      if (current !== active) {
        active = current;
        latest.current.onActive(current);
      }
    };
    const painter = ScrollTrigger.create({
      trigger: deck, start: 0, end: "max",
      onUpdate: self => paint(self.scroll()),
      onRefresh: self => { deckTop = layoutTop(deck); paint(self.scroll()); },
    });
    let enabled = true;
    const setMode = (on: boolean) => {
      root.dataset.stack = on ? "on" : "off";
      if (on === enabled) return;
      enabled = on;
      [...players, painter].forEach(trigger => on ? trigger.enable(false) : trigger.disable(false));
      if (!on) {
        demos.forEach(demo => demo.progress(1));
        gsap.set(cards, { opacity: 1 });
        stage.style.removeProperty("opacity");
        cards.forEach(card => delete card.dataset.active);
      }
    };
    setMode(false);
    // Tab can return to a link while the whole section is fading out. Restore its readable
    // chapter only when focus enters outside the held interval; pointer focus never moves it.
    const focus = (event: FocusEvent) => {
      const target = event.target as HTMLElement;
      const index = links.findIndex(link => link === target);
      if (!plan || index < 0 || !target.matches(":focus-visible")) return;
      const relative = scrollY - deckTop;
      if (relative >= plan.park && relative <= plan.exit.fadeFrom) return;
      window.scrollTo({ top: deckTop + plan.anchors[index], behavior: "instant" });
    };
    root.addEventListener("focusin", focus);
    const unregister = register({
      prepare: () => {
        root.dataset.stack = "on";
        root.dataset.measuring = "";
      },
      read: m => {
        // Align the frame to the skill list, excluding the label and space above it. These
        // intrinsic text bounds never depend on the frame or the currently selected chapter.
        const copy = intro.getBoundingClientRect();
        copyHeight = copy.height;
        const listTop = links[0].getBoundingClientRect().top;
        const content = Math.ceil(lastDescription.getBoundingClientRect().bottom - listTop);
        next = planSkills({ screen: m.screen, intro: listTop - copy.top - m.gap, gap: m.gap, bottom: m.bottom,
          content: [content], count: cards.length, preview: m.desktop ? 0 : m.preview });
        next.trackEnd = next.exit.heldBottom - copyHeight - next.introOffset;
      },
      write: () => {
        delete root.dataset.measuring;
        if (!next.fits) return;
        writeLanes(root, [lane], next);
        setStyle(root, "--skills-top", px(next.introOffset));
        anchors.forEach((anchor, i) => setStyle(anchor, "top", px(next.anchors[i])));
      },
      check: () => {
        overflow = next.fits && (cards.some(card => card.scrollHeight > card.clientHeight + 1) || intro.scrollHeight > copyHeight + 1);
        deckTop = layoutTop(deck);
      },
      finish: () => {
        const on = !reduced && next.fits && !overflow;
        plan = on ? next : null;
        setFit(root, on ? null : reduced ? ["reduced motion"] : [...next.problems, ...(overflow ? ["content overflows the shared frame"] : [])]);
        setMode(on);
      },
      cards: () => cards,
      cardAt: y => plan && y - deckTop >= plan.arrival && y - deckTop <= plan.exit.release ? skillAt(plan, y - deckTop) : null,
      phaseAt: (i, y) => plan ? (y - deckTop - plan.from[i]) / (plan.to[i] - plan.from[i]) : null,
      scrollFor: (i, phase) => !plan ? layoutTop(cards[i]) - innerHeight * 0.08 : deckTop +
        (phase === null || phase > 1 ? plan.anchors[i] : phase < 0 ? plan.starts[i] : plan.from[i] + phase * (plan.to[i] - plan.from[i])),
      // The copy is intrinsic and stable across selection; never observe the sized stage.
      observe: () => [intro, ...root.querySelectorAll<HTMLElement>(".scene-heading, .scene-caption")],
    }, section, () => plan ? {
      ...plan.exit, lastPark: layoutTop(deck) + plan.exit.lastPark,
      fadeFrom: layoutTop(deck) + plan.exit.fadeFrom, release: layoutTop(deck) + plan.exit.release,
    } : null);
    return () => {
      unregister();
      root.removeEventListener("focusin", focus);
      clearLanes(root, [lane]);
      root.style.removeProperty("--skills-top");
      stage.style.removeProperty("opacity");
      cards.forEach(card => { card.style.removeProperty("opacity"); delete card.dataset.active; });
      anchors.forEach(anchor => anchor.style.removeProperty("top"));
      delete root.dataset.stack;
      delete root.dataset.arrangement;
      delete root.dataset.measuring;
      setFit(root, null);
    };
  }, { scope, dependencies: [options.arranged, reduced], revertOnUpdate: true });
}
