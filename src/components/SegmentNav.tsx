import { useState } from "react";
import { ScrollTrigger, useGSAP } from "@/lib/gsap";
import { cn } from "@/lib/utils";

export const SEGMENTS = [
  { id: "top", label: "Intro" },
  { id: "about", label: "About" },
  { id: "focus", label: "What I do" },
  { id: "building", label: "MihawkAI" },
  { id: "kehsun", label: "Kehsun" },
  { id: "experience", label: "Experience" },
  { id: "projects", label: "Projects" },
  { id: "contact", label: "Contact" },
];

/*
  A slim rail on the right edge. Dots stay small, but each link has a generous hit area,
  one accessible name, and the current section's label stays visible. Other labels appear
  on hover or keyboard focus.
*/
export function SegmentNav() {
  const [active, setActive] = useState("top");

  useGSAP(() => {
    SEGMENTS.forEach(({ id }) =>
      ScrollTrigger.create({
        trigger: `#${id}`,
        start: "top 50%",
        end: "bottom 50%",
        onToggle: (self) => self.isActive && setActive(id),
      }),
    );
  });

  return (
    <nav id="sections" tabIndex={-1} aria-label="Sections" className="fixed top-1/2 right-3 z-30 hidden -translate-y-1/2 outline-none lg:block">
      <ul className="flex flex-col items-end">
        {SEGMENTS.map((s) => {
          const on = active === s.id;
          return (
            <li key={s.id}>
              <a href={`#${s.id}`} aria-label={s.label} aria-current={on ? "location" : undefined} className="group flex min-h-7 items-center gap-3 py-1 pr-2 pl-4">
                <span
                  aria-hidden="true"
                  className={cn(
                    "rounded bg-paper/90 px-1 font-mono text-[11px] tracking-[0.06em] text-ink-mute uppercase transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100",
                    on ? "translate-x-0 opacity-0 min-[1480px]:opacity-100" : "translate-x-1 opacity-0",
                  )}
                >
                  {s.label}
                </span>
                <span
                  aria-hidden="true"
                  className={cn(
                    "block w-[5px] rounded-full transition-all duration-500 ease-(--ease-out-expo)",
                    on ? "h-6 bg-pink-deep" : "h-[5px] bg-ink-faint group-hover:bg-ink-strong group-focus-visible:bg-ink-strong",
                  )}
                />
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
