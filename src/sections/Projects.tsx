import { useRef, type ReactNode } from "react";
import { Trophy } from "@phosphor-icons/react";
import { projects, type Project } from "@/content";
import { useScrollReveal } from "@/hooks/useScrollReveal";
import { layoutTop, revealEnd } from "@/lib/scrollGeometry";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { gsap, useGSAP } from "@/lib/gsap";
import { SpotlightCard } from "@/components/ui/SpotlightCard";
import { ArrowText } from "@/components/ui/LinkArrow";
import {
  BarsVisual,
  CaptchaVisual,
  WaveVisual,
} from "@/components/ProjectVisuals";

const VISUALS: Record<Project["id"], () => ReactNode> = {
  motion: () => <WaveVisual />,
  analytics: () => <BarsVisual />,
  captcha: () => <CaptchaVisual />,
};

function ProjectCard({ p, featured }: { p: Project; featured?: boolean }) {
  return (
    <SpotlightCard
      className={
        featured
          ? "flex h-full flex-col p-6 md:p-7"
          : "flex h-full flex-col px-6 py-4"
      }
    >
      {p.award && (
        <p className="project-award">
          <Trophy size={15} weight="fill" aria-hidden="true" />
          {p.award}
        </p>
      )}
      <div className={featured ? "mb-6 lg:mt-auto lg:mb-auto lg:py-6" : "mb-3"}>
        {VISUALS[p.id]()}
      </div>
      <div
        className={`project-heading ${featured ? "project-heading-featured" : ""}`}
      >
        <h3>
          <a
            href={p.href}
            target="_blank"
            rel="noreferrer"
            className="project-title-link"
            aria-label={`View ${p.name} on GitHub`}
          >
            <ArrowText>{p.name}</ArrowText>
          </a>
        </h3>
      </div>
      <p className="mt-1.5 text-[15px] leading-[1.5] text-ink-mute">{p.text}</p>
    </SpotlightCard>
  );
}

export function Projects() {
  const root = useRef<HTMLElement>(null);
  const reduced = useReducedMotion();
  const [featured, ...rest] = projects.list;
  useScrollReveal(root);
  useGSAP(
    () => {
      if (reduced) return;
      // Positions come from the still slot; the card inside it is what moves.
      gsap.utils.toArray<HTMLElement>(".project-grow").forEach((slot) =>
        gsap.fromTo(
          slot.firstElementChild,
          { y: 56, scale: 0.94 },
          {
            y: 0,
            scale: 1,
            ease: "none",
            scrollTrigger: {
              trigger: slot,
              start: "top bottom",
              end: () =>
                revealEnd(root.current!, layoutTop(slot) - innerHeight * 0.7),
              invalidateOnRefresh: true,
              scrub: 0.4,
            },
          },
        ),
      );
    },
    { scope: root, dependencies: [reduced], revertOnUpdate: true },
  );

  return (
    <section
      ref={root}
      id="projects"
      data-segment
      aria-labelledby="projects-title"
      className="segment"
    >
      <div className="wrap">
        <h2 id="projects-title" data-enter="1" className="section-title">
          {projects.title}
        </h2>
        <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
          <div className="project-grow lg:row-span-2">
            <div className="h-full">
              <ProjectCard p={featured} featured />
            </div>
          </div>
          {rest.map((p) => (
            <div key={p.id} className="project-grow" data-gravity-reading>
              <div className="h-full">
                <ProjectCard p={p} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
