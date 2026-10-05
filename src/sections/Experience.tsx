import { useRef } from "react";
import { experience } from "@/content";
import { useEntrance } from "@/hooks/useEntrance";
import { ArrowText } from "@/components/ui/LinkArrow";

export function Experience() {
  const root = useRef<HTMLElement>(null);
  const { roles, education, certificates } = experience;
  useEntrance(root, (timeline, element) => {
    timeline
      .fromTo(
        element.querySelector(".experience-line"),
        { scaleY: 0 },
        {
          scaleY: 1,
          duration: 1.3,
          ease: "power2.inOut",
          immediateRender: false,
        },
        0,
      )
      .fromTo(
        element.querySelectorAll(".experience-dot"),
        { scale: 0 },
        {
          scale: 1,
          stagger: 0.14,
          duration: 0.5,
          ease: "back.out(1.6)",
          immediateRender: false,
        },
        0.2,
      );
  });
  return (
    <section
      ref={root}
      id="experience"
      data-segment
      aria-labelledby="experience-title"
      className="segment"
    >
      <div className="wrap">
        <h2 id="experience-title" data-enter="1" className="section-title">
          Experience
        </h2>
        <div className="experience-timeline">
          <div className="experience-line" aria-hidden="true" />
          <ol>
            {roles.map((role, index) => (
              <li
                key={role.org}
                className={`experience-row ${index === 0 ? "current-role" : ""}`}
              >
                <p data-enter="2" className="experience-date">
                  {role.dates}
                </p>
                <span className="experience-dot" aria-hidden="true" />
                <div data-enter="2" className="experience-detail">
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
              <p data-enter="2" className="experience-date">
                {education.dates}
              </p>
              <span className="experience-dot" aria-hidden="true" />
              <div data-enter="2" className="experience-detail">
                <h3>{education.degree}</h3>
                <p>
                  <a
                    className="link-underline"
                    href={education.href}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {education.school}
                  </a>
                </p>
                <div className="experience-certificates">
                  {certificates.map((c) => (
                    <a
                      key={c.name}
                      href={c.href}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <ArrowText>{c.name}</ArrowText>
                    </a>
                  ))}
                </div>
              </div>
            </li>
          </ol>
        </div>
      </div>
    </section>
  );
}
