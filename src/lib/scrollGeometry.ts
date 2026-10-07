// Layout coordinates ignore the transforms used by scroll-linked reveals.
export function layoutTop(element: HTMLElement): number {
  let top = 0;
  let current: HTMLElement | null = element;
  while (current) {
    top += current.offsetTop;
    current = current.offsetParent as HTMLElement | null;
  }
  return top;
}

// A section that fits must finish revealing at its entrance. A taller section
// finishes by its last reading position, where its bottom meets the viewport.
export function revealEnd(section: HTMLElement, naturalEnd: number): number {
  return Math.max(
    0,
    Math.min(
      naturalEnd,
      layoutTop(section) + Math.max(0, section.offsetHeight - innerHeight),
    ),
  );
}
