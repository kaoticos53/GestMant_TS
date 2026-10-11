import { CircleAlert } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useApiAddress } from "@/hooks/use-api-address";
import type { ApiAddressTrouble } from "@/lib/apiAddress";

/**
 * El aviso de la dirección pública de la API, al arrancar la app.
 *
 * Cuando esa dirección no responde desde el navegador, la app arranca y no llega
 * a nada: se queda cargando, o devuelve a la pantalla de entrada una y otra vez.
 * Sin una explicación, eso se parece demasiado a «el taller está roto», y lo que
 * pasa es una de tres cosas muy concretas —el proxy inverso sin el WebSocket, una
 * dirección `http://` dentro de una página `https://`, o una dirección que no
 * resuelve desde aquí—, todas contadas en la guía del NAS.
 *
 * Por eso vive en el armazón de la app y no dentro del panel: quien se queda
 * fuera es justamente quien no llega al panel. Lo decide `lib/apiAddress` y lo
 * alimenta `use-api-address`; aquí solo se enseña, con la dirección delante y un
 * «Volver a comprobar» para no tener que recargar la página entera.
 *
 * No se cierra a mano: en cuanto la app habla con la API, el aviso se va solo, y
 * mientras no hable no hay nada mejor que decir.
 */
export function ApiAddressNotice() {
  const { trouble, recheck } = useApiAddress();
  return <ApiAddressAlert trouble={trouble} onRecheck={recheck} />;
}

/**
 * El aviso en sí, con lo que hay que contar ya decidido: se separa del enganche
 * para poder pintarlo (y probarlo) con una avería puesta a mano, sin tener que
 * levantar media app para que la dirección falle de verdad.
 */
export function ApiAddressAlert({
  trouble,
  onRecheck,
}: {
  /** Lo que se sabe de la dirección, o `null` si no hay nada que decir. */
  trouble: ApiAddressTrouble | null;
  /** Volver a preguntarle a la dirección, sin recargar nada. */
  onRecheck: () => void;
}) {
  if (!trouble) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center px-3 pt-3">
      <Alert
        variant="destructive"
        className="pointer-events-auto max-w-3xl border-destructive/40 bg-card shadow-lg"
      >
        <CircleAlert />
        <AlertTitle>
          No se puede hablar con la API del taller · {trouble.reason}
        </AlertTitle>
        <AlertDescription>
          <p>{trouble.detail}</p>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-mono text-[11px] break-all">
              {trouble.address}
            </span>
            <Button
              type="button"
              variant="link"
              size="sm"
              className="h-auto px-0 text-xs font-medium text-destructive"
              onClick={onRecheck}
            >
              Volver a comprobar
            </Button>
          </p>
        </AlertDescription>
      </Alert>
    </div>
  );
}
