import { useRef } from "react";
import {
  Check,
  CalendarBlank,
  MagnifyingGlass,
  Microphone,
  VideoCamera,
} from "@phosphor-icons/react";
import { gsap } from "@/lib/gsap";
import { useVisibleTimeline } from "@/hooks/useVisibleTimeline";

function Participant({
  name,
  practitioner = false,
}: {
  name: string;
  practitioner?: boolean;
}) {
  return (
    <div
      className={`call-participant ${practitioner ? "call-practitioner" : ""}`}
    >
      <svg viewBox="0 0 120 72" aria-hidden="true">
        <circle
          cx="60"
          cy="26"
          r="12"
          fill={practitioner ? "#b03d68" : "#1d6aa0"}
          opacity=".55"
        />
        <path
          d="M34 72v-8c0-17 11-25 26-25s26 8 26 25v8"
          fill={practitioner ? "#b03d68" : "#1d6aa0"}
          opacity=".3"
        />
      </svg>
      <span>{name}</span>
    </div>
  );
}
export function MatchDemo() {
  const root = useRef<HTMLDivElement>(null);
  useVisibleTimeline(root, (element) => {
    const timeline = gsap.timeline({ repeat: -1, paused: true });
    timeline
      .fromTo(
        element.querySelectorAll(".booking-step"),
        { opacity: 0.18, y: 7 },
        { opacity: 1, y: 0, duration: 0.7, stagger: 1.8 },
      )
      .fromTo(
        element.querySelectorAll(".booking-connector"),
        { scaleY: 0 },
        { scaleY: 1, duration: 1.3, stagger: 1.8, ease: "none" },
        0.3,
      )
      .fromTo(
        element.querySelector(".call-connected"),
        { autoAlpha: 0 },
        { autoAlpha: 1, duration: 0.6 },
        6.4,
      )
      // Done once the call connects (7s), then a 5 second rest.
      .to({}, { duration: 5 }, 7);
    return timeline;
  });
  return (
    <div ref={root} className="booking-demo">
      <div className="booking-step">
        <span className="booking-icon">
          <MagnifyingGlass size={17} />
        </span>
        <div>
          <p className="demo-label">Find someone</p>
          <p>Support with stress and sleep</p>
        </div>
        <span className="booking-connector" aria-hidden="true" />
      </div>
      <div className="booking-step">
        <span className="booking-icon booking-avatar">A</span>
        <div>
          <p className="demo-label">Meet your practitioner</p>
          <p>Anika · Talk therapy</p>
          <small>A practical, conversational approach.</small>
        </div>
        <span className="booking-connector" aria-hidden="true" />
      </div>
      <div className="booking-step">
        <span className="booking-icon">
          <CalendarBlank size={17} />
        </span>
        <div>
          <p className="demo-label">Choose a time</p>
          <p>Thursday, 4:00 pm</p>
          <small>50 minutes · Online session</small>
        </div>
        <span className="booking-connector" aria-hidden="true" />
      </div>
      <div className="booking-step booking-session">
        <span className="booking-icon">
          <VideoCamera size={17} />
        </span>
        <div className="booking-call-content">
          <p className="demo-label">Join your session</p>
          <div
            className="session-call"
            role="img"
            aria-label="An online video session with you and Anika"
          >
            <div className="call-participants">
              <Participant name="You" />
              <Participant name="Anika" practitioner />
            </div>
            <div className="call-controls">
              <span className="call-connected">
                <Check size={12} weight="bold" /> Connected
              </span>
              <span aria-hidden="true">
                <Microphone size={13} />
                <VideoCamera size={15} />
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
