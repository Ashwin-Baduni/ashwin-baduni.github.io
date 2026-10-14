import type { RefObject } from "react";
import { gsap, ScrollTrigger, useGSAP } from "@/lib/gsap";
import { layoutTop } from "@/lib/scrollGeometry";
import { exitOpacity, handoffOpacity, planHandoff, type Exit, type HandoffPlan } from "@/lib/storyPlan";
import { exitOf, px, register, setStyle, type Metrics } from "@/lib/storyLayout";
import { useReducedMotion } from "./useReducedMotion";

/*
  Between sections on phones. The next section's real introduction ([data-story-intro]) waits faintly
  below the previous story's final card from the moment that card parks. Its lane reaches back
  over the previous story (see the introduction lanes in index.css), so the browser holds it
  there with `position: sticky`; it then rises with the page in normal document flow and joins
  its own section. Because it waits below the parked card and then moves in flow, its text
  always keeps a clear gap from the outgoing content. JavaScript only fades: the waiting
  introduction is faint until it rises, and the outgoing story fades as it leaves.
  Desktop has no waiting previews. Its introductions, and those that follow plain sections,
  simply fade in as they arrive in normal flow.
*/
type Entry = {
  intro: HTMLElement;
  lane: HTMLElement;
  text: HTMLElement;
  previous: HTMLElement | null;
  natural: number;
  plan: HandoffPlan | null;
};

export function useSectionHandoffs(scope: RefObject<HTMLElement | null>) {
  const reduced = useReducedMotion();
  useGSAP(() => {
    if (reduced) return;
    const main = scope.current!;
    const sections = [...main.querySelectorAll<HTMLElement>("[data-segment]")];
    const entries: Entry[] = [...main.querySelectorAll<HTMLElement>("[data-story-intro]")].map((intro) => {
      const section = intro.closest<HTMLElement>("[data-segment]")!;
      return {
        intro,
        lane: intro.parentElement!,
        text: intro.matches("h2") ? intro : intro.querySelector<HTMLElement>("h2, p")!,
        previous: sections[sections.indexOf(section) - 1] ?? null,
        natural: 0,
        plan: null,
      };
    });
    const stories = sections
      .map((section) => ({ section, root: section.querySelector<HTMLElement>(".stack") }))
      .filter((story): story is { section: HTMLElement; root: HTMLElement } => !!story.root);
    let screen = innerHeight;
    let outgoing: Array<{ root: HTMLElement; exit: Exit | null }> = [];
    const fadeIntro = entries.map((entry) => gsap.quickSetter(entry.intro, "opacity"));
    const fadeStory = new Map(stories.map(({ root }) => [root, gsap.quickSetter(root, "opacity")]));

    const paint = (y: number) => {
      // The closing section may be too short to reach the usual fade endpoint. Read the actual
      // limit here so a changing mobile toolbar is accounted for without re-planning the lanes.
      const maxScroll = ScrollTrigger.maxScroll(window);
      entries.forEach((entry, i) => fadeIntro[i](handoffOpacity(
        entry.plan ?? { active: false } as HandoffPlan, y, entry.natural, screen, maxScroll,
      )));
      outgoing.forEach(({ root, exit }) => fadeStory.get(root)!(exit ? exitOpacity(exit, y, screen) : 1));
    };

    const unregister = register({
      late: true,
      read: (m: Metrics) => {
        screen = m.screen;
        outgoing = stories.map(({ section, root }) => ({ root, exit: exitOf(section) }));
        entries.forEach((entry) => {
          const reach = parseFloat(entry.lane.style.getPropertyValue("--reach")) || 0;
          // The lane starts `reach` above the introduction's own place in the flow.
          entry.natural = layoutTop(entry.lane) + reach;
          const previous = exitOf(entry.previous);
          entry.plan = previous && !m.desktop
            ? planHandoff({
                screen: m.screen,
                preview: m.preview,
                clearance: Math.max(12, m.gap / 2),
                minVisible: m.em * 2,
                inset: entry.text.getBoundingClientRect().top - entry.intro.getBoundingClientRect().top,
                height: entry.intro.offsetHeight,
                natural: entry.natural,
                previous,
              })
            : null;
        });
      },
      write: () => {
        entries.forEach(({ lane, plan }) => {
          const active = !!plan?.active;
          lane.dataset.handoff = active ? "on" : "off";
          setStyle(lane, "--reach", active ? px(plan!.reach) : null);
          setStyle(lane, "--handoff-wait", active ? px(plan!.wait) : null);
        });
      },
    });
    ScrollTrigger.create({
      trigger: main,
      start: 0,
      end: "max",
      onUpdate: (self) => paint(self.scroll()),
      onRefresh: (self) => paint(self.scroll()),
    });
    // Keyboard focus inside a faint, waiting introduction (a product's title link) brings the
    // introduction to where it is held and solid. Pointer focus leaves the page where it is.
    const focus = (event: FocusEvent) => {
      const target = event.target as HTMLElement;
      const entry = entries.find(({ intro }) => intro.contains(target));
      if (!entry || !target.matches(":focus-visible") || Number(getComputedStyle(entry.intro).opacity) >= 0.9) return;
      window.scrollTo({ top: entry.natural, behavior: "instant" });
    };
    main.addEventListener("focusin", focus);
    return () => {
      main.removeEventListener("focusin", focus);
      unregister();
      // Opacity painted per frame is not part of the GSAP context, so it is cleared here.
      entries.forEach(({ intro }) => intro.style.removeProperty("opacity"));
      stories.forEach(({ root }) => root.style.removeProperty("opacity"));
      entries.forEach(({ lane }) => {
        delete lane.dataset.handoff;
        lane.style.removeProperty("--reach");
        lane.style.removeProperty("--handoff-wait");
      });
    };
  }, { scope, dependencies: [reduced], revertOnUpdate: true });
}
