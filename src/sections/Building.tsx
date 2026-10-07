import { useRef, type ReactNode } from "react";
import { building, type Product, type ProductPart } from "@/content";
import { useScrollReveal } from "@/hooks/useScrollReveal";
import { layoutTop, revealEnd } from "@/lib/scrollGeometry";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { gsap, useGSAP } from "@/lib/gsap";
import { ArrowText } from "@/components/ui/LinkArrow";
import { AgentDemo } from "@/components/AgentDemo";
import { MatchDemo } from "@/components/MatchDemo";
import { PlateDemo } from "@/components/PlateDemo";
import { TranscriptDemo } from "@/components/TranscriptDemo";

const DEMOS: Record<ProductPart["demo"], () => ReactNode> = {
  plate: () => <PlateDemo />,
  agent: () => <AgentDemo />,
  match: () => <MatchDemo />,
  transcript: () => <TranscriptDemo />,
};
function ProductSegment({
  product,
  first,
}: {
  product: Product;
  first: boolean;
}) {
  const root = useRef<HTMLElement>(null);
  const reduced = useReducedMotion();
  useScrollReveal(root);
  // The demos rise into place with the scroll. Side by side they move as one card; stacked on
  // a narrow screen, each one arrives on its own as it reaches the screen. Positions are read
  // from a still slot around each moving card, so the rise ends exactly where intended.
  useGSAP(
    () => {
      if (reduced) return;
      const rise = (slot: HTMLElement) =>
        gsap.fromTo(
          slot.firstElementChild,
          { y: 64, scale: 0.96 },
          {
            y: 0,
            scale: 1,
            ease: "none",
            scrollTrigger: {
              trigger: slot,
              start: "top bottom",
              end: () =>
                revealEnd(root.current!, layoutTop(slot) - innerHeight * 0.7),
              invalidateOnRefresh: true,
              scrub: 0.4,
            },
          },
        );
      const media = gsap.matchMedia();
      media.add("(min-width: 768px)", () => {
        rise(root.current!.querySelector(".product-demos-slot")!);
      });
      media.add("(max-width: 767px)", () => {
        root
          .current!.querySelectorAll<HTMLElement>(".product-demo-slot")
          .forEach(rise);
      });
      return () => media.revert();
    },
    { scope: root, dependencies: [reduced], revertOnUpdate: true },
  );
  return (
    <section
      ref={root}
      id={first ? "building" : product.id}
      data-segment
      aria-labelledby={`${product.id}-title`}
      className={`segment product-segment product-${product.id}`}
    >
      <div className="wrap">
        <div className="product-intro">
          <div data-enter="1">
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
          <div data-enter="2" className="product-summary">
            <p>{product.text}</p>
          </div>
        </div>
        <div className="product-demos-slot">
          <div className="product-demos">
            {product.parts.map((part, i) => (
              <div
                className="product-demo-slot"
                key={part.name}
                data-gravity-reading={i > 0 ? "" : undefined}
              >
                <div className={`product-demo-pane pane-${i}`}>
                  <div className="product-demo-heading">
                    <h3>{part.name}</h3>
                    <p>{part.text}</p>
                  </div>
                  {DEMOS[part.demo]()}
                </div>
              </div>
            ))}
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
