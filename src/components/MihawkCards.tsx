import type { ProductPart } from "@/content";
import { gsap } from "@/lib/gsap";

/*
  Vision Tech reads a plate in close-up, pulls back and records the event. Yoru searches
  for UP plates, selects that car from two matches and opens today's entry/exit history.
  Timelines follow scroll progress (useCardStack); without motion, both show the final state.
*/
const example = {
  plate: "UP 16 BX 4471",
  camera: "CAM 2 · East gate",
  time: "18:42",
  exitTime: "19:36",
  record: "UP 16 BX 4471 · East gate · 18:42",
  question: "Which cars with UP plates arrived today?",
  secondPlate: "UP 32 AK 9086",
};
// The close-up enlarges each layer around the plate; nearer layers more, for a little depth.
const ZOOM = { subject: 3.4, gate: 2.9, road: 2.4 };
const PLATE = { x: 240, y: 222 };
// Scaling about the plate, written as a scale from the corner plus a shift. Every value is
// exactly zero at rest, so the pulled-back view lands precisely in place.
const about = (scale: number) => ({
  scale,
  x: PLATE.x * (1 - scale),
  y: PLATE.y * (1 - scale),
  svgOrigin: "0 0",
});

function RecordRow({ className }: { className: string }) {
  return (
    <div className={`plate-record ${className}`}>
      <span className="record-check" aria-hidden="true">
        ✓
      </span>
      <div>
        <p className="demo-label">Event recorded</p>
        <p className="plate-record-text">{example.record}</p>
      </div>
    </div>
  );
}

function CardHead({ part }: { part: ProductPart }) {
  return (
    <div className="product-demo-heading product-card-head">
      <h3>{part.name}</h3>
      <p>{part.text}</p>
    </div>
  );
}

export function VisionCard({ part }: { part: ProductPart }) {
  return (
    <article className="stack-card product-card vision-card">
      <div className="product-card-content">
        <CardHead part={part} />
        <div className="product-card-visual mseq-visual">
          {/* May shrink, keeping its proportions, so the card fits a short window (fitPicture). */}
          <div className="mseq-camera" data-shrinkable>
            <svg
              viewBox="0 0 480 300"
              role="img"
              aria-label={`A camera at the east gate detects a car and reads its plate, ${example.plate}.`}
            >
              <g className="mseq-camera-move">
                <g className="mseq-road" fill="none">
                  <path d="M40 300 220 112M440 300 260 112" />
                  <path d="M240 300V112" strokeDasharray="9 9" />
                  <path d="M0 112h480" opacity=".6" />
                </g>
                <g className="mseq-gate">
                  <rect x="104" y="98" width="9" height="136" rx="2" />
                  <path className="mseq-gate-arm" d="M113 106 190 56" />
                  <path
                    className="mseq-gate-stripes"
                    d="M128 96l5 8M146 84l5 8M164 72l5 8"
                  />
                </g>
                <g className="mseq-subject">
                  <ellipse cx="240" cy="247" rx="69" ry="7" fill="#15141a" opacity=".12" />
                  <g className="mseq-car">
                    <rect className="mseq-wheel" x="177" y="223" width="19" height="27" rx="5" />
                    <rect className="mseq-wheel" x="284" y="223" width="19" height="27" rx="5" />
                    <path d="M176 231v-24c0-8 4-13 13-18l13-32c3-9 10-14 22-15h32c12 1 19 6 22 15l13 32c9 5 13 10 13 18v24c0 8-7 12-16 12h-96c-9 0-16-4-16-12Z" />
                    <path
                      className="mseq-car-glass"
                      d="m201 181 10-26c2-4 6-6 13-7h32c7 1 11 3 13 7l10 26c-24-4-54-4-78 0Z"
                    />
                    <path className="mseq-windshield-shine" d="m217 154-7 20m13-21-6 18" />
                    <path d="m195 183-15-1c-5 0-7 3-5 6l13 3m97-8 15-1c5 0 7 3 5 6l-13 3" />
                    <path className="mseq-hood-line" d="M197 187c28-5 58-5 86 0m-88 1 14 10h62l14-10" />
                    <path className="mseq-headlight" d="m183 198 29 4 6 7-31-3c-3 0-4-3-4-8Zm114 0-29 4-6 7 31-3c3 0 4-3 4-8Z" />
                    <path className="mseq-grille" d="M222 202h36l-4 6h-28Z" />
                    <path className="mseq-bumper" d="M184 228v4c18 8 94 8 112 0v-4m-102 5h92" />
                  </g>
                  <g className="mseq-plate">
                    <rect x="200" y="214" width="80" height="17" rx="2.5" />
                    <rect className="mseq-plate-strip" x="200" y="214" width="7" height="17" rx="1.5" />
                    <text className="mseq-plate-num" x="243.5" y="225.9" textAnchor="middle">
                      {[...example.plate].map((character, i) => (
                        <tspan key={i} x={214.7 + i * 4.8} data-rest-text={character}>{character}</tspan>
                      ))}
                    </text>
                  </g>
                  <rect className="mseq-scan" x="195" y="209" width="0" height="27" />
                  {/* Detection brackets live with the car, so they stay attached to it. */}
                  <g className="mseq-plate-box">
                    <path d="M195 216v-7h7M285 216v-7h-7M195 229v7h7M285 229v7h-7" />
                  </g>
                  <g className="mseq-car-box">
                    <path d="M164 156v-16h16M316 156v-16h-16M164 238v16h16M316 238v16h-16" />
                  </g>
                </g>
              </g>
            </svg>
            <div className="mseq-hud" aria-hidden="true">
              <span>{example.camera}</span>
              <span className="mseq-hud-status">
                <span>{example.time}</span>
                <span className="mseq-car-label">Vehicle detected</span>
              </span>
            </div>
          </div>
        </div>
        <RecordRow className="mseq-record product-card-side" />
      </div>
    </article>
  );
}

