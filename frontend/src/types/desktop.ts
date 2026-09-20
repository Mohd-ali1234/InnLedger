export type UpdateStatus =
  | { state: "checking" }
  | { state: "none" }
  | { state: "dev" }
  | { state: "available"; version: string }
  | { state: "downloading"; percent: number }
  | { state: "ready"; version: string }
  | { state: "error"; message: string };

/** Bridge exposed by the Electron shell (desktop/preload.js). Undefined in a normal browser. */
export interface DesktopBridge {
  isDesktop: true;
  getVersion: () => Promise<string>;
  checkUpdates: () => Promise<void>;
  downloadUpdate: () => Promise<void>;
  installUpdate: () => Promise<void>;
  onUpdate: (cb: (status: UpdateStatus) => void) => () => void;
}

declare global {
  interface Window {
    desktop?: DesktopBridge;
  }
}
