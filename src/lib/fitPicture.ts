/*
  A picture that may shrink so its card fits a scroll story: MihawkAI's camera view, marked
  [data-shrinkable]. It keeps its proportions and stays centred. It shrinks only where its space
  is wider than 28em, wider than any phone's (a 430px phone gives it about 355px), so a phone's
  layout is never affected, and never below 20em, about what a 375px phone shows, so it stays as
  legible as there. A card that would need a smaller picture falls back to the plain layout as
  before. Only a card that reads top to bottom (a flex column) gains height this way.

  Measured without feedback: the natural size comes from the picture's container, never from the
  picture itself, so a width written by an earlier plan does not change the next one. A picture at
  its natural size is measured exactly as any other card (its content's height), so nothing that
  never shrinks plans any differently. In a card that does not read top to bottom, a width written
  earlier is removed before measuring (release, in the prepare phase).
*/
const ABOVE = 28;
const MIN_WIDTH = 20;

export type Fit = {
  // Content height to plan with, including the +2 every card is measured with.
  height: number;
  // Maximum picture width to write, or null for its natural size.
  width: number | null;
};

export function fitPicture(content: HTMLElement, picture: HTMLElement | null, budget: number, em: number): Fit {
  const height = content.offsetHeight + 2;
  if (!picture || getComputedStyle(content).display !== "flex") return { height, width: null };
  const drawn = picture.getBoundingClientRect();
  const full = picture.parentElement!.clientWidth;
  if (!drawn.width || !drawn.height || full <= ABOVE * em) return { height, width: null };
  const ratio = drawn.width / drawn.height;
  const surrounding = height - drawn.height;
  const natural = full / ratio;
  // Whole pixels, so the rounded-up height below never exceeds the budget.
  const room = Math.floor(budget) - surrounding;
  const width = Math.min(full, Math.max(MIN_WIDTH * em, room * ratio));
  if (natural <= room || width >= full)
    return { height: picture.style.maxWidth ? Math.ceil(surrounding + natural) : height, width: null };
  return { height: Math.ceil(surrounding + width / ratio), width: Math.floor(width) };
}

// Before measuring: a width written while the card read top to bottom no longer applies.
export function release(content: HTMLElement, picture: HTMLElement | null) {
  if (picture?.style.maxWidth && getComputedStyle(content).display !== "flex") picture.style.removeProperty("max-width");
}
