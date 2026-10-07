import { useRef } from "react";
import { gsap } from "@/lib/gsap";
import { useVisibleTimeline } from "@/hooks/useVisibleTimeline";

// Synthetic demonstration records, independent of any customer system.
const examples = [
  {
    question: "Which entrance gets busiest after 6 pm?",
    rows: [
      ["Mon", "East gate", "48 entries"],
      ["Tue", "East gate", "61 entries"],
      ["Tue", "Main lobby", "17 entries"],
    ],
    answer: "The east gate, especially on Tuesday evenings.",
  },
  {
    question: "Which vehicles stopped on the crossing today?",
    rows: [
      ["09:14", "North crossing", "Car"],
      ["12:36", "North crossing", "Van"],
      ["16:08", "South crossing", "Car"],
    ],
    answer: "Three vehicles. The matching events are ready for review.",
  },
  {
    question: "How did attendance change this week?",
    rows: [
      ["Mon", "Classroom A", "28 present"],
      ["Wed", "Classroom A", "30 present"],
      ["Fri", "Classroom A", "32 present"],
    ],
    answer: "Attendance increased through the week, from 28 to 32.",
  },
];

export function AgentDemo() {
  const root = useRef<HTMLDivElement>(null);
  useVisibleTimeline(
    root,
    (element) => {
      const q = element.querySelector<HTMLElement>(".agent-q")!;
      const answer = element.querySelector<HTMLElement>(".agent-answer")!;
      const cells = [
        ...element.querySelectorAll<HTMLElement>(".agent-events span"),
      ];
      const evidence = element.querySelector(".agent-evidence");
      const stage = element.querySelector<HTMLElement>(".agent-stage")!;
      const timeline = gsap.timeline({ repeat: -1, paused: true });
      examples.forEach((example, index) => {
        // Leave the completed answer readable before the next question.
        const at = index * 9.35;
        const typed = { n: 0 };
        timeline
          .set([evidence, answer], { autoAlpha: 0, y: 7 }, at)
          .call(
            () => {
              q.textContent = "";
              answer.textContent = example.answer;
              stage.textContent = "Finding records";
              example.rows.flat().forEach((value, i) => {
                cells[i].textContent = value;
              });
              element.dataset.example = String(index);
            },
            [],
            at,
          )
          .fromTo(
            typed,
            { n: 0 },
            {
              n: example.question.length,
              duration: 1.8,
              ease: "none",
              onUpdate: () => {
                q.textContent = example.question.slice(0, Math.round(typed.n));
              },
            },
            at,
          )
          .to(evidence, { autoAlpha: 1, y: 0, duration: 0.65 }, at + 2.1)
          .fromTo(
            element.querySelectorAll(".agent-event"),
            { x: 12, opacity: 0 },
            { x: 0, opacity: 1, stagger: 0.16, duration: 0.5 },
            at + 2.2,
          )
          .call(
            () => {
              stage.textContent = "Answer ready";
            },
            [],
            at + 3.4,
          )
          .to(answer, { autoAlpha: 1, y: 0, duration: 0.6 }, at + 3.4)
          .to([evidence, answer], { autoAlpha: 0, duration: 0.35 }, at + 9);
      });
      return timeline.timeScale(1.7);
    },
    0.15,
  );
  return (
    <div ref={root} className="agent-demo" data-example="0">
      <div className="demo-label-row">
        <span>Ask Yoru</span>
        <span data-cycle-text className="agent-stage">
          Answer ready
        </span>
      </div>
      <p className="agent-question">
        <span data-cycle-text className="agent-q">
          {examples[0].question}
        </span>
        <span className="caret" aria-hidden="true" />
      </p>
      <div className="agent-evidence">
        <p className="demo-label">Recorded events</p>
        <ul className="agent-events">
          {examples[0].rows.map((row, i) => (
            <li key={i} className="agent-event">
              {row.map((cell, j) => (
                <span data-cycle-text key={j}>
                  {cell}
                </span>
              ))}
            </li>
          ))}
        </ul>
      </div>
      <p data-cycle-text className="agent-answer">
        {examples[0].answer}
      </p>
    </div>
  );
}
