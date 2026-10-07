import { usePageScroll } from "@/hooks/usePageScroll";
import { useScrollGravity } from "@/hooks/useScrollGravity";
import { Hero } from "@/sections/Hero";
import { About, Focus } from "@/sections/About";
import { Building } from "@/sections/Building";
import { Experience } from "@/sections/Experience";
import { Projects } from "@/sections/Projects";

export default function App() {
  usePageScroll();
  useScrollGravity();
  return (
    <>
      <a href="#about" className="skip-link">
        Skip introduction
      </a>
      <main id="main">
        <Hero />
        <About />
        <Building />
        <Focus />
        <Experience />
        <Projects />
      </main>
    </>
  );
}
