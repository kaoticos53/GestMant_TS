import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { EquipmentLabelExtraction } from "@/lib/ai";
import { Check, ChevronDown, ChevronUp, Sparkles, Undo2 } from "lucide-react";
import { useState } from "react";

interface LabelInlineBannerProps {
  open: boolean;
  imageDataUrl: string | null;
  extraction: EquipmentLabelExtraction | null;
  selectedModel?: string;
  onSelectAlternative: (model: string) => void;
  onConfirm: () => void;
  onUndo: () => void;
}

export function LabelInlineBanner({
  open,
  imageDataUrl,
  extraction,
  selectedModel,
  onSelectAlternative,
  onConfirm,
  onUndo,
}: LabelInlineBannerProps) {
  const [showPhoto, setShowPhoto] = useState(false);

  if (!open || !extraction) {
    return null;
  }

  return (
    <div className="space-y-2.5 rounded-lg border border-primary/30 bg-primary/5 p-3 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 font-medium text-foreground">
          <Sparkles className="size-3.5 text-primary" />
          <span>Detectado por IA · Verificar</span>
        </div>
        <Badge variant="outline" className="text-[11px]">
          {extraction.confidence === "high"
            ? "Confianza alta"
            : extraction.confidence === "medium"
              ? "Confianza media"
              : "Confianza baja"}
        </Badge>
      </div>

      {extraction.evidence && (
        <p className="font-mono text-[11px] text-muted-foreground break-words">
          {extraction.evidence}
        </p>
      )}

      {extraction.alternatives.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] text-muted-foreground">Alternativas:</span>
          {extraction.alternatives.map((alt) => (
            <Button
              key={alt}
              type="button"
              size="sm"
              variant={selectedModel === alt ? "default" : "outline"}
              className="h-6 px-2 font-mono text-[11px]"
              onClick={() => onSelectAlternative(alt)}
            >
              {alt}
            </Button>
          ))}
        </div>
      )}

      {imageDataUrl && (
        <div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 px-1.5 text-[11px]"
            onClick={() => setShowPhoto((prev) => !prev)}
          >
            {showPhoto ? (
              <ChevronUp className="mr-1 size-3.5" />
            ) : (
              <ChevronDown className="mr-1 size-3.5" />
            )}
            {showPhoto ? "Ocultar foto" : "Ver foto"}
          </Button>
          {showPhoto && (
            <img
              src={imageDataUrl}
              alt="Miniatura de etiqueta"
              className="mt-1.5 max-h-40 rounded border object-contain"
            />
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button type="button" size="sm" variant="outline" onClick={onUndo}>
          <Undo2 className="mr-1 size-3.5" />
          Deshacer
        </Button>
        <Button type="button" size="sm" onClick={onConfirm}>
          <Check className="mr-1 size-3.5" />
          Confirmar
        </Button>
      </div>
    </div>
  );
}
