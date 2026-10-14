import { useLayoutEffect, useState, type RefObject } from "react";
import { flushSync } from "react-dom";
import { watchLayout } from "@/lib/storyLayout";

/*
  Which arrangement CSS has chosen: product "row", Skills "split", Projects "grid", or the
  default phone "stack". The container queries in index.css require readable columns. Space
  decides, never the device: the story's own width against a minimum card width in em, so a
  narrower parent or larger text can switch it as well as the window.
*/
export type Arrangement = "stack" | "row" | "split" | "grid";

export function arrangementOf(root: HTMLElement): Arrangement {
  const deck = root.querySelector<HTMLElement>(".stack-cards")!;
  const value = getComputedStyle(deck).getPropertyValue("--story-arrangement").trim();
  return value === "row" || value === "split" || value === "grid" ? value : "stack";
}

/*
  A count of arrangement changes, for the controllers' dependencies. Each controller reads the
  arrangement itself when it is built and takes the story only if the arrangement is its own
  (useCardStack for "stack", useSkillSequence for "split", useCardRow for "row",
  useProjectGrid for "grid"), so exactly
  one owns it. When the arrangement
  changes, the change is found at the start of the next layout pass, before any story is measured,
  and React replaces the controller synchronously: the previous one is reverted completely, then
  the other is built and joins that same pass.
  Without a scope (a story that is always a stack) it returns undefined and watches nothing.
*/
export function useStoryArrangement(scope: RefObject<HTMLElement | null> | null) {
  const [changes, setChanges] = useState(0);
  useLayoutEffect(() => {
    if (!scope) return;
    const root = scope.current!;
    let current = arrangementOf(root);
    return watchLayout(() => {
      const next = arrangementOf(root);
      if (next === current) return false;
      current = next;
      // For the rest of this pass only (index.css): the incoming controller has no lanes yet.
      root.dataset.arranging = "";
      queueMicrotask(() => delete root.dataset.arranging);
      flushSync(() => setChanges((count) => count + 1));
      return true;
    });
  }, [scope]);
  return scope ? changes : undefined;
}
