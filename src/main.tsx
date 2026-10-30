import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";

// Capture the PWA install prompt as early as possible — Chrome can fire
// beforeinstallprompt before React mounts, and swallowing it here means the
// in-game Install button always has a prompt ready.
type InstallPromptEvent = Event & { prompt?: () => Promise<void> };
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  (window as unknown as { __wwrInstall?: InstallPromptEvent | null }).__wwrInstall = e as InstallPromptEvent;
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

// Offline install support. Relative URL keeps it working on GitHub Pages subpaths.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").then((reg) => {
      // v1.0: tell the player a fresh build is waiting in the background
      reg.addEventListener("updatefound", () => {
        const incoming = reg.installing;
        if (!incoming) return;
        incoming.addEventListener("statechange", () => {
          if (incoming.state === "installed" && navigator.serviceWorker.controller) {
            window.dispatchEvent(new CustomEvent("wwr-update-ready"));
          }
        });
      });
    }).catch(() => {
      /* offline mode unavailable — the game still runs */
    });
  });
}
