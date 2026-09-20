/**
 * Maps a booking onto the fields of Pathik's "Add Guest" form
 * (https://pathik.guru/dashboard/add) so the front desk can re-enter it there
 * without retyping.
 *
 * Pathik is a different origin, so this app cannot write into their form from
 * our tab — the browser blocks it. Instead we produce (a) the mapped values to
 * copy field by field and (b) a self-contained script the user pastes into the
 * console on the Pathik page, which fills the inputs and stops. Nothing here
 * ever submits the Pathik form.
 */

import { format, parseISO } from "date-fns";
import type { Booking } from "@/types";

/** Pathik renders dates through a datepicker whose format we can't read cross-origin. */
export const PATHIK_DATE_FORMATS = [
  { value: "dd-MM-yyyy", label: "31-12-2026  (dd-mm-yyyy)" },
  { value: "dd/MM/yyyy", label: "31/12/2026  (dd/mm/yyyy)" },
  { value: "MM/dd/yyyy", label: "12/31/2026  (mm/dd/yyyy)" },
  { value: "yyyy-MM-dd", label: "2026-12-31  (yyyy-mm-dd)" },
] as const;

export const DEFAULT_PATHIK_DATE_FORMAT = PATHIK_DATE_FORMATS[0].value;

/**
 * `exact` — copied straight from the booking.
 * `guess` — derived from free-text address, or duplicated/defaulted. Verify it.
 * `missing` — Pathik asks for it and we hold nothing; type it there by hand.
 */
export type FieldSource = "exact" | "guess" | "missing";

export interface PathikField {
  /** The `name` attribute on Pathik's form — what the autofill script targets. */
  name: string;
  label: string;
  value: string;
  source: FieldSource;
  /** `select` fields are bootstrap-selectpickers matched by visible option text. */
  kind: "text" | "textarea" | "select";
}

/** Required on Pathik but absent from this app — shown as a manual checklist. */
export interface MissingField {
  label: string;
  hint: string;
}

export interface PathikMapping {
  fields: PathikField[];
  missing: MissingField[];
}

/* ------------------------------------------------------------------ names */

function splitName(fullName: string): { first: string; middle: string; last: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first: "", middle: "", last: "" };
  if (parts.length === 1) return { first: parts[0], middle: "", last: "" };
  return {
    first: parts[0],
    middle: parts.slice(1, -1).join(" "),
    last: parts[parts.length - 1],
  };
}

/* --------------------------------------------------------------- addresses */

const INDIAN_STATES = [
  "Andaman and Nicobar Islands", "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar",
  "Chandigarh", "Chhattisgarh", "Dadra and Nagar Haveli", "Daman and Diu", "Delhi", "Goa",
  "Gujarat", "Haryana", "Himachal Pradesh", "Jammu and Kashmir", "Jharkhand", "Karnataka",
  "Kerala", "Ladakh", "Lakshadweep", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya",
  "Mizoram", "Nagaland", "Odisha", "Puducherry", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu",
  "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal",
];

/** Countries common enough to be worth spotting in a free-text address. */
const COUNTRIES = [
  "Australia", "Bangladesh", "Bhutan", "Canada", "China", "France", "Germany", "India",
  "Indonesia", "Ireland", "Italy", "Japan", "Kenya", "Malaysia", "Maldives", "Nepal",
  "Netherlands The", "New Zealand", "Nigeria", "Oman", "Pakistan", "Philippines", "Qatar",
  "Russia", "Saudi Arabia", "Singapore", "South Africa", "Spain", "Sri Lanka", "Switzerland",
  "Thailand", "United Arab Emirates", "United Kingdom", "United States", "Vietnam",
];

const COUNTRY_ALIASES: Record<string, string> = {
  bharat: "India",
  uk: "United Kingdom",
  "u.k.": "United Kingdom",
  england: "United Kingdom",
  britain: "United Kingdom",
  "great britain": "United Kingdom",
  usa: "United States",
  "u.s.a.": "United States",
  "u.s.": "United States",
  america: "United States",
  uae: "United Arab Emirates",
  netherlands: "Netherlands The",
  holland: "Netherlands The",
};

