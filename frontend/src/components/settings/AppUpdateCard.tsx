import { RefreshCw } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useDesktopUpdate } from "@/components/UpdateBanner";

const LABEL: Record<string, string> = {
  checking: "Checking for updates…",
  none: "You're on the latest version.",
  dev: "Update checks are disabled in development.",
  available: "A new version is available — see the banner at the top.",
  downloading: "Downloading the update…",
  ready: "Update downloaded — restart to install it.",
  error: "Couldn't check for updates. Are you online?",
};

/** Version + manual "check for updates". Renders nothing outside the desktop app. */
export function AppUpdateCard() {
  const { desktop, status, version } = useDesktopUpdate();
  if (!desktop) return null;

  const busy = status?.state === "checking" || status?.state === "downloading";
  return (
    <Card className="p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground">InnLedger {version && `v${version}`}</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {status ? LABEL[status.state] : "Updates are checked automatically when the app starts."}
          </p>
        </div>
        <Button variant="secondary" onClick={() => desktop.checkUpdates()} disabled={busy}>
          <RefreshCw />
          Check for updates
        </Button>
      </div>
    </Card>
  );
}