export function YoruCard({ part }: { part: ProductPart }) {
  return (
    <article className="stack-card product-card yoru-card">
      <div className="product-card-content">
        <CardHead part={part} />
        <div className="product-card-visual agent-demo">
          <div className="demo-label-row">
            <span>Ask Yoru</span>
            <span className="mseq-status" aria-hidden="true" data-rest-text="History open">
              History open
            </span>
          </div>
          <p className="agent-question">
            <span className="mseq-q" aria-hidden="true" data-rest-text={example.question}>
              {example.question}
            </span>
            <span className="sr-only">{example.question}</span>
            <span className="caret" aria-hidden="true" />
          </p>
          <div className="agent-evidence mseq-evidence">
            <p className="demo-label">2 cars detected today</p>
            <ul className="agent-events yoru-results">
              <li className="agent-event yoru-result-first">
                <span>{example.time}</span>
                <span>East gate</span>
                <span>{example.plate}</span>
              </li>
              <li className="agent-event">
                <span>10:16</span>
                <span>North gate</span>
                <span>{example.secondPlate}</span>
              </li>
            </ul>
          </div>
          <div className="yoru-history mseq-answer">
            <div className="yoru-history-heading">
              <span>{example.plate}</span>
            </div>
            <dl className="yoru-visits">
              <div><dt>Entered · <span className="yoru-gate">East gate</span></dt><dd>{example.time}</dd></div>
              <div><dt>Left · <span className="yoru-gate">South gate</span></dt><dd>{example.exitTime}</dd></div>
            </dl>
          </div>
        </div>
      </div>
      <svg className="yoru-select-cursor" viewBox="0 0 24 28" aria-hidden="true">
        <path d="M3 2v20l6-5 5 9 4-2-5-9h8Z" />
      </svg>
    </article>
  );
}

