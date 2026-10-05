import { useRef, type ReactNode } from "react";
import { gsap, useGSAP } from "@/lib/gsap";
import { cn } from "@/lib/utils";
import { useReducedMotion } from "@/hooks/useReducedMotion";

type Props = {
  href: string;
  children: ReactNode;
  icon?: ReactNode;
  variant?: "primary" | "secondary";
  className?: string;
  download?: boolean;
  external?: boolean;
};

// A link styled as a button that leans toward the pointer, with its icon in its own small tile.
export function MagneticButton({ href, children, icon, variant = "secondary", className, download, external }: Props) {
  const ref = useRef<HTMLAnchorElement>(null);
  const reduce = useReducedMotion();

  useGSAP(
    () => {
      const el = ref.current;
      if (!el || reduce || !window.matchMedia("(hover: hover)").matches) return;
      const xTo = gsap.quickTo(el, "x", { duration: 0.5, ease: "power3.out" });
      const yTo = gsap.quickTo(el, "y", { duration: 0.5, ease: "power3.out" });
      const move = (e: PointerEvent) => {
        const r = el.getBoundingClientRect();
        xTo((e.clientX - r.left - r.width / 2) * 0.22);
        yTo((e.clientY - r.top - r.height / 2) * 0.32);
      };
      const leave = () => gsap.to(el, { x: 0, y: 0, duration: 0.9, ease: "elastic.out(1, 0.45)" });
      el.addEventListener("pointermove", move);
      el.addEventListener("pointerleave", leave);
      return () => {
        el.removeEventListener("pointermove", move);
        el.removeEventListener("pointerleave", leave);
      };
    },
    { dependencies: [reduce] },
  );

  return (
    <a
      ref={ref}
      href={href}
      download={download || undefined}
      target={external ? "_blank" : undefined}
      rel={external ? "noreferrer" : undefined}
      className={cn(
        "group inline-flex items-center gap-2.5 rounded-[10px] border py-2.5 pr-3 pl-4 text-sm font-semibold whitespace-nowrap transition-colors active:scale-[0.98]",
        variant === "primary"
          ? "border-ink-strong bg-ink-strong text-paper hover:bg-ink"
          : "border-line-strong bg-card text-ink-strong hover:border-ink-faint",
        className,
      )}
    >
      {children}
      {icon && (
        <span
          aria-hidden="true"
          className={cn(
            "grid size-7 place-items-center rounded-[7px] transition-transform duration-300 ease-(--ease-out-expo) group-hover:translate-x-0.5 group-hover:-translate-y-px",
            variant === "primary" ? "bg-white/12 text-sky" : "bg-sky-wash text-sky-deep",
          )}
        >
          {icon}
        </span>
      )}
    </a>
  );
}
