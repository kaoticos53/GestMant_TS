import { Users } from "lucide-react";

export function MailAudienceHeader() {
  return (
    <div className="flex items-start gap-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <Users className="size-4" />
      </span>
      <div className="max-w-2xl">
        <p className="text-sm font-semibold tracking-tight">
          Avisos por correo por rol
        </p>
        <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
          Quién recibe cada correo del taller, con los cuatro tipos que salen de
          aquí: el <strong>aviso a quien notificó</strong>, el{" "}
          <strong>aviso interno de incidencia</strong> —cuando entra, cuando se
          asigna, también si alguien se la lleva, y cuando se cierra—, el{" "}
          <strong>resumen semanal</strong> y la{" "}
          <strong>prueba de envío</strong>. Los dos del medio se reparten por
          rol; los otros dos tienen destinatario fijo y se enseñan aquí para que
          la matriz no deje ningún correo fuera.
        </p>
      </div>
    </div>
  );
}
