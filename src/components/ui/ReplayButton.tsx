import { ArrowCounterClockwise } from "@phosphor-icons/react";

// A small, keyboard- and touch-friendly control to replay a demo on purpose.
export function ReplayButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="-m-2 inline-flex items-center gap-1.5 p-2 font-mono text-[11.5px] text-ink-mute transition-colors hover:text-ink-strong"
    >
      <ArrowCounterClockwise size={13} weight="bold" aria-hidden="true" />
      Replay
    </button>
  );
}
