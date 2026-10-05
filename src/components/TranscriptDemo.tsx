import { useRef } from "react";
import { Check, CheckCircle } from "@phosphor-icons/react";
import { gsap } from "@/lib/gsap";
import { useVisibleTimeline } from "@/hooks/useVisibleTimeline";

const spoken = "Kal raat neend nahi aayi, I kept thinking about the deadline.";
const translated =
  "I couldn’t sleep last night. I kept thinking about the deadline.";
const response = "What about the deadline has been on your mind?";
const words = (text: string, className: string) =>
  text.split(" ").map((word, i) => (
    <span className={className} key={i}>
      {word}{" "}
    </span>
  ));
export function TranscriptDemo() {
  const root = useRef<HTMLDivElement>(null);
  useVisibleTimeline(root, (element) => {
    const timeline = gsap.timeline({
      repeat: -1,
      paused: true,
    });
    const review = element.querySelector<HTMLElement>(".review-status")!;
    timeline
      .call(() => {
        review.textContent = "Ready for practitioner review";
      })
      .set(element.querySelectorAll(".transcript-word,.reply-word"), {
        opacity: 0.12,
      })
      .set(
        element.querySelectorAll(
          ".transcript-note,.transcript-approved,.transcript-saved",
        ),
        {
          autoAlpha: 0,
          y: 7,
        },
      )
      .fromTo(
        element.querySelector(".consent-line"),
        { opacity: 0.3 },
        { opacity: 1, duration: 0.65 },
      )
      .fromTo(
        element.querySelector(".spoken-line"),
        { opacity: 0.15 },
        { opacity: 1, duration: 0.8 },
        0.65,
      )
      .to(
        element.querySelectorAll(".transcript-word"),
        { opacity: 1, stagger: 0.11, duration: 0.2 },
        1.7,
      )
      .to(
        element.querySelectorAll(".reply-word"),
        { opacity: 1, stagger: 0.11, duration: 0.2 },
        3.6,
      )
      .to(
        element.querySelector(".transcript-note"),
        { autoAlpha: 1, y: 0, duration: 0.65 },
        5.3,
      )
      .to(
        element.querySelector(".transcript-approved"),
        { autoAlpha: 1, y: 0, duration: 0.5 },
        6.4,
      )
      .call(
        () => {
          review.textContent = "Reviewed by practitioner";
        },
        [],
        8,
      )
      .to(
        element.querySelector(".transcript-saved"),
        { autoAlpha: 1, y: 0, duration: 0.65 },
        8,
      )
      // Done once the note is saved (8.65s), then a 5 second rest.
      .to({}, { duration: 5 }, 8.65);
    return timeline;
  });
  return (
    <div ref={root} className="transcript-demo">
      <p className="consent-line">
        <Check size={13} weight="bold" /> Transcription enabled with consent
      </p>
      <div className="transcript-client">
        <p className="demo-label">
          Client <span>Hindi + English</span>
        </p>
        <p className="spoken-line">{spoken}</p>
        <p className="translation-line">
          {words(translated, "transcript-word")}
        </p>
      </div>
      <div className="transcript-practitioner">
        <p className="demo-label">Practitioner</p>
        <p>{words(response, "reply-word")}</p>
      </div>
      <div className="transcript-note">
        <p className="demo-label">Draft note</p>
        <p>Difficulty sleeping, with worries about an upcoming deadline.</p>
        <p className="transcript-approved">
          <Check size={13} weight="bold" />{" "}
          <span data-cycle-text className="review-status">
            Reviewed by practitioner
          </span>
        </p>
      </div>
      <div className="transcript-saved">
        <CheckCircle size={23} weight="light" />
        <div>
          <p className="demo-label">Session record</p>
          <p>Reviewed note saved to the client’s record.</p>
        </div>
      </div>
    </div>
  );
}
