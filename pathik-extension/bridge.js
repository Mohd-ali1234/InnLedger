/**
 * Runs on the Rooms Booking app. Marks the page so the app can tell the
 * extension is installed, and forwards "fill this booking" requests to the
 * background worker.
 *
 * Only messages posted by the page itself, tagged `rooms-booking`, are relayed.
 */

const FLAG = "data-pathik-bridge";

function markInstalled() {
  document.documentElement?.setAttribute(FLAG, "1");
}

markInstalled();
document.addEventListener("DOMContentLoaded", markInstalled);

window.addEventListener("message", (event) => {
  if (event.source !== window) return;

  const message = event.data;
  if (!message || message.source !== "rooms-booking" || message.type !== "PATHIK_FILL") return;

  chrome.runtime.sendMessage({ type: "PATHIK_FILL", payload: message.payload }, (response) => {
    window.postMessage(
      {
        source: "pathik-bridge",
        type: "PATHIK_FILL_ACK",
        ok: Boolean(response?.ok),
      },
      window.location.origin
    );
  });
});
