/**
 * Holds one booking between the two tabs.
 *
 * The Rooms Booking app hands a payload to `bridge.js`, which passes it here.
 * We stash it, open Pathik's Add Guest page, and hand it to `fill.js` when that
 * page asks for it. Storage is session-scoped and the payload is one-shot, so a
 * booking is never filled into a page twice.
 */

const PATHIK_ADD_URL = "https://pathik.guru/dashboard/add";
const KEY = "pendingBooking";

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "PATHIK_FILL") {
    chrome.storage.session
      .set({ [KEY]: message.payload })
      .then(() => chrome.tabs.create({ url: PATHIK_ADD_URL }))
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: String(error) }));
    return true; // response is async
  }

  if (message?.type === "PATHIK_TAKE") {
    chrome.storage.session
      .get(KEY)
      .then((stored) => {
        sendResponse({ payload: stored[KEY] ?? null });
        return chrome.storage.session.remove(KEY);
      })
      .catch(() => sendResponse({ payload: null }));
    return true;
  }

  return false;
});