// Close-up, plate read, pull back, vehicle boxed, event recorded.
export function buildVision(card: HTMLElement) {
  const find = (selector: string) => card.querySelector<HTMLElement>(selector)!;
  const letters = [...card.querySelectorAll<SVGTSpanElement>(".mseq-plate-num tspan")];
  const scan = card.querySelector<SVGRectElement>(".mseq-scan")!;
  const scanner = { front: 195 };
  // One position drives both the strip and the characters. It never leaves the brackets.
  const drawScan = () => {
    const left = Math.max(195, scanner.front - 12);
    scan.setAttribute("x", String(left));
    scan.setAttribute("width", String(scanner.front - left));
    letters.forEach((letter, i) => {
      const character = example.plate[i];
      letter.textContent = character === " " || scanner.front >= 214.7 + i * 4.8
        ? character : "·";
    });
  };
  const timeline = gsap.timeline({
    paused: true,
    defaults: { ease: "none" },
    onUpdate: drawScan,
  });
  const layers = [find(".mseq-subject"), find(".mseq-gate"), find(".mseq-road")];
  const found = [find(".mseq-car-box"), find(".mseq-hud")];
  gsap.set(find(".mseq-camera-move"), { y: -72 });
  (["subject", "gate", "road"] as const).forEach((layer) =>
    gsap.set(find(`.mseq-${layer}`), about(ZOOM[layer])),
  );
  // The gate also sits a little further out to the side in the close-up.
  gsap.set(find(".mseq-gate"), { x: "-=18" });
  gsap.set(find(".mseq-plate-box"), { autoAlpha: 0 });
  gsap.set(scan, { autoAlpha: 1 });
  drawScan();
  gsap.set(found, { autoAlpha: 0 });
  gsap.set(find(".mseq-record"), { autoAlpha: 0, y: 10 });
  return timeline
    .to(find(".mseq-plate-box"), { autoAlpha: 1, duration: 0.06 }, 0)
    .to(scanner, { front: 285, duration: 0.22 }, 0.04)
    .to(scan, { autoAlpha: 0, duration: 0.04 }, 0.26)
    .to(find(".mseq-camera-move"), { y: 0, duration: 0.3, ease: "power2.inOut" }, 0.36)
    .to(layers, { scale: 1, x: 0, y: 0, duration: 0.3, ease: "power2.inOut" }, 0.36)
    .to(found, { autoAlpha: 1, duration: 0.08 }, 0.62)
    .to(find(".mseq-record"), { autoAlpha: 1, y: 0, duration: 0.14 }, 0.76)
    .set({}, {}, 1);
}

// A broad search, two matching plates, selecting the East Gate record, then its history.
export function buildYoru(card: HTMLElement) {
  const find = (selector: string) => card.querySelector<HTMLElement>(selector)!;
  const question = find(".mseq-q");
  const status = find(".mseq-status");
  const typed = { question: 0 };
  const timeline = gsap.timeline({
    paused: true,
    defaults: { ease: "none" },
    onUpdate: () => {
      question.textContent = example.question.slice(0, Math.round(typed.question));
      const p = timeline.progress();
      status.textContent = p < 0.32 ? "" : p < 0.48 ? "Searching" : p < 0.74 ? "2 matches" : "History open";
    },
  });
  gsap.set([find(".mseq-evidence"), find(".mseq-answer")], { autoAlpha: 0, y: 8 });
  gsap.set(card.querySelectorAll(".agent-event"), { opacity: 0, x: 8 });
  gsap.set(find(".yoru-result-first"), { backgroundColor: "transparent", borderColor: "transparent" });
  const cursor = find(".yoru-select-cursor");
  const inset = () => parseFloat(getComputedStyle(find(".product-card-content")).paddingLeft);
  const destination = () => {
    const row = find(".yoru-result-first");
    let x = 0, y = 0;
    let node: HTMLElement | null = row;
    while (node && node !== card) {
      x += node.offsetLeft;
      y += node.offsetTop;
      node = node.offsetParent as HTMLElement | null;
    }
    return { x: x + row.clientWidth * 0.25, y: y + row.clientHeight * 0.55 };
  };
  gsap.set(cursor, { autoAlpha: 0, scale: 1 });
  return timeline
    .to(typed, { question: example.question.length, duration: 0.25 }, 0.04)
    .to(find(".mseq-evidence"), { autoAlpha: 1, y: 0, duration: 0.08 }, 0.34)
    .to(card.querySelectorAll(".agent-event"), { x: 0, opacity: 1, duration: 0.08, stagger: 0.07 }, 0.38)
    .fromTo(cursor,
      { x: inset, y: () => card.clientHeight - inset() - cursor.getBoundingClientRect().height },
      { x: () => destination().x, y: () => destination().y, duration: 0.23, ease: "power1.inOut" }, 0.4)
    .to(cursor, { autoAlpha: 1, duration: 0.06 }, 0.4)
    .to(cursor, { scale: 0.8, duration: 0.04 }, 0.64)
    .to(find(".yoru-result-first"), { backgroundColor: "#e4f2fc", borderColor: "#9fd3f2", duration: 0.08 }, 0.65)
    .to(cursor, { autoAlpha: 0, scale: 1, duration: 0.07 }, 0.7)
    .to(find(".mseq-answer"), { autoAlpha: 1, y: 0, duration: 0.14 }, 0.74)
    .set({}, {}, 1);
}
