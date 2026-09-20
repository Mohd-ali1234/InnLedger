/**
 * Injected into Pathik's Add Guest page, in the page's own JavaScript context.
 *
 * Writes the booking into the form and stops. It never calls submit(), never
 * clicks the Submit button, and never touches the document upload — the front
 * desk reviews everything and submits by hand.
 *
 * Mirrors the console-paste script produced by
 * frontend/src/utils/pathik.ts (buildAutofillScript); keep the two in step.
 */

(function () {
  var PAYLOAD_ATTR = "data-pathik-payload";

  var raw = document.documentElement.getAttribute(PAYLOAD_ATTR);
  if (!raw) return;
  document.documentElement.removeAttribute(PAYLOAD_ATTR);

  var payload;
  try {
    payload = JSON.parse(raw);
  } catch (e) {
    return;
  }

  var form =
    document.querySelector("#add_customer") || document.querySelector("form[name='add_customer']");
  if (!form) return;

  var jq = window.jQuery;
  var filled = [];
  var skipped = [];

  function fire(el) {
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    if (jq) jq(el).trigger("change");
  }

  function setText(name, value) {
    var el = form.querySelector('[name="' + name + '"]');
    if (!el) {
      skipped.push(name + " (not on page)");
      return;
    }
    el.value = value;
    fire(el);
    filled.push(name);
  }

  function setSelect(name, text) {
    var el = form.querySelector('select[name="' + name + '"]');
    if (!el) {
      skipped.push(name + " (not on page)");
      return false;
    }
    var want = String(text).trim().toLowerCase();
    for (var i = 0; i < el.options.length; i++) {
      if (el.options[i].text.trim().toLowerCase() === want) {
        el.value = el.options[i].value;
        fire(el);
        if (jq) {
          try {
            jq(el).selectpicker("refresh");
          } catch (e) {}
        }
        filled.push(name);
        return true;
      }
    }
    skipped.push(name + ' (no option matching "' + text + '")');
    return false;
  }

  function highlight(name) {
    var el = form.querySelector('[name="' + name + '"]');
    if (!el) return;
    var target = el.tagName === "SELECT" ? el.parentNode : el;
    target.style.transition = "box-shadow .4s";
    target.style.boxShadow = "0 0 0 3px rgba(52,191,163,.45)";
    setTimeout(function () {
      target.style.boxShadow = "";
    }, 2500);
  }

  var stateValue = null;
  payload.fields.forEach(function (field) {
    // Country repopulates the state list over AJAX, so state waits its turn.
    if (field.name === "state") {
      stateValue = field.value;
      return;
    }
    if (field.kind === "select") setSelect(field.name, field.value);
    else setText(field.name, field.value);
    highlight(field.name);
  });

  function banner() {
    var bar = document.createElement("div");
    bar.style.cssText =
      "position:fixed;z-index:99999;left:50%;bottom:24px;transform:translateX(-50%);" +
      "max-width:92vw;padding:14px 20px;border-radius:10px;background:#1e293b;color:#fff;" +
      "font:14px/1.55 Poppins,Roboto,sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.3)";

    var title = document.createElement("div");
    title.style.cssText = "font-weight:600;margin-bottom:2px";
    title.textContent =
      "Filled " +
      filled.length +
      " field" +
      (filled.length === 1 ? "" : "s") +
      (payload.guestName ? " for " + payload.guestName : "") +
      " — nothing submitted.";
    bar.appendChild(title);

    var note = document.createElement("div");
    note.style.cssText = "opacity:.85;font-size:13px";
    note.textContent =
      "Add date of birth, document details, check-in/out times, then click Submit yourself." +
      (skipped.length ? " Skipped: " + skipped.join(", ") + "." : "");
    bar.appendChild(note);

    var close = document.createElement("button");
    close.textContent = "Dismiss";
    close.style.cssText =
      "margin-left:16px;padding:4px 10px;border:0;border-radius:6px;cursor:pointer;" +
      "background:rgba(255,255,255,.15);color:#fff;font:13px Poppins,sans-serif";
    close.onclick = function () {
      bar.remove();
    };
    title.appendChild(close);

    document.body.appendChild(bar);
    setTimeout(function () {
      bar.remove();
    }, 15000);
  }

  if (stateValue) {
    var waited = 0;
    var timer = setInterval(function () {
      var stateEl = form.querySelector("select[name='state']");
      waited += 250;
      if (stateEl && stateEl.options.length > 1) {
        clearInterval(timer);
        setSelect("state", stateValue);
        highlight("state");
        banner();
      } else if (waited >= 8000) {
        clearInterval(timer);
        skipped.push("state (dropdown did not load — pick it by hand)");
        banner();
      }
    }, 250);
  } else {
    banner();
  }
})();
