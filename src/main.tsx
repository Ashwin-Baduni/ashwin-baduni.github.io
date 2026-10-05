import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";

// Any reload, normal or hard, opens at the top of the page rather than where the visitor was.
// The browser's own scroll memory is off, and a #section left in the address bar by an earlier
// click is cleared so the page does not jump to it. A fresh visit to a shared link such as
// /#experience still lands on that section.
if ("scrollRestoration" in history) history.scrollRestoration = "manual";
const navigation = performance.getEntriesByType("navigation")[0] as
  | PerformanceNavigationTiming
  | undefined;
if (navigation?.type === "reload") {
  if (location.hash) history.replaceState(null, "", location.pathname + location.search);
  window.scrollTo(0, 0);
  // Chrome keeps trying to reach the old #section while the page loads, so settle at the top
  // again once loading has finished, unless the visitor has already started scrolling.
  let moved = false;
  const stop = () => (moved = true);
  window.addEventListener("wheel", stop, { passive: true, once: true });
  window.addEventListener("touchstart", stop, { passive: true, once: true });
  window.addEventListener("keydown", stop, { once: true });
  const top = () => !moved && window.scrollTo({ top: 0, behavior: "instant" });
  window.addEventListener("load", () => requestAnimationFrame(top), { once: true });
  document.fonts.ready.then(() => requestAnimationFrame(top));
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
