import { useRef } from "react";
import { gsap, ScrollTrigger, useGSAP } from "@/lib/gsap";
import { useVisibleTimeline } from "@/hooks/useVisibleTimeline";
import { useReducedMotion } from "@/hooks/useReducedMotion";

/* Each project visual demonstrates its subject and loops only while visible. */

const W = 320;

// Video motion amplification: a barely visible vibration and the same signal amplified.
export function WaveVisual() {
  const root = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();

  useGSAP(
    () => {
      const raw = root.current!.querySelector<SVGPathElement>(".wave-raw")!;
      const amp = root.current!.querySelector<SVGPathElement>(".wave-amp")!;
      const state = { a: 22, phase: 0 };
      const path = (a: number, phase: number) => {
        let d = "";
        for (let x = 0; x <= W; x += 4) {
          const t = x / W;
          const y =
            45 +
            a *
              (Math.sin(t * 18 + phase) * 0.75 +
                Math.sin(t * 41 + phase * 1.7) * 0.25) *
              Math.sin(Math.PI * t);
          d += `${x === 0 ? "M" : "L"}${x},${y.toFixed(2)}`;
        }
        return d;
      };
      const draw = () => {
        raw.setAttribute("d", path(2.2, state.phase));
        amp.setAttribute("d", path(state.a, state.phase));
      };
      draw();
      if (reduce) return;
      state.a = 3;
      const tick = () => {
        state.phase += 0.045;
        draw();
      };
      const swell = gsap.to(state, {
        a: 30,
        duration: 2.6,
        ease: "sine.inOut",
        yoyo: true,
        repeat: -1,
        paused: true,
      });
      let visible = false;
      const update = () => {
        if (visible && !document.hidden) {
          gsap.ticker.add(tick);
          swell.play();
        } else {
          gsap.ticker.remove(tick);
          swell.pause();
        }
      };
      ScrollTrigger.create({
        trigger: root.current,
        start: "top bottom",
        end: "bottom top",
        onToggle: (self) => {
          visible = self.isActive;
          update();
        },
      });
      document.addEventListener("visibilitychange", update);
      return () => {
        document.removeEventListener("visibilitychange", update);
        gsap.ticker.remove(tick);
      };
    },
    { scope: root, dependencies: [reduce], revertOnUpdate: true },
  );

  return (
    <div ref={root}>
      <svg
        viewBox={`0 0 ${W} 90`}
        className="h-auto w-full"
        role="img"
        aria-label="A faint vibration signal and the same signal amplified"
      >
        <line
          x1="0"
          y1="45"
          x2={W}
          y2="45"
          stroke="var(--color-line)"
          strokeWidth="1"
        />
        <path
          className="wave-raw"
          fill="none"
          stroke="var(--color-ink-faint)"
          strokeWidth="1.2"
        />
        <path
          className="wave-amp"
          fill="none"
          stroke="var(--color-pink-deep)"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </svg>
      <p
        className="mt-2 flex gap-5 font-mono text-[11px] text-ink-mute"
        aria-hidden="true"
      >
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-[1.5px] w-4 bg-ink-faint" />
          Original
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-[2px] w-4 bg-pink-deep" />
          Amplified
        </span>
      </p>
    </div>
  );
}

