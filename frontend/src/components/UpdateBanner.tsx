import { useEffect, useState } from "react";
import { Download, RefreshCw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { UpdateStatus } from "@/types/desktop";

/** Subscribes to the desktop shell's update status. Stays null in the browser build. */
export function useDesktopUpdate() {
  const [status, setStatus] = useState<UpdateStatus | null>(null);
  const [version, setVersion] = useState<string>("");

  useEffect(() => {
    const d = window.desktop;
    if (!d) return;
    d.getVersion().then(setVersion);
    return d.onUpdate(setStatus);
  }, []);

  return { desktop: window.desktop, status, version };
}

/** Top-of-page banner shown when a newer release is on GitHub. */
export function UpdateBanner() {
  const { desktop, status } = useDesktopUpdate();
  if (!desktop || !status) return null;
  if (!["available", "downloading", "ready"].includes(status.state)) return null;

  return (
    <div className="flex flex-wrap items-center justify-center gap-3 border-b border-blue-200 bg-blue-50 px-4 py-2.5 text-sm text-blue-900">
      {status.state === "available" && (
        <>
          <Sparkles className="size-4 text-primary" />
          <span>
            <b>New version {status.version}</b> of InnLedger is available.
          </span>
          <Button size="sm" onClick={() => desktop.downloadUpdate()}>
            <Download />
            Download update
          </Button>
        </>
      )}
      {status.state === "downloading" && (
        <>
          <span>Downloading update… {status.percent}%</span>
          <div className="h-1.5 w-40 overflow-hidden rounded-full bg-blue-200">
            <div className="h-full bg-primary transition-all" style={{ width: `${status.percent}%` }} />
          </div>
        </>
      )}
      {status.state === "ready" && (
        <>
          <span>
            Version <b>{status.version}</b> is ready to install.
          </span>
          <Button size="sm" onClick={() => desktop.installUpdate()}>
            <RefreshCw />
            Restart &amp; update
          </Button>
        </>
      )}
    </div>
  );
}
