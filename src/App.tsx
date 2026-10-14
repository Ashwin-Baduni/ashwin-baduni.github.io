import { usePageScroll } from "@/hooks/usePageScroll";
import { Hero } from "@/sections/Hero";
import { About, Focus } from "@/sections/About";
import { Building } from "@/sections/Building";
import { Experience } from "@/sections/Experience";
import { Projects } from "@/sections/Projects";
import { Certifications } from "@/sections/Certifications";
import { useRef } from "react";
import { useSectionHandoffs } from "@/hooks/useSectionHandoffs";
import { useDesktopSettle } from "@/hooks/useDesktopSettle";

export default function App() {
  const main = useRef<HTMLElement>(null);
  usePageScroll();
  useSectionHandoffs(main);
  useDesktopSettle(main);
  return (
    <>
      <a href="#about" className="skip-link">
        Skip introduction
      </a>
      <main ref={main} id="main">
        <Hero />
        <About />
        <Building />
        <Focus />
        <Experience />
        <Projects />
        <Certifications />
      </main>
    </>
  );
}
