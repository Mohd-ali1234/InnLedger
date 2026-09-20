/**
 * Runs on Pathik's Add Guest page. Collects the pending booking and hands it to
 * `page-fill.js`.
 *
 * The actual filling has to happen in the page's own JavaScript context, since
 * the country/state dropdowns are bootstrap-selectpickers that only redraw when
 * the page's jQuery is told to refresh them — a content script's isolated
 * `window.jQuery` is a different object and would not reach them.
 */

const PAYLOAD_ATTR = "data-pathik-payload";

function runInPage(payload) {
  document.documentElement.setAttribute(PAYLOAD_ATTR, JSON.stringify(payload));

  const script = document.createElement("script");
  script.src = chrome.runtime.getURL("page-fill.js");
  script.onload = () => script.remove();
  (document.head || document.documentElement).appendChild(script);
}

/** Pathik populates the state dropdown on ready; wait for the form to settle. */
function whenFormReady(callback, waited = 0) {
  const form = document.querySelector("#add_customer, form[name='add_customer']");
  if (form) {
    setTimeout(callback, 300);
    return;
  }
  if (waited >= 10000) return;
  setTimeout(() => whenFormReady(callback, waited + 200), 200);
}

chrome.runtime.sendMessage({ type: "PATHIK_TAKE" }, (response) => {
  const payload = response?.payload;
  if (!payload?.fields?.length) return;
  whenFormReady(() => runInPage(payload));
});