const PIN_CODE = /\b\d{6}\b/;
const ZIP_ANY = /\b[A-Z0-9][A-Z0-9\s-]{2,9}\b/i;

interface ParsedAddress {
  house_flat_no: string;
  locality: string;
  city: string;
  district: string;
  zip_code: string;
  state: string;
  country: string;
}

const EMPTY_ADDRESS: ParsedAddress = {
  house_flat_no: "",
  locality: "",
  city: "",
  district: "",
  zip_code: "",
  state: "",
  country: "",
};

function matchFrom(list: string[], token: string): string | null {
  const want = token.trim().toLowerCase();
  return list.find((entry) => entry.toLowerCase() === want) ?? null;
}

/**
 * Pull Pathik's separate locality / city / district / zip / state / country out
 * of this app's single free-text address line.
 *
 * Assumes the usual narrowest-to-widest ordering, e.g.
 * "12 Ashirwad Flats, Nehru Road, Rajkot, Gujarat, 360001, India".
 * Every value it returns is a guess and is labelled as such in the UI.
 */
export function parseAddress(raw: string | null | undefined): ParsedAddress {
  if (!raw || !raw.trim()) return EMPTY_ADDRESS;

  let tokens = raw
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  const result: ParsedAddress = { ...EMPTY_ADDRESS };

  // Country — anywhere in the address, since it is usually last.
  for (let i = tokens.length - 1; i >= 0; i--) {
    const key = tokens[i].toLowerCase();
    const country = matchFrom(COUNTRIES, tokens[i]) ?? COUNTRY_ALIASES[key] ?? null;
    if (country) {
      result.country = country;
      tokens.splice(i, 1);
      break;
    }
  }

  // Postcode — a bare 6-digit PIN, or one trailing a token ("Rajkot 360001").
  // Runs before the state match so "Gujarat 380015" still reads as a state.
  for (let i = tokens.length - 1; i >= 0; i--) {
    const pin = tokens[i].match(PIN_CODE);
    if (pin) {
      result.zip_code = pin[0];
      const rest = tokens[i].replace(PIN_CODE, "").trim().replace(/[-–]$/, "").trim();
      if (rest) tokens[i] = rest;
      else tokens.splice(i, 1);
      break;
    }
  }

  // State — matched against Indian states, which is what this desk sees.
  for (let i = tokens.length - 1; i >= 0; i--) {
    const state = matchFrom(INDIAN_STATES, tokens[i]);
    if (state) {
      result.state = state;
      tokens.splice(i, 1);
      break;
    }
  }

  // Non-Indian postcode fallback: a short alphanumeric last token.
  if (!result.zip_code && result.country && result.country !== "India" && tokens.length > 1) {
    const last = tokens[tokens.length - 1];
    if (/\d/.test(last) && last.length <= 10 && ZIP_ANY.test(last)) {
      result.zip_code = last;
      tokens.pop();
    }
  }

  if (result.state && !result.country) result.country = "India";
  if (!result.country && result.zip_code && PIN_CODE.test(result.zip_code)) result.country = "India";

  // A leading token built around a number reads as a house / flat number:
  // "12", "221B Baker Street", "B-204", "A/7".
  if (tokens.length > 1 && /^[A-Za-z]{0,2}[-\s/]?\d/.test(tokens[0])) {
    result.house_flat_no = tokens[0];
    tokens = tokens.slice(1);
  }

  if (tokens.length === 1) {
    result.city = tokens[0];
    result.district = tokens[0];
  } else if (tokens.length >= 2) {
    result.city = tokens[tokens.length - 1];
    result.district = tokens[tokens.length - 1];
    result.locality = tokens[tokens.length - 2];
  }

  return result;
}

/* ----------------------------------------------------------------- mapping */

function formatDay(iso: string, pattern: string): string {
  try {
    return format(parseISO(iso), pattern);
  } catch {
    return "";
  }
}

