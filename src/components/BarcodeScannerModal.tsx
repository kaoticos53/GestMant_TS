import * as React from "react";
import { Camera, Flashlight, ScanLine } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Button } from "./ui/button";

interface DetectedBarcode {
  rawValue: string;
  format: string;
}

interface BarcodeDetectorInstance {
  detect(source: ImageBitmapSource): Promise<DetectedBarcode[]>;
}

interface BarcodeDetectorConstructor {
  new (options?: { formats: string[] }): BarcodeDetectorInstance;
  getSupportedFormats?: () => Promise<string[]>;
}

export interface BarcodeScannerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onScan: (code: string) => void;
  title?: string;
  description?: string;
}

export function BarcodeScannerModal({
  open,
  onOpenChange,
  onScan,
  title = "Escanear Código QR / Barras",
  description = "Apunta la cámara al código del equipo, repuesto o referencia.",
}: BarcodeScannerModalProps) {
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const [hasCamera, setHasCamera] = React.useState<boolean>(true);
  const [torchOn, setTorchOn] = React.useState<boolean>(false);
  const [hasTorch, setHasTorch] = React.useState<boolean>(false);
  const [manualCode, setManualCode] = React.useState<string>("");
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  // Iniciar cámara y detector
  React.useEffect(() => {
    if (!open) {
      stopCamera();
      return;
    }

    let active = true;
    let detector: BarcodeDetectorInstance | null = null;
    let animationFrameId: number;

    const BarcodeDetectorClass = (window as unknown as { BarcodeDetector?: BarcodeDetectorConstructor })
      .BarcodeDetector;

    if (BarcodeDetectorClass) {
      try {
        detector = new BarcodeDetectorClass({
          formats: ["qr_code", "code_128", "code_39", "ean_13", "ean_8", "data_matrix"],
        });
      } catch {
        detector = null;
      }
    }

    async function startCamera() {
      try {
        setErrorMessage(null);
        if (!navigator.mediaDevices?.getUserMedia) {
          setHasCamera(false);
          return;
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 } },
          audio: false,
        });

        if (!active) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }

        // Detectar si la pista tiene soporte de linterna (torch)
        const track = stream.getVideoTracks()[0];
        const capabilities = track?.getCapabilities?.() as { torch?: boolean } | undefined;
        setHasTorch(Boolean(capabilities?.torch));

        setHasCamera(true);

        // Bucle de detección continua
        const scanLoop = async () => {
          if (!active || !videoRef.current || videoRef.current.readyState < 2) {
            if (active) animationFrameId = requestAnimationFrame(scanLoop);
            return;
          }

          if (detector) {
            try {
              const barcodes = await detector.detect(videoRef.current);
              if (barcodes.length > 0 && barcodes[0].rawValue) {
                const code = barcodes[0].rawValue.trim();
                if (code) {
                  try {
                    navigator.vibrate?.([40, 30, 40]);
                  } catch {
                    // Ignorar si no hay soporte de vibración
                  }
                  onScan(code);
                  onOpenChange(false);
                  return;
                }
              }
            } catch {
              // Si falla la detección en este fotograma, continuar al siguiente
            }
          }

          if (active) {
            animationFrameId = requestAnimationFrame(scanLoop);
          }
        };

        animationFrameId = requestAnimationFrame(scanLoop);
      } catch (err: unknown) {
        if (!active) return;
        setHasCamera(false);
        setErrorMessage(
          err instanceof Error
            ? err.message
            : "No se pudo acceder a la cámara del dispositivo.",
        );
      }
    }

    startCamera();

    return () => {
      active = false;
      cancelAnimationFrame(animationFrameId);
      stopCamera();
    };
  }, [open, onScan, onOpenChange]);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setTorchOn(false);
  };

  const toggleTorch = async () => {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    if (!track) return;

    try {
      const nextState = !torchOn;
      await (track as MediaStreamTrack & {
        applyConstraints: (c: unknown) => Promise<void>;
      }).applyConstraints({
        advanced: [{ torch: nextState }],
      });
      setTorchOn(nextState);
    } catch {
      // Ignorar si el hardware rechaza la orden
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = manualCode.trim();
    if (trimmed) {
      onScan(trimmed);
      setManualCode("");
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 overflow-hidden sm:rounded-2xl">
        <DialogHeader className="p-4 pb-2 border-b">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2 text-base font-semibold">
              <ScanLine className="size-5 text-primary animate-pulse" />
              {title}
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            {description}
          </DialogDescription>
        </DialogHeader>

        {/* Visor de Cámara */}
        <div className="relative aspect-square w-full bg-black flex items-center justify-center overflow-hidden">
          {hasCamera ? (
            <>
              <video
                ref={videoRef}
                playsInline
                muted
                className="w-full h-full object-cover"
              />

              {/* Retícula de escaneo tipo industrial */}
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-8">
                <div className="relative size-56 sm:size-64 rounded-2xl border-2 border-primary/40">
                  {/* Esquinas destacadas */}
                  <div className="absolute -top-1 -left-1 size-6 border-t-4 border-l-4 border-primary rounded-tl-lg" />
                  <div className="absolute -top-1 -right-1 size-6 border-t-4 border-r-4 border-primary rounded-tr-lg" />
                  <div className="absolute -bottom-1 -left-1 size-6 border-b-4 border-l-4 border-primary rounded-bl-lg" />
                  <div className="absolute -bottom-1 -right-1 size-6 border-b-4 border-r-4 border-primary rounded-br-lg" />

                  {/* Línea láser de escaneo animada */}
                  <div className="absolute inset-x-2 top-0 h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_12px_rgba(52,211,153,0.8)] animate-pulse" />
                </div>
              </div>

              {/* Botón linterna si está disponible */}
              {hasTorch && (
                <button
                  type="button"
                  onClick={toggleTorch}
                  className={`absolute top-4 right-4 p-2.5 rounded-full backdrop-blur-md transition-colors ${
                    torchOn
                      ? "bg-amber-400 text-black shadow-lg"
                      : "bg-black/60 text-white hover:bg-black/80"
                  }`}
                  aria-label="Alternar linterna"
                >
                  <Flashlight className="size-5" />
                </button>
              )}
            </>
          ) : (
            <div className="p-6 text-center text-zinc-300 flex flex-col items-center gap-3">
              <Camera className="size-10 text-muted-foreground opacity-50" />
              <p className="text-sm font-medium">Cámara no disponible</p>
              <p className="text-xs text-muted-foreground max-w-xs">
                {errorMessage ||
                  "No se detecta un sensor de cámara o se han denegado los permisos del navegador."}
              </p>
            </div>
          )}
        </div>

        {/* Input manual de respaldo para planta / pistola de código de barras USB */}
        <form onSubmit={handleManualSubmit} className="p-4 bg-muted/40 border-t flex flex-col gap-2">
          <label htmlFor="manual-scan-input" className="text-xs font-medium text-muted-foreground">
            O introduce/pega el código manualmente o mediante lector USB:
          </label>
          <div className="flex gap-2">
            <input
              id="manual-scan-input"
              type="text"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              placeholder="Ej. EQ-CAM-0042 o REP-001..."
              className="flex-1 h-9 px-3 rounded-lg border border-border bg-background text-sm outline-none focus:ring-2 focus:ring-primary"
            />
            <Button type="submit" size="sm" disabled={!manualCode.trim()}>
              Aceptar
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
