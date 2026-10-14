import { useLayoutEffect, useRef, type RefObject } from "react";
import { fitPicture, release } from "@/lib/fitPicture";
import { gsap, redraw, ScrollTrigger, useGSAP } from "@/lib/gsap";
import { layoutTop } from "@/lib/scrollGeometry";
import { planStack, stackBudget, stackOpacity, type StackPlan, type Timing } from "@/lib/storyPlan";
import { clearLanes, px, register, setFit, setStyle, writeLanes, type Metrics } from "@/lib/storyLayout";
import { useReducedMotion } from "./useReducedMotion";
import { arrangementOf } from "./useStoryArrangement";

/*
  A card stack, designed phone first. The section's introduction (.stack-intro) arrives and
  stays at the top; the first card (.stack-card) rises and parks below it; only then does the
  card's own demonstration play, across a long stretch of scroll. The next card already waits
  faintly at the bottom of the screen and rises through the available space. It only reaches
  this card once it has been read, and is solid before it parks over it. Then the whole story
  leaves together.

  The browser holds every card: each sits in its own lane (.stack-lane) and is positioned only
  by `position: sticky` (see storyPlan). Scrolling stays native, and JavaScript never moves a
  card. Per scroll frame it only fades cards and plays each parked card's demonstration, so
  everything stops when scrolling stops and runs backwards when scrolling back.

  If the complete composition cannot fit, adaptive product stories first let the introduction
  scroll away and keep only the cards held. If even the cards cannot fit, their demonstrations
  follow the cards' travel through normal flow. Other stories retain their plain finished
  fallback. Reduced motion always shows a plain, finished layout.

  Each card's data-active says whether it is the one on show (not waiting below, not covered),
  so looping visuals inside it can pause. Keyboard focus that lands in a waiting or covered card
  brings that card to where it is parked and uncovered.

  Where there is room, MihawkAI shows its two cards side by side instead (useCardRow); this
  controller then leaves that story alone.
*/
const CONTENT = ".product-card-content, .focus-card-content, .project-card-content";

type Options = {
  timing: Timing;
  // Extra scroll after the introduction parks before the first card joins it.
  // Short headings need less separation than multi-line introductions.
  leadScreens?: number;
  // Preview the next card during arrival wherever it can keep clear of the preceding card.
  previewDuringArrival?: boolean;
  // The introduction changes while a card arrives, before its demonstration starts.
  buildArrival?: (card: HTMLElement, index: number) => gsap.core.Timeline | undefined;
  // A paused timeline for a card's demonstration; the scroll plays it once the card parks.
  build?: (card: HTMLElement, index: number) => gsap.core.Timeline | undefined;
  // The card on show, from the moment the arriving card reaches the previous one.
  onActive?: (index: number) => void;
  // A story that can also be a row (useCardRow) passes useStoryArrangement's change count: the
  // stack then owns the story only while CSS chooses the stacked arrangement.
  arranged?: number;
  // Product stories keep playing in short viewports: first let the introduction scroll away,
  // then, if even the cards cannot fit, scrub them in normal flow instead of showing them finished.
  adaptive?: boolean;
};

