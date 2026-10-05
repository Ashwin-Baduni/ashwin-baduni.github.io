import { useRef, type ReactNode } from "react";
import { building, type Product, type ProductPart } from "@/content";
import { useEntrance } from "@/hooks/useEntrance";
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
  useEntrance(root);
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
        <div className="product-demos" data-enter="3">
          {product.parts.map((part, i) => (
            <div className={`product-demo-pane pane-${i}`} key={part.name}>
              <div className="product-demo-heading">
                <h3>{part.name}</h3>
                <p>{part.text}</p>
              </div>
              {DEMOS[part.demo]()}
            </div>
          ))}
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