/** Build the Pathik field list for a booking, plus what still needs typing there. */
export function mapBookingToPathik(
  booking: Booking,
  dateFormat: string = DEFAULT_PATHIK_DATE_FORMAT
): PathikMapping {
  const name = splitName(booking.guest_name);
  const address = parseAddress(booking.address);

  const fields: PathikField[] = [
    { name: "first_name", label: "First Name", value: name.first, source: "exact", kind: "text" },
    {
      name: "middle_name",
      label: "Middle Name",
      value: name.middle,
      source: name.middle ? "exact" : "missing",
      kind: "text",
    },
    {
      name: "last_name",
      label: "Last Name",
      value: name.last,
      source: name.last ? "exact" : "missing",
      kind: "text",
    },

    {
      name: "house_flat_no",
      label: "House / Flat No.",
      value: address.house_flat_no,
      source: address.house_flat_no ? "guess" : "missing",
      kind: "text",
    },
    {
      name: "address",
      label: "Address",
      value: booking.address ?? "",
      source: booking.address ? "exact" : "missing",
      kind: "textarea",
    },
    {
      name: "locality",
      label: "Locality",
      value: address.locality,
      source: address.locality ? "guess" : "missing",
      kind: "text",
    },
    {
      name: "city",
      label: "City",
      value: address.city,
      source: address.city ? "guess" : "missing",
      kind: "text",
    },
    {
      name: "district",
      label: "District",
      value: address.district,
      source: address.district ? "guess" : "missing",
      kind: "text",
    },
    {
      name: "zip_code",
      label: "Zip Code",
      value: address.zip_code,
      source: address.zip_code ? "guess" : "missing",
      kind: "text",
    },
    {
      name: "country",
      label: "Country",
      value: address.country,
      source: address.country ? "guess" : "missing",
      kind: "select",
    },
    {
      name: "state",
      label: "State",
      value: address.state,
      source: address.state ? "guess" : "missing",
      kind: "select",
    },

    { name: "mobile_no", label: "Mobile No.", value: booking.phone, source: "exact", kind: "text" },
    {
      name: "phone_no",
      label: "Phone No.",
      value: booking.phone,
      // Pathik requires both numbers; we only hold one, so it is copied across.
      source: "guess",
      kind: "text",
    },
    { name: "email", label: "Email Address", value: booking.email, source: "exact", kind: "text" },

    {
      name: "room_no",
      label: "Room Number",
      value: booking.room.room_number,
      source: "exact",
      kind: "text",
    },
    {
      name: "checkin_date",
      label: "Checkin Date",
      value: formatDay(booking.check_in, dateFormat),
      source: "exact",
      kind: "text",
    },
    {
      name: "checkout_date",
      label: "Checkout Date",
      value: formatDay(booking.check_out, dateFormat),
      source: "exact",
      kind: "text",
    },
    {
      name: "adult",
      label: "No. of Adult",
      value: String(booking.guest_count),
      source: "exact",
      kind: "text",
    },
    {
      name: "child",
      label: "No. of Child",
      // This app counts guests as one number, so children are not split out.
      value: "0",
      source: "guess",
      kind: "text",
    },
  ];

  const missing: MissingField[] = [
    { label: "Date of birth", hint: "Not collected in this app — read it off the guest's ID." },
    { label: "Checkin time / Checkout time", hint: "This app stores dates only, not times." },
    { label: "Document type & number", hint: "Aadhar, Election Card, Passport, and so on." },
    { label: "Document image", hint: "Upload on Pathik — max 6 images, 250 KB each." },
    { label: "Coming from / Going to", hint: "Ask the guest at the desk." },
    { label: "Company name", hint: "Optional on Pathik." },
    { label: "Vehicle type & registration no.", hint: "Optional on Pathik." },
    { label: "Other guest details", hint: "Name, mobile, and document for each extra guest." },
  ];

  return { fields, missing };
}

/** Fields the autofill script and the copy list actually carry a value for. */
export function filledFields(fields: PathikField[]): PathikField[] {
  return fields.filter((f) => f.value.trim() !== "");
}

