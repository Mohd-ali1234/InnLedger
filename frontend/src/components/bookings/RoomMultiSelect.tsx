import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/utils/cn";
import type { Room } from "@/types";

interface RoomMultiSelectProps {
  id?: string;
  /** Rooms that can be picked. Only the room number is shown. */
  rooms: Room[];
  selected: number[];
  onChange: (ids: number[]) => void;
  invalid?: boolean;
}

/** Dropdown for choosing several rooms at once; lists room numbers only. */
export function RoomMultiSelect({ id, rooms, selected, onChange, invalid }: RoomMultiSelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    // Capture on window so Escape closes just this list, not the whole booking form.
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey, true);
    };
  }, [open]);

  const sorted = [...rooms].sort((a, b) =>
    a.room_number.localeCompare(b.room_number, undefined, { numeric: true })
  );
  const numberOf = (rid: number) => rooms.find((r) => r.id === rid)?.room_number ?? "";

  const toggle = (rid: number) =>
    onChange(selected.includes(rid) ? selected.filter((x) => x !== rid) : [...selected, rid]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        id={id}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-invalid={invalid}
        className={cn(
          "flex h-9 w-full cursor-pointer items-center justify-between gap-2 rounded-lg border border-input bg-white px-3 text-left text-sm shadow-soft transition-colors",
          "focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          invalid && "border-destructive"
        )}
      >
        <span className={cn("min-w-0 flex-1 truncate", selected.length === 0 && "text-muted-foreground")}>
          {selected.length === 0 ? "Select rooms" : selected.map(numberOf).join(", ")}
        </span>
        <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
      </button>

      {open && (
        <div
          role="listbox"
          aria-multiselectable="true"
          className="absolute left-0 right-0 top-full z-20 mt-1 max-h-52 overflow-y-auto rounded-lg border border-border bg-popover p-2 shadow-lift animate-fade-in"
        >
          {sorted.length === 0 ? (
            <p className="px-2 py-3 text-center text-xs text-muted-foreground">No rooms available</p>
          ) : (
            <div className="grid grid-cols-3 gap-1.5">
              {sorted.map((r) => {
                const on = selected.includes(r.id);
                return (
                  <button
                    key={r.id}
                    type="button"
                    role="option"
                    aria-selected={on}
                    onClick={() => toggle(r.id)}
                    className={cn(
                      "flex h-8 cursor-pointer items-center justify-center gap-1 rounded-md border text-sm font-medium transition-colors",
                      on
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-white text-foreground hover:bg-slate-50"
                    )}
                  >
                    {on && <Check className="size-3.5" />}
                    {r.room_number}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
