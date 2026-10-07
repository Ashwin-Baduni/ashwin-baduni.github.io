import { useRef } from "react";
import { ArrowBendUpRight } from "@phosphor-icons/react";
import { gsap } from "@/lib/gsap";
import { useVisibleTimeline } from "@/hooks/useVisibleTimeline";

const plates = [
  { plate: "UP 16 BX 4471", record: "Car · East gate · 18:42" },
  { plate: "DL 08 CA 2196", record: "Car · North entrance · 09:14" },
  { plate: "HR 26 DK 8032", record: "Car · South gate · 16:08" },
];
export function PlateDemo() {
  const root = useRef<HTMLDivElement>(null);
  useVisibleTimeline(
    root,
    (element) => {
      const record = element.querySelector<HTMLElement>(".plate-record-text")!;
      const timeline = gsap.timeline({ repeat: -1, paused: true });
      plates.forEach((entry, index) => {
        // Show the review result, then hold it before the next plate.
        const at = index * 9;
        timeline
          .set(
            element.querySelectorAll(".plate-record, .plate-review"),
            { autoAlpha: 0, y: 8 },
            at,
          )
          .call(
            () => {
              record.textContent = entry.record;
              element.dataset.example = String(index);
            },
            [],
            at,
          )
          .fromTo(
            element.querySelectorAll(".plate-bracket"),
            { opacity: 0, scale: 1.4 },
            { opacity: 1, scale: 1, duration: 0.7, stagger: 0.05 },
            at,
          )
          .fromTo(
            element.querySelector(".plate-scan"),
            { xPercent: -100 },
            { xPercent: 600, duration: 1.8, ease: "power1.inOut" },
            at,
          )
          .to(
            element.querySelector(".plate-num"),
            {
              duration: 1.6,
              scrambleText: {
                text: entry.plate,
                chars: "ABCDEFGHJKLMNPRSTUVWXYZ0123456789",
                revealDelay: 0.3,
                speed: 0.4,
              },
            },
            at + 0.25,
          )
          .to(
            element.querySelector(".plate-record"),
            { autoAlpha: 1, y: 0, duration: 0.6 },
            at + 2,
          )
          .to(
            element.querySelector(".plate-review"),
            { autoAlpha: 1, y: 0, duration: 0.6 },
            at + 3.4,
          )
          .to({}, { duration: 5 }, at + 4);
      });
      return timeline.timeScale(1.7);
    },
    0.15,
  );
  return (
    <div ref={root} className="plate-demo" data-example="0">
      <div className="plate-scene">
        <div className="road-mark road-one" />
        <div className="road-mark road-two" />
        <div className="plate-detection">
          {["tl", "tr", "bl", "br"].map((corner) => (
            <span key={corner} className={`plate-bracket ${corner}`} />
          ))}
          <div className="number-plate">
            <span className="plate-country">IND</span>
            <span data-cycle-text className="plate-num">
              {plates[0].plate}
            </span>
          </div>
        </div>
        <span className="plate-scan" aria-hidden="true" />
        <span className="plate-scene-label">Vehicle detection</span>
      </div>
      <div className="plate-record">
        <span className="record-check" aria-hidden="true">
          ✓
        </span>
        <div>
          <p className="demo-label">Event recorded</p>
          <p data-cycle-text className="plate-record-text">
            {plates[0].record}
          </p>
        </div>
      </div>
      <div className="plate-review">
        <ArrowBendUpRight size={16} weight="bold" aria-hidden="true" />
        <span>Sent for review</span>
      </div>
    </div>
  );
}
