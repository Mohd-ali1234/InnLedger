import { useCallback, useEffect, useState } from "react";
import type { Booking } from "@/types";
import { filledFields, type PathikField } from "@/utils/pathik";

/**
 * Talks to the "Rooms Booking → Pathik autofill" browser extension
 * (see /pathik-extension). The extension marks the page on load; without it
 * installed, the modal falls back to the copy-and-paste script.
 */

const BRIDGE_ATTR = "data-pathik-bridge";

export type SendState = "idle" | "sending" | "sent" | "failed";

function bridgeInstalled(): boolean {
  return document.documentElement.getAttribute(BRIDGE_ATTR) === "1";
}

export function usePathikBridge() {
  const [installed, setInstalled] = useState(bridgeInstalled);
  const [state, setState] = useState<SendState>("idle");

  // The content script runs before React, but re-check in case the extension
  // was enabled while this tab was already open.
  useEffect(() => {
    if (installed) return;
    const observer = new MutationObserver(() => {
      if (bridgeInstalled()) {
        setInstalled(true);
        observer.disconnect();
      }
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: [BRIDGE_ATTR],
    });
    return () => observer.disconnect();
  }, [installed]);

  const send = useCallback(
    (booking: Booking, fields: PathikField[]) => {
      if (!installed) return;
      setState("sending");

      const onAck = (event: MessageEvent) => {
        if (event.source !== window) return;
        const data = event.data;
        if (data?.source !== "pathik-bridge" || data?.type !== "PATHIK_FILL_ACK") return;
        window.removeEventListener("message", onAck);
        clearTimeout(timeout);
        setState(data.ok ? "sent" : "failed");
        setTimeout(() => setState("idle"), 4000);
      };

      const timeout = setTimeout(() => {
        window.removeEventListener("message", onAck);
        setState("failed");
        setTimeout(() => setState("idle"), 4000);
      }, 5000);

      window.addEventListener("message", onAck);
      window.postMessage(
        {
          source: "rooms-booking",
          type: "PATHIK_FILL",
          payload: {
            bookingId: booking.id,
            guestName: booking.guest_name,
            fields: filledFields(fields).map((f) => ({
              name: f.name,
              value: f.value,
              kind: f.kind,
            })),
          },
        },
        window.location.origin
      );
    },
    [installed]
  );

  return { installed, state, send };
}
