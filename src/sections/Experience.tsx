import { useRef } from "react";
import { experience } from "@/content";
import { useScrollReveal } from "@/hooks/useScrollReveal";
import { layoutTop, revealEnd } from "@/lib/scrollGeometry";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { gsap, ScrollTrigger, useGSAP } from "@/lib/gsap";
import { ArrowText } from "@/components/ui/LinkArrow";

export function Experience() {
  const root = useRef<HTMLElement>(null);
  const reduced = useReducedMotion();
  const { roles, education } = experience;
  useScrollReveal(root);
  useGSAP(
    () => {
      if (reduced) return;
      const dots = gsap.utils.toArray<HTMLElement>(".experience-dot");
      const lastDot = dots[dots.length - 1];
      gsap.fromTo(
        ".experience-line",
        { scaleY: 0 },
        {
          scaleY: 1,
          ease: "none",
          scrollTrigger: {
            trigger: ".experience-timeline",
            start: "top 70%",
            end: () =>
              revealEnd(root.current!, layoutTop(lastDot) - innerHeight * 0.84),
            invalidateOnRefresh: true,
            scrub: 0.4,
          },
        },
      );
      dots.forEach((dot) =>
        ScrollTrigger.create({
          trigger: dot,
          start: () =>
            revealEnd(root.current!, layoutTop(dot) - innerHeight * 0.84) - 1,
          onRefresh: (self) =>
            dot.classList.toggle("is-lit", self.scroll() >= self.start),
          onEnter: () => dot.classList.add("is-lit"),
          onLeaveBack: () => dot.classList.remove("is-lit"),
        }),
      );
      return () =>
        root.current
          ?.querySelectorAll(".experience-dot")
          .forEach((dot) => dot.classList.remove("is-lit"));
    },
    { scope: root, dependencies: [reduced], revertOnUpdate: true },
  );
  return (
    <section
      ref={root}
      id="experience"
      data-segment
      aria-labelledby="experience-title"
      className="segment"
    >
      <div className="wrap">
        <div className="handoff-lane">
          <h2 id="experience-title" data-story-intro className="section-title">
            Experience
          </h2>
        </div>
        <div className="experience-timeline">
          <div className="experience-line" aria-hidden="true" />
          <ol>
            {roles.map((role, index) => (
              <li
                key={role.org}
                className={`experience-row ${index === 0 ? "current-role" : ""}`}
              >
                <p data-settle className="experience-date">
                  {role.dates}
                </p>
                <span className="experience-dot" aria-hidden="true" />
                <div data-settle className="experience-detail">
                  <h3>
                    {role.title}
                    <span> at </span>
                    <a
                      href={role.href}
                      target="_blank"
                      rel="noreferrer"
                      className="org-link"
                      aria-label={`Visit ${role.org}`}
                    >
                      <ArrowText>
                        {role.orgShort ? (
                          <abbr title={role.org}>{role.orgShort}</abbr>
                        ) : (
                          role.org
                        )}
                      </ArrowText>
                    </a>
                  </h3>
                  <p>{role.text}</p>
                </div>
              </li>
            ))}
            <li className="experience-row">
              <p data-settle className="experience-date">
                {education.dates}
              </p>
              <span className="experience-dot" aria-hidden="true" />
              <div data-settle className="experience-detail">
                <h3>{education.degree}</h3>
                <p>
                  <a
                    className="org-link"
                    href={education.href}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <ArrowText>{education.school}</ArrowText>
                  </a>
                </p>
              </div>
            </li>
          </ol>
        </div>
      </div>
    </section>
  );
}
