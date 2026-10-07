import { useRef, useState, type CSSProperties } from "react";
import { about } from "@/content";
import { useScrollReveal } from "@/hooks/useScrollReveal";
import { gsap, ScrollTrigger, useGSAP } from "@/lib/gsap";
import { layoutTop, revealEnd } from "@/lib/scrollGeometry";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { CapabilityScene } from "@/components/CapabilityScene";

// Each word is its own span so the paragraph can light up word by word as it is read.
function Words({ text }: { text: string }) {
  return text.split(/(\s+)/).map((part, i) =>
    /^\s+$/.test(part) || !part ? (
      part
    ) : (
      <span key={i} className="word">
        {part}
      </span>
    ),
  );
}

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
      // Words light up in reading order as each paragraph moves up the screen, and a
      // highlight sweeps in behind its phrase as the reading reaches it.
      gsap.utils.toArray<HTMLElement>(".about-copy p").forEach((paragraph) => {
        const words = [...paragraph.querySelectorAll<HTMLElement>(".word")];
        const step = 0.1;
        const timeline = gsap.timeline({
          scrollTrigger: {
            trigger: paragraph,
            start: "clamp(top 95%)",
            end: () =>
              revealEnd(
                root.current!,
                layoutTop(paragraph) +
                  paragraph.offsetHeight -
                  innerHeight * 0.86,
              ),
            invalidateOnRefresh: true,
            scrub,
          },
        });
        timeline.fromTo(
          words,
          { opacity: 0.22 },
          { opacity: 1, duration: 0.3, stagger: step, ease: "none" },
          0,
        );
        paragraph
          .querySelectorAll<HTMLElement>(".about-mark")
          .forEach((mark) => {
            const inside = mark.querySelectorAll(".word");
            timeline.fromTo(
              mark,
              { "--p": 0 },
              { "--p": 1, duration: inside.length * step + 0.3, ease: "none" },
              words.indexOf(inside[0] as HTMLElement) * step,
            );
          });
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
        <div data-gravity-reading>
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
  Four chapters in one panel that holds still while the page scrolls past it, as on product
  pages like apple.com. The scroll position alone drives it, so a finger, a trackpad and a wheel
  all drive the same sequence. Gravity holds each completed chapter between gestures.
  Scrolling always shows something happening: the bar fills, and the parts of the current
  picture pop in one after another, its caption last. Scrolling back takes them away again.
  Past the end of a chapter the next one switches in by itself and builds the same way.
  On wide screens the list sits beside the scene; on narrow ones numbered progress bars and
  the current chapter's text replace it.
*/
export function Focus() {
  const root = useRef<HTMLElement>(null);
  const [active, setActive] = useState(0);
  const reduced = useReducedMotion();
  const steps = about.focus.length;
  useScrollReveal(root);
  useGSAP(
    () => {
      const section = root.current!;
      const panel = section.querySelector<HTMLElement>("[data-sticky]")!;
      const track = section.querySelector<HTMLElement>(".focus-track")!;
      // A panel taller than the screen is held with its lower edge on screen instead.
      const overflow = () =>
        Math.max(0, -parseFloat(getComputedStyle(panel).top) || 0);
      let height = 0;
      const observer = new ResizeObserver(() => {
        if (Math.abs(panel.offsetHeight - height) < 1) return;
        const first = !height;
        height = panel.offsetHeight;
        section.style.setProperty("--focus-panel", `${height}px`);
        if (!first) {
          const y = scrollY;
          ScrollTrigger.refresh();
          window.scrollTo({ top: y, behavior: "instant" });
        }
      });
      observer.observe(panel);

      const stages = gsap.utils.toArray<HTMLElement>(".cap-stage", section);
      // Each picture's parts in the order they pop up, ending with its caption.
      const parts = stages.map((stage) => [
        ...stage.querySelectorAll<Element>(".scene-piece, .scene-caption"),
      ]);
      const shown = parts.map(() => 0);
      // Parts arrive across most of each chapter, so new ones keep appearing as you scroll.
      const build = 0.8;
      let position = 0;
      const show = (stage: number, count: number) => {
        let order = 0;
        parts[stage].forEach((part, index) => {
          const visible = index < count;
          if (visible === index < shown[stage]) return;
          if (visible) {
            gsap.to(part, {
              opacity: 1,
              y: 0,
              duration: 0.55,
              delay: order++ * 0.08,
              ease: "back.out(1.6)",
              overwrite: true,
            });
            part
              .querySelectorAll(".scene-trace")
              .forEach((trace) =>
                gsap.fromTo(
                  trace,
                  { strokeDashoffset: 24 },
                  { strokeDashoffset: 0, duration: 0.9, ease: "power2.out" },
                ),
              );
          } else
            gsap.to(part, {
              opacity: 0,
              y: 14,
              duration: 0.25,
              overwrite: true,
            });
        });
        shown[stage] = count;
      };
      const reveal = () => {
        if (reduced) return;
        const current = Math.min(steps - 1, Math.floor(position));
        parts.forEach((list, stage) => {
          const done =
            stage < current
              ? 1
              : stage > current
                ? 0
                : Math.min(1, (position - stage) / build);
          // The current chapter always shows at least its first part.
          show(
            stage,
            stage === current
              ? Math.max(1, Math.ceil(done * list.length))
              : Math.ceil(done * list.length),
          );
        });
      };
      const apply = (progress: number) => {
        position = progress * steps;
        panel.style.setProperty("--focus-progress", position.toFixed(4));
        setActive(Math.min(steps - 1, Math.floor(position)));
        reveal();
      };

      // While a chapter is on screen its picture drifts slowly with the scroll.
      let drift: gsap.core.Timeline | undefined;
      if (!reduced) {
        gsap.set(parts.flat(), { opacity: 0, y: 14 });
        drift = gsap.timeline({ defaults: { ease: "none" } });
        stages.forEach((stage, index) =>
          drift!.fromTo(
            stage.querySelector(".scene-drift"),
            { y: 10 },
            { y: -10, duration: 1 },
            index,
          ),
        );
      }
      ScrollTrigger.create({
        trigger: section,
        start: () => `top+=${overflow()} top`,
        end: () => `+=${track.offsetHeight}`,
        animation: drift,
        scrub: drift && 0.3,
        onUpdate: (self) => apply(self.progress),
        onRefresh: (self) => apply(self.progress),
      });
      return () => {
        observer.disconnect();
        gsap.killTweensOf(parts.flat());
      };
    },
    { scope: root, dependencies: [reduced], revertOnUpdate: true },
  );
  return (
    <section
      ref={root}
      id="focus"
      data-segment
      aria-labelledby="focus-title"
      className="focus-sequence"
      style={{ "--focus-steps": steps } as CSSProperties}
    >
      {focusAnchors.map((id, index) => (
        <span
          key={id}
          id={id}
          className="focus-stop"
          style={{ "--i": index } as CSSProperties}
          aria-hidden="true"
        />
      ))}
      <div className="focus-pin" data-sticky>
        <div className="wrap focus-layout">
          <div className="focus-copy">
            <h2 id="focus-title" data-enter="1" className="section-title">
              {about.focusTitle}
            </h2>
            <ul className="capability-list" data-enter="2">
              {about.focus.map((focus, index) => (
                <li
                  key={focus.area}
                  className={active === index ? "capability-active" : ""}
                  style={{ "--i": index } as CSSProperties}
                >
                  <a
                    href={`#${focusAnchors[index]}`}
                    aria-current={active === index ? "step" : undefined}
                  >
                    <span className="capability-progress" aria-hidden="true" />
                    <span className="capability-number" aria-hidden="true">
                      0{index + 1}
                    </span>
                    <div className="capability-text">
                      <h3>{focus.area}</h3>
                      <p>{focus.detail}</p>
                    </div>
                  </a>
                </li>
              ))}
            </ul>
            <div className="focus-now" data-enter="2" aria-hidden="true">
              {about.focus.map((focus, index) => (
                <div
                  key={focus.area}
                  className={active === index ? "is-active" : undefined}
                >
                  <p className="focus-now-title">{focus.area}</p>
                  <p>{focus.detail}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="focus-visual" data-enter="3">
            <CapabilityScene active={active} />
          </div>
        </div>
      </div>
      <div className="focus-track" aria-hidden="true" />
    </section>
  );
}