export function useCardStack(scope: RefObject<HTMLElement | null>, options: Options) {
  const reduced = useReducedMotion();
  // The latest callbacks, kept outside render; the motion itself is built once per motion setting.
  const latest = useRef(options);
  useLayoutEffect(() => {
    latest.current = options;
  });

  useGSAP(
    () => {
      const root = scope.current!;
      const arrangement = arrangementOf(root);
      if (latest.current.arranged !== undefined && arrangement !== "stack") return;
      const section = root.closest<HTMLElement>("[data-segment]")!;
      const intro = root.querySelector<HTMLElement>(".stack-intro")!;
      const deck = root.querySelector<HTMLElement>(".stack-cards")!;
      const lanes = [...root.querySelectorAll<HTMLElement>(".stack-lane")];
      const cards = lanes.map((lane) => lane.querySelector<HTMLElement>(".stack-card")!);
      const contents = cards.map((card) => card.querySelector<HTMLElement>(CONTENT)!);
      const arts = cards.map((card) => card.querySelector<SVGSVGElement>(".scene-art"));
      const pictures = cards.map((card) => card.querySelector<HTMLElement>("[data-shrinkable]"));
      const anchors = [...root.querySelectorAll<HTMLElement>(".stack-anchor")];
      // A previous reduced-motion or plain layout may have left a demonstration mid-way.
      root.querySelectorAll<HTMLElement | SVGElement>("[data-rest-text]").forEach((element) => {
        element.textContent = element.dataset.restText!;
      });
      if (reduced) {
        // oxlint-disable-next-line react/immutability -- the effect writes the DOM node it manages.
        root.dataset.stack = "off";
        return;
      }
      const { timing, leadScreens, previewDuringArrival } = latest.current;
      let plan: StackPlan | null = null;
      let next: StackPlan | null = null;
      let artMax: number[] = [];
      let pictureWidth: Array<number | null> = [];
      let overflow = false;
      let deckTop = 0;
      let active = -1;
      let screen = innerHeight;
      let detached = false;
      let flowing = false;

      // Demonstrations and introduction copy, played by the scroll; plain layout shows them finished.
      const arrivals = cards.map((card, i) => latest.current.buildArrival?.(card, i));
      const demos = cards.map((card, i) => latest.current.build?.(card, i));
      // In normal flow the whole card travels through the reading area. Nothing is pinned or
      // cropped; progress depends on that travel, including when a card is taller than the screen.
      const flowRange = (i: number) => {
        const top = layoutTop(cards[i]);
        return [top - screen * 0.8, top + cards[i].offsetHeight - screen * 0.45];
      };
      const at = (value: (plan: StackPlan) => number, i: number, end = false) => () =>
        plan ? layoutTop(deck) + value(plan) : latest.current.adaptive ? flowRange(i)[end ? 1 : 0] : 0;
      const triggers = cards.flatMap((_, i) => [
        arrivals[i] &&
          ScrollTrigger.create({
            trigger: deck,
            start: at((p) => (i === 0 ? p.arrival : p.contact[i]), i),
            end: at((p) => p.park[i], i, true),
            animation: arrivals[i],
            // The copy is completely filled at parking, without a trailing time tween.
            scrub: true,
            invalidateOnRefresh: true,
            onRefresh: () => redraw(arrivals[i]!),
          }),
        demos[i] &&
          ScrollTrigger.create({
            trigger: deck,
            start: at((p) => p.playFrom[i], i),
            end: at((p) => p.playTo[i], i, true),
            animation: demos[i],
            scrub: 0.3,
            invalidateOnRefresh: true,
            onRefresh: () => redraw(demos[i]!),
          }),
      ]).filter((trigger): trigger is ScrollTrigger => !!trigger);
      const finished = [...arrivals, ...demos].filter((t): t is gsap.core.Timeline => !!t);

      const opacity = cards.map((card) => gsap.quickSetter(card, "opacity"));
      const setActive = (card: HTMLElement, onShow: boolean) => {
        if (card.dataset.active !== String(onShow)) card.dataset.active = String(onShow);
      };
      const paint = (y: number) => {
        if (!plan) return;
        const relative = y - deckTop;
        cards.forEach((card, i) => {
          opacity[i](stackOpacity(plan!, i, relative));
          // On show from its rise until the next card has fully covered it.
          setActive(card, (i === 0 || relative >= plan!.takeoff[i]) && (i === cards.length - 1 || relative < plan!.park[i + 1]));
        });
        const top = cards.reduce((current, _, i) => (i > 0 && relative >= plan!.contact[i] ? i : current), 0);
        if (top !== active) {
          active = top;
          latest.current.onActive?.(top);
        }
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

      let mode = "initial";
      const setMode = (on: boolean, flow = false) => {
        root.dataset.stack = on ? "on" : "off";
        flowing = flow;
        if (flow) root.dataset.playback = "flow";
        else delete root.dataset.playback;
        const nextMode = on ? "stack" : flow ? "flow" : "static";
        if (nextMode === mode) return;
        mode = nextMode;
        triggers.forEach((trigger) => (on || flow ? trigger.enable(false) : trigger.disable(false)));
        if (on) painter.enable(false);
        else painter.disable(false);
        if (!on) {
          if (!flow) finished.forEach((timeline) => timeline.progress(1));
          gsap.set(cards, { opacity: 1 });
          cards.forEach((card) => setActive(card, true));
          latest.current.onActive?.(0);
          active = -1;
        }
      };
      setMode(false);

      // Keyboard focus in a card that is waiting, covered or leaving takes the page to where that
      // card is parked, uncovered and solid. Pointer focus leaves the page where it is.
      const focus = (event: FocusEvent) => {
        const target = event.target as HTMLElement;
        if (!plan || !target.matches(":focus-visible")) return;
        const i = cards.findIndex((card) => card.contains(target));
        if (i < 0) return;
        const relative = scrollY - deckTop;
        const last = i === cards.length - 1;
        const until = last ? plan.exit.fadeFrom : plan.contact[i + 1];
        if (relative >= plan.park[i] && relative <= until) return;
        window.scrollTo({ top: deckTop + Math.min(plan.anchors[i], until), behavior: "instant" });
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
            screen = m.screen;
            const introHeight = intro.offsetHeight;
            const preview = m.preview;
            // A diagram may shrink to leave breathing room for the next story's arrival, but
            // never below a legible size; its caption and labels keep their real height.
            artMax = [];
            // A picture may shrink so its card fits (fitPicture); on a phone none ever does.
            const measure = (height: number) => {
              const budget = stackBudget({ screen: m.screen, intro: height, gap: m.gap, bottom: m.bottom, preview, minPreview: m.em * 3, count: cards.length });
              const fits = contents.map((element, i) => (arts[i] ? null : fitPicture(element, pictures[i], budget, m.em)));
              pictureWidth = fits.map((fit) => fit?.width ?? null);
              return contents.map((element, i) => {
                const art = arts[i];
                if (!art) return fits[i]!.height;
                const box = element.getBoundingClientRect().height;
                const drawn = art.getBoundingClientRect();
                const surrounding = box - drawn.height;
                artMax[i] = Math.floor(m.screen - height - m.gap - m.bottom - Math.min(preview, m.screen * 0.1) * 1.7 - surrounding);
                return Math.ceil(surrounding + Math.min(drawn.width * 0.75, artMax[i])) + 2;
              });
            };
            const makePlan = (height: number) => planStack({
              screen: m.screen,
              intro: height,
              gap: m.gap,
              bottom: m.bottom,
              preview,
              minPreview: m.em * 3,
              content: measure(height),
              timing,
              leadScreens,
              previewDuringArrival,
            });
            next = makePlan(introHeight);
            detached = !!latest.current.adaptive && !next.fits;
            if (detached) next = makePlan(0);
            if (artMax.some((value) => value !== undefined && value < m.em * 8))
              next.problems.push("a diagram would be smaller than 8em");
            if (next.problems.length) next.fits = false;
          },
          write: () => {
            const p = next!;
            if (detached) root.dataset.intro = "flow";
            else delete root.dataset.intro;
            pictures.forEach((picture, i) => picture && setStyle(picture, "max-width", p.fits && pictureWidth[i] ? px(pictureWidth[i]!) : null));
            if (!p.fits) return;
            writeLanes(root, lanes, p);
            setStyle(root, "--stack-lead", px(p.lead));
            arts.forEach((art, i) => art && setStyle(art, "max-height", px(Math.max(0, artMax[i]))));
            anchors.forEach((anchor, i) => setStyle(anchor, "top", px(p.anchors[i])));
          },
          check: () => {
            overflow = next!.fits && cards.some((card) => card.scrollHeight > card.clientHeight + 1);
            // Painting between now and the next (possibly deferred) refresh uses the new position.
            deckTop = layoutTop(deck);
          },
          finish: () => {
            const on = next!.fits && !overflow;
            // Why the plain layout was chosen, for anyone inspecting the page.
            setFit(root, on ? null : [...next!.problems, ...(overflow ? ["a card's content overflows"] : [])]);
            if (on) plan = next;
            setMode(on, !on && !!latest.current.adaptive);
            if (!on) plan = null;
          },
          cardAt: (y) => {
            if (!plan) {
              if (!flowing) return null;
              const index = cards.findIndex((_, i) => {
                const [from, to] = flowRange(i);
                return y >= from && y <= to;
              });
              return index < 0 ? null : index;
            }
            const relative = y - deckTop;
            if (relative < plan.arrival || relative > plan.exit.release) return null;
            return cards.reduce((current, _, i) => (i > 0 && relative >= plan!.contact[i] ? i : current), 0);
          },
          phaseAt: (i, y) => {
            const [from, to] = plan ? [deckTop + plan.playFrom[i], deckTop + plan.playTo[i]] : flowRange(i);
            return plan || flowing ? (y - from) / Math.max(1, to - from) : null;
          },
          cards: () => cards,
          // A card is shown at the same point of its demonstration (parked, if it had not started),
          // or midway through its reading time; in the plain layout, near the top of the list.
          scrollFor: (i, phase) => {
            if (!plan) {
              if (flowing && phase !== null) {
                const [from, to] = flowRange(i);
                return from + Math.min(1, Math.max(0, phase)) * (to - from);
              }
              return layoutTop(cards[i]) - innerHeight * 0.08;
            }
            if (phase === null || phase > 1) return deckTop + plan.anchors[i];
            return deckTop + (phase < 0 ? plan.park[i] : plan.playFrom[i] + phase * (plan.playTo[i] - plan.playFrom[i]));
          },
          // Text and caption sizes, not the boxes the plan sizes, so a plan cannot re-trigger itself.
          // A shrunk picture is sized by the plan, so its card's other parts are watched instead.
          observe: () => [
            intro,
            ...contents.flatMap((content, i) =>
              arts[i]
                ? [...content.querySelectorAll(".scene-heading, .scene-caption")]
                : pictureWidth[i]
                  ? [...content.children].filter((child) => !child.contains(pictures[i]))
                  : [content],
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
        cards.forEach((card) => delete card.dataset.active);
        finished.forEach((timeline) => timeline.progress(1));
        // Opacity painted per frame is not part of the GSAP context, so it is cleared here.
        cards.forEach((card) => card.style.removeProperty("opacity"));
        delete root.dataset.stack;
        delete root.dataset.intro;
        delete root.dataset.playback;
        setFit(root, null);
        clearLanes(root, lanes);
        root.style.removeProperty("--stack-lead");
        arts.forEach((art) => art?.style.removeProperty("max-height"));
        pictures.forEach((picture) => picture?.style.removeProperty("max-width"));
        anchors.forEach((anchor) => anchor.style.removeProperty("top"));
      };
    },
    { scope, dependencies: [reduced, options.arranged], revertOnUpdate: true },
  );
}
