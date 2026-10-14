import { useLayoutEffect, useRef, type RefObject } from "react";
import { fitPicture, release } from "@/lib/fitPicture";
import { gsap, redraw, ScrollTrigger, useGSAP } from "@/lib/gsap";
import { layoutTop } from "@/lib/scrollGeometry";
import { planRow, rowBudget, rowOpacity, type RowPlan, type RowTiming } from "@/lib/storyPlan";
import { clearLanes, px, register, setFit, setStyle, writeLanes, type Metrics } from "@/lib/storyLayout";
import { useReducedMotion } from "./useReducedMotion";
import { arrangementOf } from "./useStoryArrangement";

/*
  A product's cards side by side, for a wide screen: MihawkAI or Kehsun. CSS chooses
  this arrangement where two cards stay readable (useStoryArrangement); this controller owns the
  story only then, and useCardStack owns it otherwise.

  The introduction and row park as one vertically centred composition. The row rises into view below
  it as one, drawn faintly from below the bottom edge like a stack's first card, and parks with
  both cards level and equal in height. Then both demonstrations play together over the same
  stretch of scroll, each with its own steps. The completed row stays fully visible for a
  reading interval before the whole story leaves and fades. The following section arrives
  in normal flow without a waiting preview.

  The browser holds both cards in the stack's sticky lanes (storyPlan's planRow); per scroll
  frame JavaScript only fades them and plays the demonstrations. If the row cannot fit below the
  introduction, or motion is reduced, the cards stay side by side in normal flow, finished. Vision's
  camera may shrink a little first, keeping its proportions, so a shorter window still holds the
  row (fitPicture).
*/
const CONTENT = ".product-card-content";

type Options = {
  timing: RowTiming;
  // A paused timeline for each card's demonstration; both are played by the same scroll interval.
  build: (card: HTMLElement, index: number) => gsap.core.Timeline | undefined;
  // useStoryArrangement's change count; a story that is never a row passes undefined.
  arranged: number | undefined;
};

