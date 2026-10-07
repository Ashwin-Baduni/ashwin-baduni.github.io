import { useReducedMotion } from "@/hooks/useReducedMotion";

const phases = [
  {
    name: "Computer vision",
    caption: "Finding structure in what a camera sees.",
    label: "Perception",
  },
  {
    name: "AI agents",
    caption: "A question, the right tools, a grounded answer.",
    label: "Reasoning",
  },
  {
    name: "Machine learning",
    caption: "From training data to evaluated models.",
    label: "Learning",
  },
  {
    name: "Product engineering",
    caption: "Bringing the model into someone’s workflow.",
    label: "Interaction",
  },
];
const ink = "var(--color-ink-strong)",
  blue = "var(--color-sky-deep)",
  pink = "var(--color-pink-deep)";
function Foundation() {
  return (
    <g className="scene-piece">
      <path d="M48 228 252 138 444 229 237 330Z" fill="#e6e0d8" opacity=".5" />
      <path
        d="M48 213 252 123 444 214 237 315Z"
        fill="#fcfbf8"
        stroke="#d0c8bd"
      />
      <path
        d="M48 213v12l189 101v-11M237 326l207-100v-12"
        fill="none"
        stroke="#d0c8bd"
      />
      {[0, 1, 2, 3, 4].map((i) => (
        <path
          key={i}
          d={`M${80 + i * 31} ${199 - i * 14}l190 96M${79 + i * 33} ${230 + i * 17}l205-94`}
          stroke="#e6e0d8"
          fill="none"
        />
      ))}
    </g>
  );
}
function Vision() {
  return (
    <>
      <Foundation />
      <g className="scene-piece">
        <path
          d="M85 192 250 117 405 191 240 270Z"
          fill="#e4f2fc"
          stroke="#9fd3f2"
        />
        <path
          d="m85 192 155 78v-17L85 175Zm155 61 165-79v17l-165 79"
          fill="#9fd3f2"
          opacity=".25"
        />
        <path
          d="m190 222 143-69m-77 96L123 182"
          stroke="#fcfbf8"
          strokeWidth="18"
        />
        <path
          d="m190 222 143-69m-77 96L123 182"
          stroke="#9fd3f2"
          strokeDasharray="4 6"
        />
      </g>
      <g className="scene-piece" stroke={ink} strokeWidth="1.4">
        <path d="m279 125 41-19 33 16-41 20Z" fill="#fcfbf8" />
        <path d="M279 125v40l33 17v-40m0 40 41-20v-40" fill="#f7f4ee" />
        <path d="m121 152 49-23 37 18-49 24Z" fill="#fcfbf8" />
        <path d="M121 152v30l37 19v-30m0 30 49-24v-30" fill="#fcfbf8" />
      </g>
      <g className="scene-piece">
        <path d="M243 84 182 224 344 169Z" fill="#f5bfd0" opacity=".36" />
        <rect
          x="231"
          y="73"
          width="30"
          height="16"
          rx="4"
          fill={ink}
          transform="rotate(18 243 81)"
        />
        <path d="M245 91v26" stroke={ink} strokeWidth="2" />
        <g fill={ink}>
          <circle cx="211" cy="199" r="4" />
          <path d="M211 206v13m-5-9h10" stroke={ink} strokeWidth="3" />
        </g>
        <path
          className="scene-trace"
          d="M198 196v-6h8m10 0h8v6m0 21v7h-8m-10 0h-8v-7"
          fill="none"
          stroke={blue}
          strokeWidth="1.6"
        />
        <rect
          x="262"
          y="176"
          width="24"
          height="11"
          rx="3"
          fill="#fcfbf8"
          stroke={ink}
          transform="rotate(-25 274 181)"
        />
        <path
          d="M256 169h8m-8 0v8m37-8h-8m8 0v8m-37 17v-8m0 8h8m29 0h-8m8 0v-8"
          stroke={blue}
          fill="none"
        />
        <text x="184" y="180" fill={blue} fontSize="10">
          person
        </text>
        <text x="272" y="159" fill={blue} fontSize="10">
          vehicle
        </text>
      </g>
    </>
  );
}
function Agent() {
  return (
    <>
      <Foundation />
      <g className="scene-piece">
        <path
          d="M85 183 245 109 393 180 235 256Z"
          fill="#fbe7ee"
          stroke="#f5bfd0"
        />
        <path
          className="scene-trace"
          d="M128 183 231 135 350 182 239 234 128 183m103-48 8 99m-111-51 222-1"
          fill="none"
          stroke={pink}
          strokeWidth="1.5"
          strokeDasharray="5 5"
        />
        {[
          [128, 183],
          [231, 135],
          [350, 182],
          [239, 234],
        ].map(([x, y], i) => (
          <g key={i}>
            <path
              d={`M${x - 24} ${y}l24-12 24 12-24 12Z`}
              fill={i === 2 ? "#9fd3f2" : "#fcfbf8"}
              stroke={i === 2 ? blue : pink}
            />
            <path
              d={`M${x - 24} ${y}v8l24 12 24-12v-8`}
              fill="none"
              stroke={pink}
            />
          </g>
        ))}
      </g>
      <g className="scene-piece">
        <rect
          x="143"
          y="58"
          width="212"
          height="46"
          rx="6"
          fill="#fcfbf8"
          stroke="#d0c8bd"
        />
        <circle cx="164" cy="81" r="6" fill="#f5bfd0" />
        <text x="183" y="85" fill={ink} fontSize="12">
          Ask. Find. Understand.
        </text>
        <path
          className="scene-trace"
          d="M249 104v11h-18v8"
          fill="none"
          stroke={pink}
          strokeDasharray="3 4"
        />
      </g>
      <g className="scene-piece">
        <path
          className="scene-trace"
          d="M350 194v21"
          fill="none"
          stroke={blue}
          strokeDasharray="3 4"
        />
        <circle cx="350" cy="215" r="2.5" fill={blue} />
        <rect
          x="276"
          y="215"
          width="145"
          height="58"
          rx="5"
          fill="#fcfbf8"
          stroke="#9fd3f2"
        />
        <text x="288" y="235" fill={blue} fontSize="9">
          ANSWER + EVIDENCE
        </text>
        <path d="M288 248h114m-114 10h76" stroke="#d0c8bd" strokeWidth="3" />
      </g>
    </>
  );
}
function Learning() {
  return (
    <>
      <Foundation />
      {[0, 1, 2].map((layer) => (
        <g className="scene-piece" key={layer}>
          <path
            d={`M113 ${226 - layer * 43} 245 ${165 - layer * 43} 377 ${228 - layer * 43} 244 ${289 - layer * 43}Z`}
            fill={layer === 2 ? "#e4f2fc" : "#fcfbf8"}
            fillOpacity=".88"
            stroke={layer === 2 ? "#9fd3f2" : "#d0c8bd"}
          />
          {[0, 1, 2].map((i) => (
            <g key={i}>
              <path
                d={`M${185 + i * 30} ${220 - layer * 43 - i * 14}l75 36`}
                stroke={blue}
                opacity=".25"
              />
              <circle
                cx={185 + i * 30}
                cy={220 - layer * 43 - i * 14}
                r="5"
                fill={layer === 1 ? "#f5bfd0" : "#9fd3f2"}
                stroke={layer === 1 ? pink : blue}
              />
              <circle
                cx={260 + i * 30}
                cy={256 - layer * 43 - i * 14}
                r="5"
                fill="#fcfbf8"
                stroke={blue}
              />
            </g>
          ))}
        </g>
      ))}
      <g className="scene-piece">
        <path
          className="scene-trace"
          d="M92 201C43 167 70 93 153 98m204 134c61-10 83-49 50-84"
          fill="none"
          stroke={pink}
          strokeWidth="1.5"
          strokeDasharray="5 5"
        />
        <text x="60" y="84" fill={pink} fontSize="10">
          refine
        </text>
        <text x="346" y="130" fill={blue} fontSize="10">
          evaluate
        </text>
      </g>
    </>
  );
}
function Interface() {
  return (
    <>
      <Foundation />
      <g className="scene-piece">
        <rect
          x="88"
          y="70"
          width="304"
          height="204"
          rx="9"
          fill="#fcfbf8"
          stroke="#d0c8bd"
        />
        <path d="M88 102h304m-250 0v172" stroke="#e6e0d8" />
        <circle cx="104" cy="86" r="3" fill="#f5bfd0" />
        <circle cx="116" cy="86" r="3" fill="#9fd3f2" />
        <text x="156" y="90" fill={ink} fontSize="10">
          Workspace
        </text>
        <rect x="98" y="117" width="33" height="19" rx="3" fill="#e4f2fc" />
        <path
          d="M105 126h19m-19 29h19m-19 24h19m-19 24h13"
          stroke="#9fa8ad"
          strokeWidth="2"
        />
        <text x="162" y="132" fontSize="12" fill={ink}>
          Activity overview
        </text>
        <text x="162" y="150" fontSize="8" fill={blue}>
          Recorded events · this week
        </text>
        <path d="M164 177h205m-205 25h205m-205 25h205" stroke="#e6e0d8" />
        {[33, 52, 42, 68, 49].map((value, i) => (
          <rect
            key={i}
            x={177 + i * 38}
            y={232 - value}
            width="23"
            height={value}
            rx="3"
            fill={i === 3 ? "#f5bfd0" : "#9fd3f2"}
          />
        ))}
        <path d="M164 232h205" stroke="#d0c8bd" />
        <text x="178" y="247" fontSize="7.5" fill="#5b5a63">
          Mon
        </text>
        <text x="330" y="247" fontSize="7.5" fill="#5b5a63">
          Fri
        </text>
      </g>
      <g className="scene-piece">
        <rect
          x="245"
          y="260"
          width="173"
          height="42"
          rx="6"
          fill="#fcfbf8"
          stroke="#9fd3f2"
        />
        <circle cx="265" cy="281" r="10" fill="#e4f2fc" />
        <path
          d="m260 281 3 3 6-7"
          fill="none"
          stroke={blue}
          strokeWidth="1.5"
        />
        <text x="283" y="284" fontSize="10" fill={blue}>
          Ready for review
        </text>
      </g>
    </>
  );
}
const scenes = [Vision, Agent, Learning, Interface];

