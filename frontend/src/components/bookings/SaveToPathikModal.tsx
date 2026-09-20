import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Check,
  ClipboardCopy,
  ClipboardList,
  Code2,
  ExternalLink,
  Info,
  Puzzle,
  Wand2,
} from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { usePathikBridge } from "@/hooks/usePathikBridge";
import { PATHIK_ADD_GUEST_URL } from "@/utils/constants";
import { formatDate } from "@/utils/format";
import {
  DEFAULT_PATHIK_DATE_FORMAT,
  PATHIK_DATE_FORMATS,
  buildAutofillScript,
  buildPlainTextSummary,
  filledFields,
  mapBookingToPathik,
  type PathikField,
} from "@/utils/pathik";
import type { Booking } from "@/types";

interface SaveToPathikModalProps {
  open: boolean;
  booking: Booking | null;
  onClose: () => void;
  /** Shown when the modal follows a successful create rather than a menu action. */
  justCreated?: boolean;
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Clipboard API needs a secure context; fall back to a hidden textarea.
    const area = document.createElement("textarea");
    area.value = text;
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    area.remove();
    return ok;
  }
}

/**
 * Prepares a booking for Pathik's "Add Guest" form.
 *
 * With the companion extension installed this opens Pathik with the form
 * already filled; without it, the same values are offered as a paste-in script
 * and as copyable fields. Pathik is a separate site, so nothing is submitted
 * from here either way.
 */
export function SaveToPathikModal({ open, booking, onClose, justCreated }: SaveToPathikModalProps) {
  const [dateFormat, setDateFormat] = useState<string>(DEFAULT_PATHIK_DATE_FORMAT);
  const [copied, setCopied] = useState<string | null>(null);
  const { installed, state, send } = usePathikBridge();

  const mapping = useMemo(
    () => (booking ? mapBookingToPathik(booking, dateFormat) : null),
    [booking, dateFormat]
  );

  if (!booking || !mapping) return null;

  const ready = filledFields(mapping.fields);
  const guessCount = ready.filter((f) => f.source === "guess").length;

  const copy = async (key: string, text: string) => {
    if (await copyText(text)) {
      setCopied(key);
      setTimeout(() => setCopied((k) => (k === key ? null : k)), 2000);
    }
  };

  const copyScript = () => copy("script", buildAutofillScript(booking, mapping.fields));
  const copyAll = () => copy("all", buildPlainTextSummary(mapping.fields));
  const openPathik = () => window.open(PATHIK_ADD_GUEST_URL, "_blank", "noopener,noreferrer");

  const openAndFillLabel =
    state === "sending"
      ? "Opening Pathik…"
      : state === "sent"
        ? "Opened in a new tab"
        : state === "failed"
          ? "Couldn't reach the extension"
          : "Open Pathik & fill";

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="Save on Pathik"
      description={
        justCreated
          ? "Booking created. Send it straight into Pathik's Add Guest form."
          : "Send this booking into Pathik's Add Guest form."
      }
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          {installed ? (
            <>
              <Button variant="secondary" onClick={copyAll}>
                {copied === "all" ? <Check /> : <ClipboardList />}
                {copied === "all" ? "Copied" : "Copy values"}
              </Button>
              <Button
                onClick={() => send(booking, mapping.fields)}
                isLoading={state === "sending"}
                disabled={state === "sending"}
              >
                {state === "sent" ? <Check /> : <Wand2 />}
                {openAndFillLabel}
              </Button>
            </>
          ) : (
            <>
              <Button variant="secondary" onClick={copyAll}>
                {copied === "all" ? <Check /> : <ClipboardList />}
                {copied === "all" ? "Copied" : "Copy all values"}
              </Button>
              <Button onClick={copyScript}>
                {copied === "script" ? <Check /> : <Code2 />}
                {copied === "script" ? "Script copied" : "Copy autofill script"}
              </Button>
            </>
          )}
        </>
      }
    >
      <div className="space-y-5">
        {/* Booking being transferred */}
        <div className="rounded-lg border border-border bg-slate-50/60 px-4 py-3 text-sm">
          <p className="font-medium text-foreground">
            Reservation #{booking.id} · {booking.guest_name}
          </p>
          <p className="text-muted-foreground">
            Room {booking.room.room_number} · {formatDate(booking.check_in)} →{" "}
            {formatDate(booking.check_out)}
          </p>
        </div>

        {installed ? <OneClickHelp /> : <ConsoleHelp onOpenPathik={openPathik} />}

        {/* Date format — Pathik's picker format can't be detected from here */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="pathik-date-format" className="text-sm font-medium text-foreground">
            Date format used by Pathik
          </label>
          <Select
            id="pathik-date-format"
            value={dateFormat}
            onChange={(e) => setDateFormat(e.target.value)}
          >
            {PATHIK_DATE_FORMATS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </Select>
          <p className="text-xs text-muted-foreground">
            Match this to how Pathik's date picker shows dates, so check-in and check-out land
            correctly.
          </p>
        </div>

        {/* Mapped values */}
        <div>
          <div className="mb-2 flex items-baseline justify-between gap-3">
            <h3 className="text-sm font-semibold text-foreground">
              Values for Pathik
              <span className="ml-2 font-normal text-muted-foreground">{ready.length} fields</span>
            </h3>
            {guessCount > 0 && (
              <span className="text-xs text-amber-700">{guessCount} need a check</span>
            )}
          </div>

          <div className="divide-y divide-border overflow-hidden rounded-lg border border-border">
            {ready.map((field) => (
              <FieldRow
                key={field.name}
                field={field}
                copied={copied === field.name}
                onCopy={() => copy(field.name, field.value)}
              />
            ))}
          </div>

          {guessCount > 0 && (
            <p className="mt-2 flex items-start gap-1.5 text-xs text-amber-700">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
              Amber fields are worked out from the single address line, or copied from another
              field. Read them over before submitting.
            </p>
          )}
        </div>

        {/* What Pathik still needs */}
        <div>
          <h3 className="mb-2 text-sm font-semibold text-foreground">
            Still to fill in on Pathik
            <span className="ml-2 font-normal text-muted-foreground">not held in this app</span>
          </h3>
          <ul className="space-y-1.5 rounded-lg border border-border bg-slate-50/60 px-4 py-3 text-sm">
            {mapping.missing.map((item) => (
              <li key={item.label} className="text-muted-foreground">
                <span className="font-medium text-foreground">{item.label}</span> — {item.hint}
              </li>
            ))}
          </ul>
        </div>

        <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
          <ExternalLink className="mt-0.5 size-3.5 shrink-0" />
          Nothing is submitted on Pathik — you review the form and click Submit there yourself.
        </p>
      </div>
    </Modal>
  );
}

