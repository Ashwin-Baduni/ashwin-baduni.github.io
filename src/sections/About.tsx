import { useRef, useState } from "react";
import { about } from "@/content";
import { useScrollReveal } from "@/hooks/useScrollReveal";
import { gsap, ScrollTrigger, useGSAP } from "@/lib/gsap";
import { layoutTop } from "@/lib/scrollGeometry";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useSkillSequence } from "@/hooks/useSkillSequence";
import { useCardStack } from "@/hooks/useCardStack";
import { useStoryArrangement } from "@/hooks/useStoryArrangement";
import { CapabilityScene } from "@/components/CapabilityScene";
import { Words } from "@/components/ui/Words";

export function About() {
  const root = useRef<HTMLElement>(null);
  const reduced = useReducedMotion();
  useScrollReveal(root);
  useGSAP(
    () => {
      if (reduced) return;
      const scrub = 0.4;
      // The portrait opens up as it rises into view.
      gsap.fromTo(
        ".portrait-image",
        { clipPath: "inset(14% 12% 14% 12% round 14px)", scale: 1.1 },
        {
          clipPath: "inset(0% 0% 0% 0% round 14px)",
          scale: 1,
          ease: "none",
          scrollTrigger: {
            trigger: ".portrait-composition",
            start: "top 95%",
            end: "clamp(center 58%)",
            scrub,
          },
        },
      );
      gsap.fromTo(
        ".portrait-pink",
        { y: 18, rotate: -6 },
        {
          y: -18,
          rotate: -2,
          ease: "none",
          scrollTrigger: {
            trigger: root.current,
            start: "top bottom",
            end: "bottom top",
            scrub: 0.7,
          },
        },
      );
      gsap.fromTo(
        ".portrait-blue",
        { y: -18, rotate: 5 },
        {
          y: 18,
          rotate: 1,
          ease: "none",
          scrollTrigger: {
            trigger: root.current,
            start: "top bottom",
            end: "bottom top",
            scrub: 0.7,
          },
        },
      );
      // One reading cursor across every paragraph, so a later line never fills ahead
      // of an earlier one. Finish while the last line is comfortably on screen.
      const copy = root.current!.querySelector<HTMLElement>(".about-copy")!;
      const words = [...copy.querySelectorAll<HTMLElement>(".word")];
      const start = () => layoutTop(copy) - innerHeight * 0.82;
      gsap.set(words, { opacity: 0.22 });
      const timeline = gsap.timeline({
        scrollTrigger: {
          trigger: copy,
          start,
          end: () => {
            const distance = Math.max(100, copy.offsetHeight - innerHeight * 0.12);
            // CSS selects the desktop composition. Keep the phone's reading cursor unchanged.
            const pace = Number(getComputedStyle(copy).getPropertyValue("--about-reading-scale")) || 1;
            return Math.min(ScrollTrigger.maxScroll(window), start() + distance * pace);
          },
          invalidateOnRefresh: true,
          scrub: true,
        },
      });
      timeline.to(words, {
        opacity: 1,
        duration: 0.1,
        stagger: 0.1,
        ease: "none",
      }, 0);
      copy.querySelectorAll<HTMLElement>(".about-mark").forEach((mark) => {
        const inside = mark.querySelectorAll<HTMLElement>(".word");
        gsap.set(mark, { "--p": 0 });
        timeline.to(mark, {
          "--p": 1, duration: inside.length * 0.1, ease: "none",
        }, words.indexOf(inside[0]) * 0.1);
      });
    },
    { scope: root, dependencies: [reduced], revertOnUpdate: true },
  );
  return (
    <section
      ref={root}
      id="about"
      tabIndex={-1}
      data-segment
      aria-labelledby="about-title"
      className="segment outline-none"
    >
      <div className="wrap about-layout">
        <div className="portrait-composition">
          <div className="portrait-pink" aria-hidden="true" />
          <div className="portrait-blue" aria-hidden="true" />
          <div className="portrait-corner corner-top" aria-hidden="true" />
          <div className="portrait-corner corner-bottom" aria-hidden="true" />
          <picture>
            <source
              type="image/webp"
              srcSet="/images/ashwin-480.webp 480w, /images/ashwin-960.webp 960w"
              sizes="(min-width: 1024px) 360px, 80vw"
            />
            <img
              className="portrait-image"
              src="/images/ashwin-960.jpg"
              width="960"
              height="1200"
              loading="lazy"
              alt="Ashwin Baduni"
            />
          </picture>
        </div>
        <div>
          <h2 id="about-title" data-enter="1" className="section-title">
            {about.title}
          </h2>
          <div className="about-copy">
            {about.paragraphs.map((paragraph, index) => (
              <p key={index}>
                {paragraph
                  .split(/(\{(?:blue|pink):[^}]+\})/g)
                  .map((part, i) => {
                    const marked = part.match(/^\{(blue|pink):([^}]+)\}$/);
                    if (!marked) return <Words key={i} text={part} />;
                    return (
                      <span
                        key={i}
                        className={`mark about-mark ${marked[1] === "blue" ? "mark-blue" : ""}`}
                      >
                        <Words text={marked[2]} />
                      </span>
                    );
                  })}
              </p>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

const focusAnchors = [
  "focus-vision",
  "focus-agents",
  "focus-learning",
  "focus-product",
];

/*
  Each capability's copy fills in the held introduction while its illustration arrives.
  Cards cover one another completely. Only once parked does the illustration assemble.
  The plain layout keeps every title and description with its own illustration.
*/
function assemble(card: HTMLElement) {
  // Each picture stands on its first part; the rest rise in one after another.
  const [, ...rest] = card.querySelectorAll(".scene-piece, .scene-caption");
  const timeline = gsap.timeline({ paused: true, defaults: { ease: "none" } });
  rest.forEach((part, order) => {
    const at = (order / rest.length) * 0.7;
    timeline.fromTo(
      part,
      { opacity: 0, y: 14 },
      { opacity: 1, y: 0, duration: 0.3, ease: "back.out(1.6)" },
      at,
    );
    part
      .querySelectorAll(".scene-trace")
      .forEach((trace) =>
        timeline.fromTo(
          trace,
          { strokeDashoffset: 24 },
          { strokeDashoffset: 0, duration: 0.3, ease: "power2.out" },
          at,
        ),
      );
  });
  return timeline;
}

export function Focus() {
  const stack = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const arranged = useStoryArrangement(stack);
  useCardStack(stack, {
    arranged,
    timing: { allow: 0.06, play: 0.8, read: 0.16, lastRead: 0.02 },
    buildArrival: (_, index) => {
      const copy = stack.current!.querySelectorAll(".focus-intro-copy")[index];
      const words = copy.querySelectorAll(".word");
      gsap.set(words, { opacity: 0.22 });
      return gsap.timeline({ paused: true }).to(
        words,
        { opacity: 1, duration: 0.1, stagger: 0.1, ease: "none" },
      );
    },
    build: assemble,
    onActive: setActive,
  });
  useSkillSequence(stack, { arranged, build: assemble, onActive: setActive });
  return (
    <section
      id="focus"
      data-segment
      aria-labelledby="focus-title"
      className="stack-section"
    >
      {/* The stack sits inside the wrap, so header and cards share its gutters. */}
      <div className="wrap">
        <div ref={stack} className="stack focus-stack">
          <div className="stack-intro-track">
            <div className="stack-intro" data-story-intro>
              <h2 id="focus-title" className="kind">
                {about.focusTitle}
              </h2>
              <nav className="skills-menu" aria-label="Skills chapters">
                {about.focus.map((focus, index) => (
                  <div className="skills-menu-item" key={focus.area}>
                    <a href={`#${focusAnchors[index]}`} aria-current={active === index ? "step" : undefined}>
                      <span>{focus.area}</span>
                    </a>
                    <p className="skills-menu-detail">{focus.detail}</p>
                  </div>
                ))}
              </nav>
              {/* All copies share a grid cell to reserve the tallest one's height.
                  Switching chapters therefore cannot move the card's parked position. */}
              <div className="focus-intro-copies">
                {about.focus.map((focus, index) => (
                  // A visual copy of the card's own words, which assistive technology reads there.
                  <div
                    key={focus.area}
                    className={`focus-intro-copy ${active === index ? "is-active" : ""}`}
                    aria-hidden="true"
                  >
                    <h3><Words text={focus.area} /></h3>
                    <p><Words text={focus.detail} /></p>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="stack-cards">
            {focusAnchors.map((id) => (
              <span
                key={id}
                id={id}
                className="stack-anchor"
                aria-hidden="true"
              />
            ))}
            <div className="skills-stage-lane">
              <div className="skills-stage">
                {about.focus.map((focus, index) => (
                  <div className="stack-lane" key={focus.area}>
                    <article
                      className="stack-card focus-card"
                      data-chapter={focusAnchors[index]}
                      aria-labelledby={`focus-card-${index}`}
                    >
                      <div className="focus-card-content">
                        <div className="focus-card-copy">
                          <h3 id={`focus-card-${index}`}>{focus.area}</h3>
                          <p>{focus.detail}</p>
                        </div>
                        <div className="focus-card-visual">
                          <CapabilityScene active={index} only />
                        </div>
                      </div>
                    </article>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
