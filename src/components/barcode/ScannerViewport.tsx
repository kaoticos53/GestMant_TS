import { Flashlight } from "lucide-react";
import type { ScannerViewportProps } from "./types";

export function ScannerViewport({
  videoRef,
  hasTorch,
  torchOn,
  onToggleTorch,
}: ScannerViewportProps) {
  return (
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
          onClick={onToggleTorch}
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
  );
}
