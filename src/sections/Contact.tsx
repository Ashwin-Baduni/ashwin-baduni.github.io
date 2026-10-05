import { useRef, useState } from "react";
import { ArrowUpRight, Check, Copy, DownloadSimple, GithubLogo, LinkedinLogo } from "@phosphor-icons/react";
import { contact, person } from "@/content";
import { gsap, ScrollTrigger, useGSAP } from "@/lib/gsap";
import { useEntrance } from "@/hooks/useEntrance";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { MagneticButton } from "@/components/ui/MagneticButton";

export function Contact() {
  const root = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(person.email);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      window.location.href = `mailto:${person.email}`;
    }
  };

  // The heading rises, the highlighter sweeps under "talk.", then the actions follow.
  useEntrance(root, (tl, el) => {
    const mark = el.querySelector<HTMLElement>(".mark")!;
    tl.fromTo(mark, { "--p": 0 }, { "--p": 1, duration: 0.7, ease: "power2.inOut" }, 0.55);
  });

  // The soft colour pools drift slowly, only while the section is on screen.
  useGSAP(
    () => {
      if (reduce) return;
      const drift = gsap
        .timeline({ repeat: -1, yoyo: true, paused: true, defaults: { ease: "sine.inOut" } })
        .to(".pool-sky", { xPercent: 12, yPercent: 10, duration: 9 }, 0)
        .to(".pool-pink", { xPercent: -14, yPercent: -8, duration: 9 }, 0);
      ScrollTrigger.create({ trigger: root.current, start: "top bottom", end: "bottom top", onToggle: (self) => (self.isActive ? drift.play() : drift.pause()) });
    },
    { scope: root, dependencies: [reduce], revertOnUpdate: true },
  );

  return (
    <section ref={root} id="contact" data-segment aria-labelledby="contact-title" className="segment">
      <div className="wrap">
        <div className="relative overflow-hidden rounded-3xl border border-line bg-card px-6 py-16 text-center md:px-12 md:py-24">
          <div aria-hidden="true" className="pool-sky pointer-events-none absolute -top-24 left-[15%] h-56 w-[60%] rounded-full bg-sky/30 blur-3xl" />
          <div aria-hidden="true" className="pool-pink pointer-events-none absolute -bottom-28 left-[35%] h-48 w-[45%] rounded-full bg-pink/30 blur-3xl" />
          <h2 id="contact-title" data-enter="1" className="section-title relative">
            {contact.titleBefore} <span className="mark">{contact.titleMark}</span>
          </h2>
          <p data-enter="2" className="relative mx-auto mt-5 max-w-[46ch] text-[17px] text-ink-mute">
            {contact.text}
          </p>
          <div data-enter="2" className="relative mt-9 flex flex-wrap items-center justify-center gap-3">
            <MagneticButton href={`mailto:${person.email}`} variant="primary" icon={<ArrowUpRight size={15} weight="bold" />}>
              Get in touch
            </MagneticButton>
            <button
              type="button"
              onClick={copy}
              aria-label={copied ? "Email address copied" : `Copy email address ${person.email}`}
              className="inline-flex items-center gap-2 rounded-[10px] border border-line-strong bg-card px-4 py-3 font-mono text-[13px] text-ink-strong transition-colors hover:border-ink-faint"
            >
              {copied ? <Check size={16} weight="bold" className="text-sky-deep" /> : <Copy size={16} weight="bold" />}
              <span aria-live="polite">{copied ? "Copied" : person.email}</span>
            </button>
          </div>
          <ul data-enter="3" className="relative mt-9 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm font-semibold text-ink-strong">
            <li>
              <a href={person.linkedin} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2">
                <LinkedinLogo size={18} weight="fill" className="text-sky-deep" aria-hidden="true" />
                <span className="link-underline">LinkedIn</span>
              </a>
            </li>
            <li>
              <a href={person.github} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2">
                <GithubLogo size={18} weight="fill" className="text-sky-deep" aria-hidden="true" />
                <span className="link-underline">GitHub</span>
              </a>
            </li>
            <li>
              <a href={person.cv} download className="inline-flex items-center gap-2">
                <DownloadSimple size={18} weight="bold" className="text-sky-deep" aria-hidden="true" />
                <span className="link-underline">Download CV</span>
              </a>
            </li>
          </ul>
        </div>
      </div>
    </section>
  );
}
