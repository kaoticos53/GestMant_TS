import { useEffect, useRef, useState } from "react";
import {
  cleanScannedCode,
  createBarcodeDetector,
  triggerScanHapticFeedback,
} from "./helpers";
import type { BarcodeDetectorInstance } from "./types";

export interface UseBarcodeScannerStreamParams {
  open: boolean;
  onScan: (code: string) => void;
  onClose: () => void;
}

export function useBarcodeScannerStream({
  open,
  onScan,
  onClose,
}: UseBarcodeScannerStreamParams) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [hasCamera, setHasCamera] = useState<boolean>(true);
  const [torchOn, setTorchOn] = useState<boolean>(false);
  const [hasTorch, setHasTorch] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
      await (
        track as MediaStreamTrack & {
          applyConstraints: (c: unknown) => Promise<void>;
        }
      ).applyConstraints({
        advanced: [{ torch: nextState }],
      });
      setTorchOn(nextState);
    } catch {
      // Ignorar si el hardware rechaza la orden
    }
  };

  useEffect(() => {
    // Al cerrar no hay nada que parar aquí: la limpieza del efecto anterior ya
    // detuvo la cámara y apagó la linterna.
    if (!open) return;

    let active = true;
    const detector: BarcodeDetectorInstance | null = createBarcodeDetector();
    let animationFrameId: number;

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
        const capabilities = track?.getCapabilities?.() as
          | { torch?: boolean }
          | undefined;
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
                const code = cleanScannedCode(barcodes[0].rawValue);
                if (code) {
                  triggerScanHapticFeedback();
                  onScan(code);
                  onClose();
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
  }, [open, onScan, onClose]);

  return {
    videoRef,
    hasCamera,
    hasTorch,
    torchOn,
    errorMessage,
    toggleTorch,
  };
}
