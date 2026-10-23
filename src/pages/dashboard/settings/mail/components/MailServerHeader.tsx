import { Mail } from "lucide-react";

/**
 * Encabezado de la tarjeta de configuración del servidor de correo.
 */
export function MailServerHeader() {
  return (
    <div className="flex items-start gap-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <Mail className="size-4" />
      </span>
      <div className="max-w-2xl">
        <p className="text-sm font-semibold tracking-tight">
          Servidor de correo
        </p>
        <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
          Por dónde salen los avisos de incidencia —al invitado y al taller— y
          el resumen semanal. Puedes seguir con la pasarela de la plataforma o
          apuntarlo a tu propio servicio: aquí se elige, se pone el remitente y
          se guarda su clave. Las claves no se enseñan una vez guardadas; si
          quieres cambiarla, escribe la nueva y se sustituye. Cada envío queda
          apuntado con sus destinatarios y el resultado, también cuando falla.
        </p>
      </div>
    </div>
  );
}
