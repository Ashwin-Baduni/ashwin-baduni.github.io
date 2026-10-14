import type { HTMLAttributes, PointerEvent } from "react";
import { cn } from "@/lib/utils";

const onPointerMove = (e: PointerEvent<HTMLElement>) => {
  const r = e.currentTarget.getBoundingClientRect();
  e.currentTarget.style.setProperty("--mx", `${e.clientX - r.left}px`);
  e.currentTarget.style.setProperty("--my", `${e.clientY - r.top}px`);
};

// Card whose soft accent glow follows the pointer (see .spot-card in index.css).
export function SpotlightCard({ className, children, ...rest }: HTMLAttributes<HTMLElement>) {
  return (
    <article onPointerMove={onPointerMove} className={cn("spot-card", className)} {...rest}>
      {children}
    </article>
  );
}