export function useCardRow(scope: RefObject<HTMLElement | null>, options: Options) {
  const reduced = useReducedMotion();
  const latest = useRef(options);
  useLayoutEffect(() => {
    latest.current = options;
  });

  useGSAP(
    () => {
      const root = scope.current!;
      if (latest.current.arranged === undefined || arrangementOf(root) !== "row") return;
      const section = root.closest<HTMLElement>("[data-segment]")!;
      const intro = root.querySelector<HTMLElement>(".stack-intro")!;
      const deck = root.querySelector<HTMLElement>(".stack-cards")!;
      const lanes = [...root.querySelectorAll<HTMLElement>(".stack-lane")];
      const cards = lanes.map((lane) => lane.querySelector<HTMLElement>(".stack-card")!);
      const contents = cards.map((card) => card.querySelector<HTMLElement>(CONTENT)!);
      const pictures = cards.map((card) => card.querySelector<HTMLElement>("[data-shrinkable]"));
      // The stack, a plain layout or reduced motion may have left a demonstration mid-way.
      root.querySelectorAll<HTMLElement | SVGElement>("[data-rest-text]").forEach((element) => {
        element.textContent = element.dataset.restText!;
      });
      if (reduced) {
        // oxlint-disable-next-line react/immutability -- the effect writes the DOM node it manages.
        root.dataset.stack = "off";
        return;
      }
      const { timing } = latest.current;
      let plan: RowPlan | null = null;
      let next: RowPlan | null = null;
      let pictureWidth: Array<number | null> = [];
      let overflow = false;
      let deckTop = 0;

      // Both demonstrations in one timeline, so the same scroll plays them in step.
      const together = gsap.timeline({ paused: true });
      cards.forEach((card, i) => {
        const demo = latest.current.build(card, i);
        // The original timelines may have different durations (Kehsun's booking and note).
        // Give each the same progress window, preserving its internal relative timings. This
        // also makes a saved row phase mean the same thing when restored into the phone stack.
        if (demo) together.add(demo.duration(1).paused(false), 0);
      });
      const at = (value: (plan: RowPlan) => number) => () => (plan ? layoutTop(deck) + value(plan) : 0);
      const player = ScrollTrigger.create({
        trigger: deck,
        start: at((p) => p.playFrom),
        end: at((p) => p.playTo),
        animation: together,
        scrub: 0.3,
        invalidateOnRefresh: true,
        onRefresh: () => redraw(together),
      });

      const opacity = cards.map((card) => gsap.quickSetter(card, "opacity"));
      const paint = (y: number) => {
        if (!plan) return;
        const value = rowOpacity(plan, y - deckTop);
        opacity.forEach((set) => set(value));
      };
      const painter = ScrollTrigger.create({
        trigger: deck,
        start: 0,
        end: "max",
        onUpdate: (self) => paint(self.scroll()),
        onRefresh: (self) => {
          deckTop = layoutTop(deck);
          paint(self.scroll());
        },
      });

      // Both cards are on show together whenever the story is (see useCardStack's data-active).
      cards.forEach((card) => (card.dataset.active = "true"));
      root.dataset.arrangement = "row";
      let enabled = true;
      const setMode = (on: boolean) => {
        root.dataset.stack = on ? "on" : "off";
        if (on === enabled) return;
        enabled = on;
        [player, painter].forEach((trigger) => (on ? trigger.enable(false) : trigger.disable(false)));
        if (!on) {
          together.progress(1);
          gsap.set(cards, { opacity: 1 });
        }
      };
      setMode(false);

      // Keyboard focus in a card that is still arriving or already leaving takes the page to where
      // the completed row is read. Pointer focus leaves the page where it is.
      const focus = (event: FocusEvent) => {
        const target = event.target as HTMLElement;
        if (!plan || !target.matches(":focus-visible") || !cards.some((card) => card.contains(target))) return;
        const relative = scrollY - deckTop;
        if (relative >= plan.park && relative <= plan.exit.fadeFrom) return;
        window.scrollTo({ top: deckTop + plan.anchor, behavior: "instant" });
      };
      root.addEventListener("focusin", focus);

      const unregister = register(
        {
          // The held layout is measured even when the plain one is showing.
          prepare: () => {
            root.dataset.stack = "on";
            pictures.forEach((picture, i) => release(contents[i], picture));
          },
          read: (m: Metrics) => {
            const size = { screen: m.screen, intro: intro.offsetHeight, gap: m.gap, bottom: m.bottom };
            const fits = contents.map((element, i) => fitPicture(element, pictures[i], rowBudget(size), m.em));
            pictureWidth = fits.map((fit) => fit.width);
            // Heights at the row's card width; the shorter card is stretched to the taller.
            next = planRow({ ...size, content: fits.map((fit) => fit.height), timing,
              center: m.desktop, introInset: parseFloat(getComputedStyle(intro).paddingTop) || 0 });
          },
          write: () => {
            const p = next!;
            pictures.forEach((picture, i) => picture && setStyle(picture, "max-width", p.fits && pictureWidth[i] ? px(pictureWidth[i]!) : null));
            if (!p.fits) return;
            writeLanes(root, lanes, p);
            setStyle(root, "--stack-lead", px(p.lead));
            setStyle(root, "--row-intro-offset", px(p.introOffset));
          },
          check: () => {
            overflow = next!.fits && cards.some((card) => card.scrollHeight > card.clientHeight + 1);
            deckTop = layoutTop(deck);
          },
          finish: () => {
            const on = next!.fits && !overflow;
            setFit(root, on ? null : [...next!.problems, ...(overflow ? ["a card's content overflows"] : [])]);
            plan = on ? next : null;
            setMode(on);
          },
          // Both cards are on show at once. For the stack, the story is at its first card until both
          // demonstrations are complete, and at its last card after that.
          cardAt: (y) => {
            if (!plan) return null;
            const relative = y - deckTop;
            if (relative < plan.arrival || relative > plan.exit.release) return null;
            return relative > plan.playTo ? cards.length - 1 : 0;
          },
          phaseAt: (_, y) => (plan ? (y - deckTop - plan.playFrom) / Math.max(1, plan.playTo - plan.playFrom) : null),
          cards: () => cards,
          // The same point of both demonstrations (parked, if they had not started), or midway
          // through reading the completed row.
          scrollFor: (i, phase) => {
            if (!plan) return layoutTop(cards[i]) - innerHeight * 0.08;
            if (phase === null || phase > 1) return deckTop + plan.anchor;
            return deckTop + (phase < 0 ? plan.park : plan.playFrom + phase * (plan.playTo - plan.playFrom));
          },
          // Text sizes, never the cards the plan sizes, so a plan cannot re-trigger itself. A shrunk
          // picture is sized by the plan, so its card's other parts are watched instead.
          observe: () => [
            intro,
            ...contents.flatMap((content, i) =>
              pictureWidth[i] ? [...content.children].filter((child) => !child.contains(pictures[i])) : [content],
            ),
          ],
        },
        section,
        () => {
          if (!plan) return null;
          const top = layoutTop(deck);
          const { exit } = plan;
          return {
            lastPark: top + exit.lastPark,
            heldBottom: exit.heldBottom,
            fadeFrom: top + exit.fadeFrom,
            release: top + exit.release,
          };
        },
      );
      return () => {
        unregister();
        root.removeEventListener("focusin", focus);
        together.progress(1);
        // Opacity painted per frame is not part of the GSAP context, so it is cleared here.
        cards.forEach((card) => {
          card.style.removeProperty("opacity");
          delete card.dataset.active;
        });
        pictures.forEach((picture) => picture?.style.removeProperty("max-width"));
        delete root.dataset.stack;
        delete root.dataset.arrangement;
        setFit(root, null);
        clearLanes(root, lanes);
        root.style.removeProperty("--stack-lead");
        root.style.removeProperty("--row-intro-offset");
      };
    },
    { scope, dependencies: [reduced, options.arranged], revertOnUpdate: true },
  );
}
