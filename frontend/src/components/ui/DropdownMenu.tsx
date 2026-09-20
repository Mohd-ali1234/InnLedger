import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/utils/cn";

interface DropdownMenuProps {
  trigger: ReactNode;
  children: ReactNode;
  align?: "start" | "end";
}

export function DropdownMenu({ trigger, children, align = "end" }: DropdownMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  // Render in a portal with fixed positioning so table/card overflow can't clip the menu.
  const toggle = () => {
    if (!open && ref.current) {
      const r = ref.current.getBoundingClientRect();
      const menuW = 176;
      const menuH = 200;
      const left = align === "end" ? r.right - menuW : r.left;
      const top = r.bottom + menuH > window.innerHeight ? Math.max(8, r.top - menuH - 4) : r.bottom + 4;
      setPos({ top, left: Math.max(8, left) });
    }
    setOpen((v) => !v);
  };

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!ref.current?.contains(t) && !menuRef.current?.contains(t)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const close = () => setOpen(false);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <span onClick={toggle}>{trigger}</span>
      {open && pos &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            style={{ position: "fixed", top: pos.top, left: pos.left }}
            className="z-50 min-w-[11rem] overflow-hidden rounded-lg border border-border bg-popover p-1 shadow-lift animate-fade-in"
            onClick={() => setOpen(false)}
          >
            {children}
          </div>,
          document.body
        )}
    </div>
  );
}

interface MenuItemProps {
  icon?: ReactNode;
  onClick: () => void;
  children: ReactNode;
  variant?: "default" | "danger";
  disabled?: boolean;
}

export function MenuItem({ icon, onClick, children, variant = "default", disabled }: MenuItemProps) {
  return (
    <button
      role="menuitem"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm transition-colors cursor-pointer disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0",
        variant === "danger"
          ? "text-destructive hover:bg-red-50"
          : "text-foreground hover:bg-slate-100"
      )}
    >
      {icon}
      {children}
    </button>
  );
}