// Synthetic chart values used only by this independent animation.
const charts = [
  {
    question: "Which region grew fastest last quarter?",
    labels: ["North", "South", "East", "West", "Central"],
    values: [0.42, 0.68, 0.55, 0.92, 0.6],
  },
  {
    question: "Which month had the most registrations?",
    labels: ["Jan", "Feb", "Mar", "Apr", "May"],
    values: [0.56, 0.94, 0.65, 0.43, 0.73],
  },
  {
    question: "Which vehicle category leads this year?",
    labels: ["Cars", "Bikes", "Vans", "Buses", "Trucks"],
    values: [0.95, 0.73, 0.48, 0.32, 0.58],
  },
];
export function BarsVisual() {
  const root = useRef<HTMLDivElement>(null);
  useVisibleTimeline(root, (element) => {
    const bars = [...element.querySelectorAll<HTMLElement>(".chart-bar")];
    const labels = [...element.querySelectorAll<HTMLElement>(".chart-label")];
    const question = element.querySelector<HTMLElement>(".chart-question")!;
    const timeline = gsap.timeline({ repeat: -1, paused: true });
    // A round is done when the last bar settles; it then rests 5 seconds before the next.
    const done = 0.55 + 1.1 + 0.07 * (bars.length - 1);
    charts.forEach((chart, index) => {
      const at = index * (done + 5);
      timeline
        .to(bars, { scaleY: 0.05, duration: 0.35, stagger: 0.025 }, at)
        .call(
          () => {
            question.textContent = chart.question;
            labels.forEach((label, i) => {
              label.textContent = chart.labels[i];
            });
            element.dataset.example = String(index);
          },
          [],
          at + 0.5,
        )
        .to(
          bars,
          {
            scaleY: (i: number) => chart.values[i],
            backgroundColor: (i: number) =>
              chart.values[i] === Math.max(...chart.values)
                ? "#f5bfd0"
                : "#9fd3f2",
            duration: 1.1,
            stagger: 0.07,
            ease: "power2.inOut",
          },
          at + 0.55,
        )
        .to({}, { duration: 5 }, at + done);
    });
    return timeline;
  });
  return (
    <div ref={root} className="chart-demo" data-example="0">
      <p data-cycle-text className="chart-question">
        {charts[0].question}
      </p>
      <div className="chart-bars" aria-hidden="true">
        {charts[0].values.map((value, i) => (
          <div key={i}>
            <span
              className="chart-bar"
              style={{
                transform: `scaleY(${value})`,
                backgroundColor: i === 3 ? "#f5bfd0" : "#9fd3f2",
              }}
            />
            <span data-cycle-text className="chart-label">
              {charts[0].labels[i]}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
// Two CAPTCHAs per round: one warped and crossed by squiggly lines, one hazy and blurred.
// Both resolve into clean text, and only then does the status read "Decoded".
// The resting markup is the solved state, so reduced motion shows readable text.
const rounds = [
  ["K7X2QP", "M4R9TW"],
  ["B8N3YD", "T6H2KV"],
  ["Q5W8RZ", "N3J7FX"],
];
const angles = [-18, 13, -11, 20, -16, 9];
export function CaptchaVisual() {
  const root = useRef<HTMLDivElement>(null);
  useVisibleTimeline(root, (element) => {
    const warped = [...element.querySelectorAll<HTMLElement>(".captcha-warped .captcha-letter")];
    const hazy = [...element.querySelectorAll<HTMLElement>(".captcha-hazy .captcha-letter")];
    const noise = element.querySelector(".captcha-noise");
    const haze = element.querySelector(".captcha-haze");
    const status = element.querySelector<HTMLElement>(".captcha-status")!;
    const timeline = gsap.timeline({ repeat: -1, paused: true });
    rounds.forEach(([first, second], index) => {
      // Done once both samples read "Decoded" (3.4s), then a 5 second rest.
      const at = index * 8.4;
      timeline
        .call(
          () => {
            warped.forEach((letter, i) => (letter.textContent = first[i]));
            hazy.forEach((letter, i) => (letter.textContent = second[i]));
            status.textContent = "Recognising";
            element.dataset.example = String(index);
          },
          [],
          at,
        )
        .set(
          warped,
          {
            rotation: (i: number) => angles[i],
            y: (i: number) => (i % 2 ? 6 : -5),
            skewX: (i: number) => angles[i] / 2,
            color: "#8e8c94",
          },
          at,
        )
        .set(noise, { opacity: 1 }, at)
        .set(hazy, { filter: "blur(1.7px)", opacity: 0.6, x: (i: number) => (i % 2 ? 2 : -2) }, at)
        .set(haze, { opacity: 1 }, at)
        .to(
          warped,
          { rotation: 0, y: 0, skewX: 0, color: "#15141a", duration: 0.9, stagger: 0.09, ease: "power2.inOut" },
          at + 1.1,
        )
        .to(noise, { opacity: 0, duration: 0.6 }, at + 1.4)
        .to(
          hazy,
          { filter: "blur(0px)", opacity: 1, x: 0, duration: 1, stagger: 0.09, ease: "power2.inOut" },
          at + 1.9,
        )
        .to(haze, { opacity: 0, duration: 0.7 }, at + 2.2)
        .call(
          () => {
            status.textContent = "Decoded";
          },
          [],
          at + 3.4,
        )
        .to({}, { duration: 5 }, at + 3.4);
    });
    return timeline;
  });
  const letters = (text: string) =>
    text.split("").map((char, i) => (
      <span data-cycle-text className="captcha-letter" key={i}>
        {char}
      </span>
    ));
  return (
    <div ref={root} className="captcha-demo" data-example="0">
      <div className="captcha-pair" aria-hidden="true">
        <div className="captcha-sample captcha-warped">
          <div className="captcha-letters">
            <svg viewBox="0 0 220 64" className="captcha-noise" preserveAspectRatio="none">
              <path
                d="M0 40C40 10 80 60 120 28S180 20 220 44M0 22C50 50 90 8 140 40S190 30 220 18"
                fill="none"
                stroke="#8e8c94"
              />
            </svg>
            {letters(rounds[0][0])}
          </div>
        </div>
        <div className="captcha-sample captcha-hazy">
          <div className="captcha-letters">
            <span className="captcha-haze" />
            {letters(rounds[0][1])}
          </div>
        </div>
      </div>
      <span data-cycle-text className="captcha-status">
        Decoded
      </span>
    </div>
  );
}
