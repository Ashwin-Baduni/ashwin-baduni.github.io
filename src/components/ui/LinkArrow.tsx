import type { ReactNode } from "react";
import { ArrowUpRight } from "@phosphor-icons/react";

/*
  The pink "opens elsewhere" arrow. It is sized and placed in em (see .link-arrow in index.css),
  so at any font size it sits on the text's centre line with the same small gap after the last
  letter. The icon's own built-in padding is accounted for there.
*/
export function LinkArrow() {
  return <ArrowUpRight className="link-arrow" weight="bold" aria-hidden="true" />;
}

// Link text followed by the arrow. The last word and the arrow never separate, so the arrow can
// not wrap onto a line of its own.
export function ArrowText({ children }: { children: ReactNode }) {
  if (typeof children !== "string") {
    return (
      <span className="arrow-text">
        <span className="whitespace-nowrap">
          <span className="link-underline">{children}</span>
          <LinkArrow />
        </span>
      </span>
    );
  }
  const split = children.lastIndexOf(" ");
  const head = split === -1 ? "" : children.slice(0, split + 1);
  const last = split === -1 ? children : children.slice(split + 1);
  return (
    <span className="arrow-text">
      {head && <span className="link-underline">{head}</span>}
      <span className="whitespace-nowrap">
        <span className="link-underline">{last}</span>
        <LinkArrow />
      </span>
    </span>
  );
}
