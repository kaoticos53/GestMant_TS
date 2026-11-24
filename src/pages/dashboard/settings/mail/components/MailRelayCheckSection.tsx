import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { formatUiError } from "@/lib/workshop";
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
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [showTechnical, setShowTechnical] = useState(false);

  const rawError = checkState && !checkState.ok ? (checkState.error ?? "") : "";
  const safeError = rawError
    ? formatUiError(rawError, {
        fallback: "No se pudo conectar con el servicio de correo.",
      })
    : "La comprobación no salió.";
  const hasTechnicalDetail = Boolean(rawError && rawError !== safeError);

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
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <p
                className={cn(
                  "text-xs leading-5",
                  checkState.ok ? "text-muted-foreground" : "text-destructive",
                )}
              >
                {checkState.ok
                  ? `Se puede entregar: ${checkState.detail ?? "conexión y autenticación correctas"}.`
                  : safeError}
              </p>
              {!checkState.ok && isAdmin && hasTechnicalDetail && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-[11px] text-muted-foreground"
                  onClick={() => setShowTechnical((prev) => !prev)}
                >
                  {showTechnical
                    ? "Ocultar detalle técnico"
                    : "Ver detalle técnico"}
                </Button>
              )}
            </div>
            {!checkState.ok &&
              isAdmin &&
              hasTechnicalDetail &&
              showTechnical && (
                <p className="rounded bg-muted/60 px-2.5 py-2 font-mono text-[11px] leading-relaxed text-muted-foreground break-words">
                  {rawError}
                </p>
              )}
          </div>
        )}
      </div>
    </div>
  );
}
