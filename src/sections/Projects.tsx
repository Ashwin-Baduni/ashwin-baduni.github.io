import { useRef, type ReactNode } from "react";
import { Trophy } from "@phosphor-icons/react";
import { projects, type Project } from "@/content";
import { useCardStack } from "@/hooks/useCardStack";
import { useProjectGrid } from "@/hooks/useProjectGrid";
import { useStoryArrangement } from "@/hooks/useStoryArrangement";
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

function ProjectCard({ p }: { p: Project }) {
  return (
    <SpotlightCard className="stack-card project-card">
      <div className="project-card-content">
        <div className="project-heading">
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
        <div className="project-card-visual">{VISUALS[p.id]()}</div>
        {p.award && (
          <p className="project-award">
            <Trophy size={15} weight="fill" aria-hidden="true" />
            {p.award}
          </p>
        )}
        <p className="project-text">{p.text}</p>
      </div>
    </SpotlightCard>
  );
}

/*
  On phones, the same card stack as Skills: the heading stays at the top while Motion amplification rises
  and parks below it; Analytics chatbot waits faintly at the bottom, then rises and covers it;
  CAPTCHA recognition follows, with Certifications waiting below. The cards have looping visuals
  rather than scroll-played demonstrations, so each is held for a shorter reading time.
  Wide screens use a normal-flow grid: featured project left, Analytics and CAPTCHA right.
*/
export function Projects() {
  const stack = useRef<HTMLDivElement>(null);
  const arranged = useStoryArrangement(stack);
  useCardStack(stack, {
    arranged,
    leadScreens: 0.12,
    previewDuringArrival: true,
    timing: { allow: 0.04, play: 0.34, read: 0.12, lastRead: 0.02 },
  });
  useProjectGrid(stack, arranged);
  return (
    <section
      id="projects"
      data-segment
      aria-labelledby="projects-title"
      className="stack-section"
    >
      {/* The stack sits inside the wrap, so header and cards share its gutters. */}
      <div className="wrap">
        <div ref={stack} className="stack project-stack">
          <div className="stack-intro-track">
            <div className="stack-intro project-intro" data-story-intro>
              <h2 id="projects-title" className="section-title">
                {projects.title}
              </h2>
            </div>
          </div>
          <div className="stack-cards">
            {projects.list.map((p) => (
              <div className="stack-lane" key={p.id}>
                <ProjectCard p={p} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
