import { useEffect, useRef, useState } from "react";
import { about } from "@/content";
import { useEntrance } from "@/hooks/useEntrance";
import { gsap, useGSAP } from "@/lib/gsap";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { CapabilityScene } from "@/components/CapabilityScene";

export function About() {
  const root = useRef<HTMLElement>(null);
  const reduced = useReducedMotion();
  useEntrance(root, (tl, el) => {
    tl.fromTo(
      el.querySelector(".portrait-image"),
      { clipPath: "inset(100% 0% 0% 0%)", scale: 1.04 },
      {
        clipPath: "inset(0% 0% 0% 0%)",
        scale: 1,
        duration: 1.15,
        ease: "power2.inOut",
        immediateRender: false,
      },
      0,
    ).fromTo(
      el.querySelectorAll(".about-mark"),
      { "--p": 0 },
      {
        "--p": 1,
        duration: 0.95,
        stagger: 0.18,
        ease: "power2.inOut",
        immediateRender: false,
      },
      0.45,
    );
  });
  useGSAP(
    () => {
      if (reduced) return;
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
              <p key={index} data-enter={index === 2 ? "3" : "2"}>
                {paragraph.split(/(\{(?:blue|pink):[^}]+\})/g).map((part, i) => {
                  const marked = part.match(/^\{(blue|pink):([^}]+)\}$/);
                  if (!marked) return part;
                  return (
                    <span key={i} className={`mark about-mark ${marked[1] === "blue" ? "mark-blue" : ""}`}>
                      {marked[2]}
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

export function Focus() {
  const root = useRef<HTMLElement>(null);
  const [active, setActive] = useState(0);
  useEntrance(root);
  useEffect(() => {
    const update = () => {
      if (document.documentElement.dataset.snap !== "on") return;
      const step = Math.round(
        (scrollY - root.current!.offsetTop) / innerHeight,
      );
      setActive(Math.max(0, Math.min(3, step)));
    };
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-snap"],
    });
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    update();
    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);
  return (
    <section
      ref={root}
      id="focus"
      data-segment
      data-scroll-stages="4"
      aria-label="What I do"
      className="focus-sequence"
    >
      {focusAnchors.map((id, index) => (
        <span
          key={id}
          id={id}
          data-flow-target={`story-${index}`}
          className="focus-stop"
          style={{ top: `${index * 100}dvh` }}
          aria-hidden="true"
        />
      ))}
      <div className="focus-desktop segment" data-stage-panel>
        <div className="wrap">
          <h2 id="focus-title" data-enter="1" className="section-title">
            {about.focusTitle}
          </h2>
          <div className="focus-layout">
            <ul className="capability-list" data-enter="2">
              {about.focus.map((focus, index) => (
                <li
                  key={focus.area}
                  className={active === index ? "capability-active" : ""}
                >
                  <a
                    href={`#${focusAnchors[index]}`}
                    aria-current={active === index ? "step" : undefined}
                  >
                    <span className="capability-number" aria-hidden="true">
                      0{index + 1}
                    </span>
                    <div>
                      <h3>{focus.area}</h3>
                      <p>{focus.detail}</p>
                    </div>
                  </a>
                </li>
              ))}
            </ul>
            <div data-enter="3">
              <CapabilityScene phase={active} />
            </div>
          </div>
        </div>
      </div>
      <div className="focus-flow segment">
        <div className="wrap">
          <h2 className="section-title">{about.focusTitle}</h2>
          {about.focus.map((focus, index) => (
            <article
              className="focus-story"
              key={focus.area}
              aria-labelledby={`story-${index}`}
            >
              <div className="focus-story-copy">
                <span className="kind">0{index + 1} / 04</span>
                <h3 id={`story-${index}`}>{focus.area}</h3>
                <p>{focus.detail}</p>
              </div>
              <CapabilityScene phase={index} />
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
