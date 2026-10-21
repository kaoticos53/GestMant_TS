import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/utils";
import { formatDateTime, getErrorMessage } from "@/lib/workshop";
import { useAction } from "convex/react";
import { Send } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

export interface MailTestSendSectionProps {
  defaultToEmail?: string;
  lastTestAt: number | null;
  lastTestOk: boolean | null;
  lastTestTo: string | null;
  lastTestError: string | null;
}

export function MailTestSendSection({
  defaultToEmail = "",
  lastTestAt,
  lastTestOk,
  lastTestTo,
  lastTestError,
}: MailTestSendSectionProps) {
  const sendTest = useAction(api.mailSettings.sendTest);
  const [testTo, setTestTo] = useState(defaultToEmail);
  const [testing, setTesting] = useState(false);

  const seeded = useRef(false);
  useEffect(() => {
    if (seeded.current || !defaultToEmail) return;
    seeded.current = true;
    setTestTo(defaultToEmail);
  }, [defaultToEmail]);

  const handleTest = async () => {
    const to = testTo.trim() === "" ? defaultToEmail.trim() : testTo.trim();
    if (!to) return;
    setTesting(true);
    try {
      const result = await sendTest({ to });
      if (result.ok) {
        toast.success(`Correo de prueba enviado a ${to}`);
      } else {
        toast.error(result.error ?? "El envío de prueba no salió");
      }
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="mt-4 rounded-lg border border-dashed border-border px-3 py-3">
      <p className="flex items-center gap-1.5 text-sm font-medium">
        <Send className="size-4" /> Probar el envío
      </p>
      <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
        Manda un correo de prueba ahora, con lo guardado, a la dirección que
        escribas. No toca ninguna incidencia ni entra en el resumen.
      </p>
      <div className="mt-2 flex flex-wrap items-end gap-2">
        <div className="grid min-w-[14rem] flex-1 gap-1.5 sm:max-w-sm">
          <Label htmlFor="ajustes-correo-prueba" className="text-xs">
            Dirección de la prueba
          </Label>
          <Input
            id="ajustes-correo-prueba"
            type="email"
            value={testTo}
            maxLength={200}
            disabled={testing}
            onChange={(event) => setTestTo(event.target.value)}
            placeholder="tu-correo@taller.es"
          />
        </div>
        <Button
          type="button"
          variant="outline"
          className="gap-2"
          disabled={testing || testTo.trim() === ""}
          onClick={() => void handleTest()}
        >
          <Send className="size-4" />
          {testing ? "Enviando..." : "Enviar prueba"}
        </Button>
      </div>
      {lastTestAt !== null && (
        <p
          className={cn(
            "mt-2 text-xs leading-5",
            lastTestOk ? "text-muted-foreground" : "text-destructive",
          )}
        >
          {lastTestOk
            ? `Última prueba correcta: ${formatDateTime(lastTestAt)} a ${lastTestTo ?? "—"}.`
            : `La última prueba falló el ${formatDateTime(
                lastTestAt,
              )}: ${lastTestError ?? "sin motivo apuntado"}`}
        </p>
      )}
    </div>
  );
}
