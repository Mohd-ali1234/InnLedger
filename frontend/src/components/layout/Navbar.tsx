import { Bell, Menu, Search } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { initials } from "@/utils/format";

interface NavbarProps {
  onMenuClick: () => void;
}

export function Navbar({ onMenuClick }: NavbarProps) {
  const { admin } = useAuth();
  const name = admin?.username ?? "Admin";

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border bg-white/80 px-4 backdrop-blur-md sm:px-6">
      <button
        onClick={onMenuClick}
        className="rounded-md p-2 text-muted-foreground hover:bg-slate-100 lg:hidden cursor-pointer"
        aria-label="Open menu"
      >
        <Menu className="size-5" />
      </button>

      {/* Search (placeholder) */}
      <div className="relative hidden max-w-md flex-1 sm:block">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          placeholder="Search rooms, bookings, guests…"
          className="h-9 w-full rounded-lg border border-border bg-slate-50 pl-9 pr-3 text-sm transition-colors placeholder:text-muted-foreground focus:border-primary focus:bg-white focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      <div className="ml-auto flex items-center gap-1.5">
        <button
          className="relative rounded-lg p-2 text-muted-foreground transition-colors hover:bg-slate-100 hover:text-foreground cursor-pointer"
          aria-label="Notifications"
        >
          <Bell className="size-5" />
          <span className="absolute right-2 top-2 size-2 rounded-full bg-primary ring-2 ring-white" />
        </button>

        <div className="mx-1 h-6 w-px bg-border" />

        <div className="flex items-center gap-2.5 rounded-lg py-1 pl-1 pr-2">
          <div className="flex size-9 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
            {initials(name)}
          </div>
          <div className="hidden text-left leading-tight sm:block">
            <p className="text-sm font-medium text-foreground">{name}</p>
            <p className="text-[11px] text-muted-foreground">Administrator</p>
          </div>
        </div>
      </div>
    </header>
  );
}
