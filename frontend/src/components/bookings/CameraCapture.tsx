import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Camera, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";

interface CameraCaptureProps {
  open: boolean;
  onClose: () => void;
  /** Receives the captured photo as a JPEG file. */
  onCapture: (file: File) => void;
}

const MAX_WIDTH = 1920;

function describeError(err: unknown): string {
  const name = (err as { name?: string })?.name;
  if (name === "NotAllowedError" || name === "SecurityError") {
    return "Camera access was blocked. Allow the camera for this app (in the browser's address bar, or Windows Settings → Privacy → Camera) and try again.";
  }
  if (name === "NotFoundError" || name === "OverconstrainedError") {
    return "No camera was found on this device.";
  }
  if (name === "NotReadableError") {
    return "The camera is being used by another app. Close it and try again.";
  }
  return "Couldn't start the camera.";
}

/** Full-screen camera view: live preview, capture, retake, use. */
export function CameraCapture({ open, onClose, onCapture }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState<string>("");
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const [shot, setShot] = useState<{ blob: Blob; url: string } | null>(null);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const startStream = useCallback(
    async (id?: string) => {
      stopStream();
      setReady(false);
      setError("");
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            ...(id ? { deviceId: { exact: id } } : { facingMode: "environment" }),
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        });
        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          await video.play().catch(() => {});
        }
        setReady(true);
        // Labels are only available after permission has been granted.
        const all = await navigator.mediaDevices.enumerateDevices();
        const cams = all.filter((d) => d.kind === "videoinput");
        setDevices(cams);
        setDeviceId(stream.getVideoTracks()[0]?.getSettings().deviceId ?? "");
      } catch (err) {
        setError(navigator.mediaDevices ? describeError(err) : "This browser can't use the camera.");
      }
    },
    [stopStream]
  );

  // Start when opened, release the camera when closed.
  useEffect(() => {
    if (!open) return;
    setShot(null);
    startStream();
    return () => stopStream();
  }, [open, startStream, stopStream]);

  // Free the preview image when it's replaced or the dialog closes.
  useEffect(() => {
    return () => {
      if (shot) URL.revokeObjectURL(shot.url);
    };
  }, [shot]);

  // Escape closes just the camera, not the booking form underneath.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, onClose]);

  const capture = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const scale = Math.min(1, MAX_WIDTH / video.videoWidth);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (blob) setShot({ blob, url: URL.createObjectURL(blob) });
      },
      "image/jpeg",
      0.9
    );
  };

  const usePhoto = () => {
    if (!shot) return;
    const stamp = new Date().toISOString().replace(/[:T]/g, "-").slice(0, 19);
    onCapture(new File([shot.blob], `id-photo-${stamp}.jpg`, { type: "image/jpeg" }));
    onClose();
  };

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex flex-col bg-slate-950/95 animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-label="Take a photo of the ID"
    >
      <div className="flex shrink-0 items-center justify-between gap-4 px-5 py-3 text-white">
        <div>
          <h2 className="text-base font-semibold">Take a photo of the ID</h2>
          <p className="text-xs text-white/60">Hold it flat, fill the frame and keep the text sharp.</p>
        </div>
        <div className="flex items-center gap-3">
          {devices.length > 1 && !shot && (
            <div className="w-52">
              <Select
                aria-label="Camera"
                className="h-9"
                value={deviceId}
                onChange={(e) => {
                  setDeviceId(e.target.value);
                  startStream(e.target.value);
                }}
              >
                {devices.map((d, i) => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.label || `Camera ${i + 1}`}
                  </option>
                ))}
              </Select>
            </div>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close camera"
            className="cursor-pointer rounded-md p-2 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
          >
            <X className="size-5" />
          </button>
        </div>
      </div>

      <div className="relative flex min-h-0 flex-1 items-center justify-center px-5">
        {error ? (
          <div className="max-w-md rounded-xl border border-white/10 bg-white/5 p-6 text-center text-sm text-white">
            <p>{error}</p>
            <Button className="mt-4" variant="secondary" onClick={() => startStream(deviceId || undefined)}>
              <RefreshCw />
              Try again
            </Button>
          </div>
        ) : (
          <>
            {/* The live video stays mounted so the stream keeps running behind the frozen shot. */}
            <video
              ref={videoRef}
              playsInline
              muted
              className={`max-h-full max-w-full rounded-lg bg-black object-contain ${shot ? "hidden" : ""}`}
            />
            {shot && (
              <img
                src={shot.url}
                alt="Captured ID"
                className="max-h-full max-w-full rounded-lg object-contain"
              />
            )}
            {!ready && !shot && (
              <p className="absolute text-sm text-white/70">Starting the camera…</p>
            )}
          </>
        )}
      </div>

      <div className="flex shrink-0 items-center justify-center gap-3 px-5 py-4">
        {shot ? (
          <>
            <Button variant="secondary" onClick={() => setShot(null)}>
              <RefreshCw />
              Retake
            </Button>
            <Button onClick={usePhoto}>Use this photo</Button>
          </>
        ) : (
          <Button size="lg" onClick={capture} disabled={!ready || Boolean(error)}>
            <Camera />
            Capture
          </Button>
        )}
      </div>
    </div>,
    document.body
  );
}
