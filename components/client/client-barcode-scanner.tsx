"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Loader2, X } from "lucide-react"

import { Button } from "@/components/ui/button"

/**
 * Camera barcode scanning.
 *
 * Two decoders behind one interface: the native `BarcodeDetector` where it
 * exists (Chrome/Android — hardware-accelerated, nothing to download) and
 * zxing-wasm everywhere else. On iPhone that "everywhere else" is the normal
 * case, since Safari has no BarcodeDetector, so the wasm path is the primary
 * one here rather than a fallback.
 *
 * The wasm module is imported dynamically so its ~1 MB never reaches anyone who
 * only ever types codes or uses the search.
 */

/** Retail formats only — a narrow set decodes markedly faster than "everything". */
const ZXING_FORMATS = ["EAN-13", "EAN-8", "UPC-A", "UPC-E"] as const
const NATIVE_FORMATS = ["ean_13", "ean_8", "upc_a", "upc_e"]

/** ~7 fps: fast enough to feel instant, slow enough not to cook the phone. */
const SCAN_INTERVAL_MS = 140

/** Downscale before decoding; a 4K frame costs time and buys no accuracy here. */
const MAX_SCAN_WIDTH = 640

type ScannerState =
  | { kind: "starting" }
  | { kind: "scanning" }
  | { kind: "error"; message: string }

interface NativeBarcodeDetector {
  detect: (source: CanvasImageSource) => Promise<Array<{ rawValue: string }>>
}

function nativeDetector(): NativeBarcodeDetector | null {
  const ctor = (
    globalThis as unknown as {
      BarcodeDetector?: new (options: { formats: string[] }) => NativeBarcodeDetector
    }
  ).BarcodeDetector
  if (!ctor) return null
  try {
    return new ctor({ formats: NATIVE_FORMATS })
  } catch {
    return null
  }
}

function cameraErrorMessage(error: unknown): string {
  const name = error instanceof Error ? error.name : ""
  switch (name) {
    case "NotAllowedError":
    case "SecurityError":
      return "Kamerazugriff wurde abgelehnt. Du kannst den Code auch eintippen."
    case "NotFoundError":
    case "OverconstrainedError":
      return "Keine Kamera gefunden. Tipp den Code einfach ein."
    case "NotReadableError":
      return "Die Kamera wird gerade von einer anderen App benutzt."
    default:
      return "Die Kamera lässt sich nicht öffnen. Tipp den Code einfach ein."
  }
}

export function ClientBarcodeScanner({
  onDetected,
  onClose,
}: {
  onDetected: (code: string) => void
  onClose: () => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  // Guards against a decode that resolves after teardown and reports a hit
  // into an unmounted dialog.
  const doneRef = useRef(false)
  const [state, setState] = useState<ScannerState>({ kind: "starting" })

  const stopCamera = useCallback(() => {
    // Without this the camera indicator stays lit after the dialog closes,
    // which reads as the app still watching.
    for (const track of streamRef.current?.getTracks() ?? []) track.stop()
    streamRef.current = null
  }, [])

  useEffect(() => {
    let cancelled = false
    let timer: number | undefined

    async function decodeFrame(detector: NativeBarcodeDetector | null): Promise<string | null> {
      const video = videoRef.current
      if (!video || video.readyState < video.HAVE_CURRENT_DATA) return null

      if (detector) {
        const results = await detector.detect(video)
        return results[0]?.rawValue ?? null
      }

      const canvas = (canvasRef.current ??= document.createElement("canvas"))
      const scale = Math.min(1, MAX_SCAN_WIDTH / video.videoWidth)
      canvas.width = Math.round(video.videoWidth * scale)
      canvas.height = Math.round(video.videoHeight * scale)

      const context = canvas.getContext("2d", { willReadFrequently: true })
      if (!context) return null
      context.drawImage(video, 0, 0, canvas.width, canvas.height)

      const { readBarcodes } = await import("zxing-wasm/reader")
      const results = await readBarcodes(
        context.getImageData(0, 0, canvas.width, canvas.height),
        { formats: [...ZXING_FORMATS], tryHarder: true },
      )
      return results[0]?.text || null
    }

    async function start() {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw Object.assign(new Error("no getUserMedia"), { name: "NotFoundError" })
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
        })
        if (cancelled) {
          for (const track of stream.getTracks()) track.stop()
          return
        }

        streamRef.current = stream
        const video = videoRef.current
        if (video) {
          video.srcObject = stream
          await video.play().catch(() => undefined)
        }
        setState({ kind: "scanning" })

        const detector = nativeDetector()
        if (!detector) {
          // Point the wasm at our own copy; the default is a CDN fetch.
          const { prepareZXingModule } = await import("zxing-wasm/reader")
          prepareZXingModule({
            overrides: {
              locateFile: (path: string, prefix: string) =>
                path.endsWith(".wasm") ? "/zxing/zxing_reader.wasm" : `${prefix}${path}`,
            },
          })
        }

        const tick = async () => {
          if (cancelled || doneRef.current) return
          try {
            const code = await decodeFrame(detector)
            if (code && !doneRef.current && !cancelled) {
              doneRef.current = true
              stopCamera()
              onDetected(code)
              return
            }
          } catch (error) {
            // A single unreadable frame is normal; only a broken camera is not.
            console.debug("Barcode frame skipped:", error)
          }
          timer = window.setTimeout(() => void tick(), SCAN_INTERVAL_MS)
        }
        void tick()
      } catch (error) {
        if (cancelled) return
        console.error("Camera scanner failed to start:", error)
        setState({ kind: "error", message: cameraErrorMessage(error) })
      }
    }

    void start()

    return () => {
      cancelled = true
      if (timer !== undefined) window.clearTimeout(timer)
      stopCamera()
    }
  }, [onDetected, stopCamera])

  return (
    <div className="space-y-3">
      <div className="relative overflow-hidden rounded-md bg-black">
        <video
          ref={videoRef}
          className="h-56 w-full object-cover"
          // Both are required on iOS, otherwise the stream never renders inline.
          playsInline
          muted
          autoPlay
        />

        {state.kind === "starting" && (
          <div className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-white">
            <Loader2 className="h-4 w-4 animate-spin" />
            Kamera wird geöffnet
          </div>
        )}

        {state.kind === "scanning" && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-6 top-1/2 h-24 -translate-y-1/2 rounded border-2 border-white/70"
          />
        )}
      </div>

      {state.kind === "error" ? (
        <p className="text-sm text-destructive">{state.message}</p>
      ) : (
        <p className="text-xs text-muted-foreground">
          Halte den Barcode in den Rahmen.
        </p>
      )}

      <Button type="button" variant="outline" size="sm" onClick={onClose}>
        <X className="mr-1 h-4 w-4" />
        Kamera schließen
      </Button>
    </div>
  )
}
