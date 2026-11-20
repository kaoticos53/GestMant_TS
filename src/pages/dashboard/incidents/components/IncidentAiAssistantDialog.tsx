import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/convex/_generated/api";
import type { IncidentQaAnswer } from "@/lib/ai";
import { getErrorMessage } from "@/lib/workshop";
import { useAction } from "convex/react";
import { Loader2, Send, Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const EXAMPLE_QUESTIONS = [
  "¿Qué modelos acumulan más incidencias abiertas o repetidas?",
  "Resume las incidencias resueltas recientemente y sus soluciones",
  "¿Hay algún equipo con problemas recurrentes de alimentación o señal?",
];

interface IncidentAiAssistantDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenIncident: (reference: string) => void;
}

export function IncidentAiAssistantDialog({
  open,
  onOpenChange,
  onOpenIncident,
}: IncidentAiAssistantDialogProps) {
  const askIncidents = useAction(api.ai.askIncidents);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<IncidentQaAnswer | null>(null);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const trimmed = question.trim();
    if (!trimmed || loading) return;

    setLoading(true);
    try {
      const response = await askIncidents({ question: trimmed });
      setResult(response);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-4 text-primary" />
            Asistente IA del historial de incidencias
          </DialogTitle>
          <DialogDescription>
            Haz preguntas en lenguaje natural sobre las incidencias del taller.
            Las respuestas citan únicamente referencias verificadas del historial.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="incident-ai-question">Tu consulta</Label>
            <Textarea
              id="incident-ai-question"
              rows={3}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ej. ¿Qué averías repetidas hemos tenido en cámaras o fuentes?"
              disabled={loading}
            />
          </div>

          <div className="flex flex-wrap gap-1.5">
            {EXAMPLE_QUESTIONS.map((sample) => (
              <Button
                key={sample}
                type="button"
                variant="outline"
                size="sm"
                className="h-auto py-1 text-left text-[11px] font-normal whitespace-normal"
                disabled={loading}
                onClick={() => setQuestion(sample)}
              >
                {sample}
              </Button>
            ))}
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={loading || !question.trim()}>
              {loading ? (
                <Loader2 className="mr-1.5 size-4 animate-spin" />
              ) : (
                <Send className="mr-1.5 size-4" />
              )}
              Consultar historial
            </Button>
          </div>
        </form>

        {result && (
          <div className="space-y-3 rounded-lg border bg-muted/30 p-4 text-sm">
            <p className="whitespace-pre-wrap leading-relaxed">{result.answer}</p>
            {result.citedReferences.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 border-t pt-2.5">
                <span className="text-xs font-medium text-muted-foreground">
                  Incidencias citadas:
                </span>
                {result.citedReferences.map((ref) => (
                  <Button
                    key={ref}
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="h-6 px-2 font-mono text-xs"
                    onClick={() => onOpenIncident(ref)}
                  >
                    {ref}
                  </Button>
                ))}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
