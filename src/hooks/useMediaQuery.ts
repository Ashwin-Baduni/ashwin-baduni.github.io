import { useSyncExternalStore } from "react";

// Whether a CSS media query matches, kept current as the window or settings change.
export function useMediaQuery(query: string) {
  return useSyncExternalStore(
    (callback) => {
      const list = matchMedia(query);
      list.addEventListener("change", callback);
      return () => list.removeEventListener("change", callback);
    },
    () => matchMedia(query).matches,
    () => false,
  );
}