/** "Label: value" lines, for the copy-everything button. */
export function buildPlainTextSummary(fields: PathikField[]): string {
  return filledFields(fields)
    .map((f) => `${f.label}: ${f.value}`)
    .join("\n");
}

/* ------------------------------------------------------------ autofill code */

/**
 * A self-contained script to paste into the browser console on Pathik's
 * "Add Guest" page. It writes the mapped values into the form, refreshes the
 * bootstrap-select dropdowns, and stops — it never clicks Submit.
 */
export function buildAutofillScript(booking: Booking, fields: PathikField[]): string {
  const payload = filledFields(fields).map((f) => ({
    name: f.name,
    value: f.value,
    kind: f.kind,
  }));

  return `/* Pathik autofill — booking #${booking.id}, ${booking.guest_name}.
   Paste this in the browser console on https://pathik.guru/dashboard/add
   It fills the form and stops. It never submits — review, add the remaining
   fields, then click Submit yourself. */
(function () {
  var DATA = ${JSON.stringify(payload, null, 2)};

  var form = document.querySelector('#add_customer') ||
             document.querySelector('form[name="add_customer"]');
  if (!form) {
    alert('Pathik autofill: open https://pathik.guru/dashboard/add and log in first, then run this again.');
    return;
  }

  var jq = window.jQuery;
  var filled = [];
  var skipped = [];

  function fire(el) {
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    if (jq) jq(el).trigger('change');
  }

  function setText(name, value) {
    var el = form.querySelector('[name="' + name + '"]');
    if (!el) { skipped.push(name + ' (field not on page)'); return; }
    el.value = value;
    fire(el);
    filled.push(name);
  }

  function setSelect(name, text) {
    var el = form.querySelector('select[name="' + name + '"]');
    if (!el) { skipped.push(name + ' (field not on page)'); return false; }
    var want = String(text).trim().toLowerCase();
    for (var i = 0; i < el.options.length; i++) {
      if (el.options[i].text.trim().toLowerCase() === want) {
        el.value = el.options[i].value;
        fire(el);
        if (jq) { try { jq(el).selectpicker('refresh'); } catch (e) {} }
        filled.push(name);
        return true;
      }
    }
    skipped.push(name + ' (no option matching "' + text + '")');
    return false;
  }

  // Text fields first; country before state so the state list can load.
  var stateValue = null;
  DATA.forEach(function (field) {
    if (field.name === 'state') { stateValue = field.value; return; }
    if (field.kind === 'select') setSelect(field.name, field.value);
    else setText(field.name, field.value);
  });

  function report() {
    console.log('%cPathik autofill', 'font-weight:bold', '\\nFilled: ' + filled.join(', ') +
      (skipped.length ? '\\nSkipped: ' + skipped.join(', ') : ''));
    var bar = document.createElement('div');
    bar.style.cssText = 'position:fixed;z-index:99999;left:50%;bottom:24px;transform:translateX(-50%);' +
      'max-width:90vw;padding:12px 18px;border-radius:8px;background:#1e293b;color:#fff;' +
      'font:14px/1.5 Poppins,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.25)';
    bar.textContent = 'Pathik autofill: ' + filled.length + ' field(s) filled' +
      (skipped.length ? ', ' + skipped.length + ' skipped (see console)' : '') +
      '. Nothing was submitted — check the form, then Submit yourself.';
    document.body.appendChild(bar);
    setTimeout(function () { bar.remove(); }, 9000);
  }

  // Picking a country triggers an AJAX reload of the state dropdown, so wait
  // for the new options before setting the state.
  if (stateValue) {
    var waited = 0;
    var timer = setInterval(function () {
      var stateEl = form.querySelector('select[name="state"]');
      waited += 250;
      if (stateEl && stateEl.options.length > 1) {
        clearInterval(timer);
        setSelect('state', stateValue);
        report();
      } else if (waited >= 8000) {
        clearInterval(timer);
        skipped.push('state (dropdown did not load — pick it by hand)');
        report();
      }
    }, 250);
  } else {
    report();
  }
}());`;
}