/** Shown when the companion extension is installed. */
function OneClickHelp() {
  return (
    <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 px-4 py-3">
      <p className="mb-2 flex items-center gap-2 text-sm font-medium text-foreground">
        <Wand2 className="size-4 shrink-0 text-emerald-600" />
        One-click autofill is ready
      </p>
      <p className="text-sm text-muted-foreground">
        Make sure you are logged in to Pathik, then hit <strong>Open Pathik &amp; fill</strong>. The
        Add Guest form opens in a new tab with these values already in it — check the highlighted
        fields, add what Pathik still needs, and submit there yourself.
      </p>
    </div>
  );
}

/** Fallback when the extension is not installed: paste the script into the console. */
function ConsoleHelp({ onOpenPathik }: { onOpenPathik: () => void }) {
  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
        <p className="mb-2 flex items-center gap-2 text-sm font-medium text-foreground">
          <Info className="size-4 shrink-0 text-primary" />
          Filling Pathik in four steps
        </p>
        <ol className="ml-1 list-inside list-decimal space-y-1 text-sm text-muted-foreground">
          <li>
            Open{" "}
            <button
              onClick={onOpenPathik}
              className="cursor-pointer font-medium text-primary underline underline-offset-2"
            >
              Pathik → Add Guest
            </button>{" "}
            and log in.
          </li>
          <li>
            Press <Kbd>F12</Kbd> on that page, then open the <strong>Console</strong> tab.
          </li>
          <li>
            Hit <strong>Copy autofill script</strong> below, paste into the console, press{" "}
            <Kbd>Enter</Kbd>.
          </li>
          <li>
            Add the fields Pathik still needs, check everything, then click <strong>Submit</strong>{" "}
            there yourself.
          </li>
        </ol>
        <p className="mt-2 text-xs text-muted-foreground">
          The script only types into the form — it never submits it.
        </p>
      </div>

      <p className="flex items-start gap-1.5 rounded-lg border border-border bg-slate-50/60 px-4 py-2.5 text-xs text-muted-foreground">
        <Puzzle className="mt-0.5 size-3.5 shrink-0" />
        <span>
          Skip the console entirely: load the <code className="font-mono">pathik-extension</code>{" "}
          folder in your browser once (see its README), reload this page, and this becomes a single{" "}
          <strong>Open Pathik &amp; fill</strong> button.
        </span>
      </p>
    </div>
  );
}

function FieldRow({
  field,
  copied,
  onCopy,
}: {
  field: PathikField;
  copied: boolean;
  onCopy: () => void;
}) {
  const guessed = field.source === "guess";
  return (
    <div className="flex items-center gap-3 bg-white px-3.5 py-2.5">
      <div className="w-40 shrink-0">
        <p className="truncate text-sm font-medium text-foreground">{field.label}</p>
        <p className="truncate font-mono text-[11px] text-muted-foreground">{field.name}</p>
      </div>
      <p
        className={
          "min-w-0 flex-1 truncate text-sm " + (guessed ? "text-amber-700" : "text-foreground")
        }
        title={field.value}
      >
        {field.value}
      </p>
      <Button
        variant="ghost"
        size="icon"
        className="size-8 shrink-0"
        aria-label={`Copy ${field.label}`}
        onClick={onCopy}
      >
        {copied ? (
          <Check className="size-4 text-emerald-600" />
        ) : (
          <ClipboardCopy className="size-4" />
        )}
      </Button>
    </div>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded border border-border bg-white px-1.5 py-0.5 font-mono text-[11px] text-foreground shadow-soft">
      {children}
    </kbd>
  );
}
