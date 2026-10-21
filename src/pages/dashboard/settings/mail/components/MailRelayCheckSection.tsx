import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PlugZap } from "lucide-react";
import type { MailCheckState } from "../types";

export interface MailRelayCheckSectionProps {
  checking: boolean;
  saving: boolean;
  checkState: MailCheckState | null;
  onCheck: () => void;
}

export function MailRelayCheckSection({
  checking,
  saving,
  checkState,
  onCheck,
}: MailRelayCheckSectionProps) {
  return (
    <div className="mt-4 rounded-lg border border-dashed border-border px-3 py-3">
      <p className="flex items-center gap-1.5 text-sm font-medium">
        <PlugZap className="size-4" /> Comprobar la conexión
      </p>
      <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
        Se hace sola al abrir este panel y cada vez que se guarda. Con lo que
        está guardado, le pide al relevo que se conecte y se autentique contra el
        servidor de correo, <strong>sin mandar ningún correo</strong>: ni sale un
        mensaje ni se toca ningún buzón. Sirve para saber si la contraseña es la
        buena —o si el puerto está abierto— antes de mandar la prueba.
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="outline"
          className="gap-2"
          disabled={checking || saving}
          onClick={onCheck}
        >
          <PlugZap className="size-4" />
          {checking ? "Comprobando..." : "Comprobar ahora"}
        </Button>
        {checkState !== null && (
          <p
            className={cn(
              "text-xs leading-5",
              checkState.ok ? "text-muted-foreground" : "text-destructive",
            )}
          >
            {checkState.ok
              ? `Se puede entregar: ${checkState.detail ?? "conexión y autenticación correctas"}.`
              : (checkState.error ?? "La comprobación no salió.")}
          </p>
        )}
      </div>
    </div>
  );
}
