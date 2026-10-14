import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(ScrollTrigger, useGSAP);

// A phone's address bar grows and shrinks while scrolling. That changes only the height,
// so trigger positions stay as they are instead of being recalculated mid-gesture.
ScrollTrigger.config({ ignoreMobileResize: true });

/*
  A ScrollTrigger refresh rewinds each animation to measure, then restores its progress with events
  suppressed. Tweened styles come back, but anything a demonstration draws in onUpdate (typed text,
  plate characters, statuses) would keep the rewound state. Calling every onUpdate in the animation
  redraws it from the restored progress; scroll stories do this in each trigger's onRefresh.
*/
export function redraw(animation: gsap.core.Animation) {
  const timelines = animation instanceof gsap.core.Timeline ? animation.getChildren(true, false, true) : [];
  [animation, ...timelines].forEach((child) => child.eventCallback("onUpdate")?.call(child));
}

export { gsap, ScrollTrigger, useGSAP };
