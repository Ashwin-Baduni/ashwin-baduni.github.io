import { useRef } from "react";
import { experience } from "@/content";
import { useScrollReveal } from "@/hooks/useScrollReveal";
import { ArrowText } from "@/components/ui/LinkArrow";
import { Certificate, CaretUp } from "@phosphor-icons/react";

// The certifications, in their own short section after Projects.
export function Certifications() {
  const root = useRef<HTMLElement>(null);
  useScrollReveal(root);
  return (
    <section
      ref={root}
      id="certifications"
      data-segment
      aria-labelledby="certifications-title"
      className="certifications"
    >
      <div className="wrap">
        <div className="handoff-lane">
          <h2 id="certifications-title" data-story-intro className="section-title">
            Certifications
          </h2>
        </div>
        <ul className="certification-list">
          {experience.certificates.map((c) => (
            <li key={c.name} data-enter="2">
              <a href={c.href} target="_blank" rel="noreferrer">
                <Certificate size={24} weight="light" aria-hidden="true" />
                {c.level ? (
                  <span>
                    <span className="link-underline">{c.name}</span>
                    <br />
                    <ArrowText>{c.level}</ArrowText>
                  </span>
                ) : <ArrowText>{c.name}</ArrowText>}
              </a>
            </li>
          ))}
        </ul>
        <div className="back-to-top-wrap" data-enter="2">
          <a className="back-to-top" href="#top">
            <CaretUp size={19} weight="regular" aria-hidden="true" />
            <span>Back to the top</span>
          </a>
        </div>
      </div>
    </section>
  );
}