/*
  All four chapters, stacked in one frame, with only the active one showing. How far its
  picture has assembled, and its slow drift inside .scene-drift, follow the scroll position
  in the "What I do" section.
*/
export function CapabilityScene({ active }: { active: number }) {
  const reduced = useReducedMotion();
  return (
    <div
      className="capability-scene"
      onPointerMove={(event) => {
        if (reduced || event.pointerType !== "mouse") return;
        const r = event.currentTarget.getBoundingClientRect();
        event.currentTarget.style.setProperty(
          "--scene-x",
          `${((event.clientY - r.top) / r.height - 0.5) * -5}deg`,
        );
        event.currentTarget.style.setProperty(
          "--scene-y",
          `${((event.clientX - r.left) / r.width - 0.5) * 7}deg`,
        );
      }}
      onPointerLeave={(event) => {
        event.currentTarget.style.setProperty("--scene-x", "0deg");
        event.currentTarget.style.setProperty("--scene-y", "0deg");
      }}
    >
      <div className="scene-ambient" aria-hidden="true" />
      {phases.map((phase, index) => {
        const Scene = scenes[index];
        return (
          <div
            key={phase.label}
            className={`cap-stage ${index === active ? "is-active" : ""}`}
            aria-hidden={index !== active}
          >
            <div className="scene-heading">
              <span>{phase.label}</span>
              <span>0{index + 1} / 04</span>
            </div>
            <svg
              className="scene-art"
              viewBox="0 0 480 360"
              role="img"
              aria-label={phase.caption}
            >
              <g className="scene-drift">
                <Scene />
              </g>
            </svg>
            <p className="scene-caption">{phase.caption}</p>
          </div>
        );
      })}
    </div>
  );
}
