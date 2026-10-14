import { useRef } from "react";
import { hero, person } from "@/content";
import { useEntrance } from "@/hooks/useEntrance";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { gsap, useGSAP } from "@/lib/gsap";
import { SiteMap } from "@/components/SiteMap";
import { ContactActions } from "@/components/ContactActions";
import { CaretDown } from "@phosphor-icons/react";

export function Hero() {
  const root = useRef<HTMLElement>(null);
  const reduced = useReducedMotion();
  // As the introduction scrolls away, each half sinks back and fades a little, handing over
  // to the next section. Its progress is the scroll position itself.
  useGSAP(
    () => {
      gsap.fromTo(".hero-scroll-cue", { autoAlpha: 0.65 }, {
        autoAlpha: 0,
        ease: "none",
        scrollTrigger: {
          start: 0,
          end: () => reduced ? 1 : innerHeight * 0.045,
          scrub: true,
          invalidateOnRefresh: true,
        },
      });
      if (reduced) return;
      gsap.utils.toArray<HTMLElement>(".hero-recede").forEach((element) =>
        gsap.to(element, {
          y: 56,
          scale: 0.96,
          opacity: 0.3,
          ease: "none",
          scrollTrigger: {
            trigger: element,
            start: "clamp(bottom 62%)",
            end: "bottom top",
            scrub: 0.4,
          },
        }),
      );
    },
    { scope: root, dependencies: [reduced], revertOnUpdate: true },
  );
  useEntrance(root, (timeline, element) => {
    timeline.fromTo(
      element.querySelector(".mark"),
      { "--p": 0 },
      { "--p": 1, duration: 1, ease: "power2.inOut", immediateRender: false },
      0.35,
    );
  });
  return (
    <section
      ref={root}
      id="top"
      tabIndex={-1}
      data-segment
      aria-label="Introduction"
      className="segment outline-none"
    >
      <div className="wrap grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.08fr)] lg:gap-14">
        <div className="hero-recede name-fit min-w-0">
          <p
            data-enter="1"
            className="mb-4 font-mono text-[11.5px] tracking-[0.16em] text-sky-deep uppercase"
          >
            {person.role}
          </p>
          <h1
            data-enter="1"
            className="hero-name font-serif leading-[1.05] font-medium tracking-[-0.03em] text-ink-strong"
          >
            {person.name}
          </h1>
          <p
            data-enter="2"
            className="mt-5 mb-8 max-w-[38ch] font-serif text-[clamp(19px,1.9vw,22px)] leading-[1.5] text-pretty text-ink-mute"
          >
            <span className="block text-balance">{hero.ledeFirst}</span>
            <span className="block">
              {hero.ledeBefore}{" "}
              <span className="whitespace-nowrap">
                <span className="mark">{hero.ledeMark}</span>
                {hero.ledeAfter}
              </span>
            </span>
          </p>
          <div data-enter="3">
            <ContactActions />
          </div>
        </div>
        <div data-enter="2">
          <SiteMap className="hero-recede relative aspect-[5/4] max-h-[78svh] overflow-hidden rounded-2xl border border-line bg-card" />
        </div>
      </div>
      <div className="hero-scroll-cue" aria-hidden="true">
        <span>Scroll</span>
        <CaretDown size={19} weight="regular" />
      </div>
    </section>
  );
}
