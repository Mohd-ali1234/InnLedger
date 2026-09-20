import { useRef, type ChangeEvent } from "react";
import { Eye, FileText, Image as ImageIcon, Paperclip, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import type { BookingDocument } from "@/types";

export const MAX_DOCUMENTS = 10;
const MAX_BYTES = 10 * 1024 * 1024;
const ACCEPTED = ["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"];

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

interface DocumentsPickerProps {
  /** Documents already saved on the booking (edit mode). */
  existing: BookingDocument[];
  /** Files chosen but not uploaded yet. */
  pending: File[];
  onAdd: (files: File[]) => void;
  onRemoveExisting: (id: number) => void;
  onRemovePending: (index: number) => void;
  onView?: (doc: BookingDocument) => void;
}

/** Optional ID upload: several images / PDFs, sent when the booking is saved. */
export function DocumentsPicker({
  existing,
  pending,
  onAdd,
  onRemoveExisting,
  onRemovePending,
  onView,
}: DocumentsPickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const count = existing.length + pending.length;

  const handlePicked = (e: ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? []);
    // Reset so choosing the same file again still fires a change event.
    e.target.value = "";
    const ok: File[] = [];
    for (const f of picked) {
      if (!ACCEPTED.includes(f.type)) {
        toast.warning(`"${f.name}" skipped — only images and PDFs are allowed`);
      } else if (f.size > MAX_BYTES) {
        toast.warning(`"${f.name}" skipped — larger than 10 MB`);
      } else if (count + ok.length >= MAX_DOCUMENTS) {
        toast.warning(`Only ${MAX_DOCUMENTS} documents per booking`);
        break;
      } else {
        ok.push(f);
      }
    }
    if (ok.length) onAdd(ok);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-foreground">ID documents</p>
          <p className="text-xs text-muted-foreground">
            Optional. Images or PDFs, up to 10 MB each — add as many IDs as you need.
          </p>
        </div>
        <Button type="button" variant="secondary" size="sm" onClick={() => inputRef.current?.click()}>
          <Paperclip />
          Add documents
        </Button>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
          className="hidden"
          onChange={handlePicked}
        />
      </div>

      {count > 0 && (
        <ul className="space-y-2">
          {existing.map((d) => (
            <DocRow
              key={`e${d.id}`}
              name={d.filename}
              type={d.content_type}
              size={d.size}
              onView={onView ? () => onView(d) : undefined}
              onRemove={() => onRemoveExisting(d.id)}
            />
          ))}
          {pending.map((f, i) => (
            <DocRow
              key={`p${i}-${f.name}`}
              name={f.name}
              type={f.type}
              size={f.size}
              isNew
              onRemove={() => onRemovePending(i)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function DocRow({
  name,
  type,
  size,
  isNew,
  onView,
  onRemove,
}: {
  name: string;
  type: string;
  size: number;
  isNew?: boolean;
  onView?: () => void;
  onRemove: () => void;
}) {
  const Icon = type === "application/pdf" ? FileText : ImageIcon;
  return (
    <li className="flex items-center gap-3 rounded-lg border border-border bg-slate-50/60 px-3 py-2">
      <Icon className="size-4 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1 truncate text-sm text-foreground">{name}</span>
      <span className="shrink-0 text-xs text-muted-foreground">
        {formatBytes(size)}
        {isNew && " · new"}
      </span>
      {onView && (
        <button
          type="button"
          onClick={onView}
          className="cursor-pointer text-muted-foreground hover:text-foreground"
          aria-label={`View ${name}`}
        >
          <Eye className="size-4" />
        </button>
      )}
      <button
        type="button"
        onClick={onRemove}
        className="cursor-pointer text-muted-foreground hover:text-destructive"
        aria-label={`Remove ${name}`}
      >
        <X className="size-4" />
      </button>
    </li>
  );
}
