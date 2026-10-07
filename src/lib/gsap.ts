import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ScrambleTextPlugin } from "gsap/ScrambleTextPlugin";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(ScrollTrigger, ScrambleTextPlugin, useGSAP);

// A phone's address bar grows and shrinks while scrolling. That changes only the height,
// so trigger positions stay as they are instead of being recalculated mid-gesture.
ScrollTrigger.config({ ignoreMobileResize: true });

export { gsap, ScrollTrigger, useGSAP };
