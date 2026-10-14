import { useRef, type ReactNode } from "react";
import { building, type Product, type ProductPart } from "@/content";
import { useCardStack } from "@/hooks/useCardStack";
import { useCardRow } from "@/hooks/useCardRow";
import { useStoryArrangement } from "@/hooks/useStoryArrangement";
import { ArrowText } from "@/components/ui/LinkArrow";
import {
  VisionCard,
  YoruCard,
  buildVision,
  buildYoru,
} from "@/components/MihawkCards";
import { MatchDemo, buildBooking } from "@/components/MatchDemo";
import { TranscriptDemo, buildTranscript } from "@/components/TranscriptDemo";
import { Words } from "@/components/ui/Words";
import { gsap, useGSAP } from "@/lib/gsap";
import { layoutTop } from "@/lib/scrollGeometry";
import { useReducedMotion } from "@/hooks/useReducedMotion";

// A Kehsun card: its heading, then its demonstration.
function DemoCard({
  part,
  children,
}: {
  part: ProductPart;
  children: ReactNode;
}) {
  return (
    <article className="stack-card product-card demo-card">
      <div className="product-card-content">
        <div className="product-demo-heading product-card-head">
          <h3>{part.name}</h3>
          <p>{part.text}</p>
        </div>
        <div className="product-card-visual">{children}</div>
      </div>
    </article>
  );
}

/*
  Each product is a card stack under its introduction, which stays on screen: MihawkAI's
  Vision card, then Yoru rising over it; Kehsun's booking, then the practitioner's session
  note. The second card covers the first completely. Each card's demonstration is played by
  the scroll once the card has parked.
  Where two cards stay readable side by side, each product shows a row instead,
  and both demonstrations play together (useCardRow).
*/
function ProductSegment({
  product,
  first,
}: {
  product: Product;
  first: boolean;
}) {
  const stack = useRef<HTMLDivElement>(null);
  const mihawk = product.id === "mihawk";
  const reduced = useReducedMotion();
  const arranged = useStoryArrangement(stack);
  const build = (card: HTMLElement, index: number) =>
    mihawk
      ? (index === 0 ? buildVision : buildYoru)(card)
      : (index === 0 ? buildBooking : buildTranscript)(
          card.querySelector<HTMLElement>(".product-card-visual > div")!,
        );
  useCardStack(stack, {
    // The second card parks exactly over the first and covers it completely.
    timing: { allow: 0.06, play: 0.8, read: 0.16, lastRead: 0.02 },
    build,
    arranged,
    adaptive: true,
  });
  useCardRow(stack, {
    // Both demonstrations together, then a quarter of a screen to read the completed row.
    timing: { allow: 0.06, play: 0.9, read: 0.25 },
    build,
    arranged,
  });
  useGSAP(() => {
    if (reduced) return;
    const root = stack.current!;
    const held = () => root.dataset.stack === "on" && root.dataset.intro !== "flow";
    const copy = root.querySelector<HTMLElement>(".product-summary")!;
    const words = copy.querySelectorAll(".word");
    gsap.set(words, { opacity: 0.22 });
    gsap.to(words, {
      opacity: 1, duration: 0.1, stagger: 0.1, ease: "none",
      scrollTrigger: {
        trigger: root,
        start: () => held() ? layoutTop(root) - innerHeight * 0.45 : layoutTop(copy) - innerHeight * 0.85,
        end: () => held()
          ? layoutTop(root) + parseFloat(root.style.getPropertyValue("--stack-lead"))
          : layoutTop(copy) + copy.offsetHeight - innerHeight * 0.6,
        scrub: true,
        invalidateOnRefresh: true,
      },
    });
  }, { scope: stack, dependencies: [reduced], revertOnUpdate: true });
  const [one, two] = product.parts;
  return (
    <section
      id={first ? "building" : product.id}
      data-segment
      aria-labelledby={`${product.id}-title`}
      className={`stack-section product-segment product-${product.id}`}
    >
      {/* The stack sits inside the wrap, so header and cards share its gutters. */}
      <div className="wrap">
        <div ref={stack} className="stack pair-stack">
          <div className="stack-intro-track">
            <div className="stack-intro product-intro" data-story-intro>
              <div>
                <p className="kind">{product.kind}</p>
                <h2 id={`${product.id}-title`} className="section-title">
                  <a
                    className="product-title-link"
                    href={product.href}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <ArrowText>{product.name}</ArrowText>
                  </a>
                </h2>
              </div>
              <div className="product-summary">
                <p><Words text={product.text} /></p>
              </div>
            </div>
          </div>
          <div className="stack-cards">
            {mihawk ? (
              <>
                <div className="stack-lane"><VisionCard part={one} /></div>
                <div className="stack-lane"><YoruCard part={two} /></div>
              </>
            ) : (
              <>
                <div className="stack-lane">
                  <DemoCard part={one}>
                    <MatchDemo />
                  </DemoCard>
                </div>
                <div className="stack-lane">
                  <DemoCard part={two}>
                    <TranscriptDemo />
                  </DemoCard>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

export function Building() {
  return (
    <>
      {building.products.map((product, i) => (
        <ProductSegment product={product} first={i === 0} key={product.id} />
      ))}
    </>
  );
}
