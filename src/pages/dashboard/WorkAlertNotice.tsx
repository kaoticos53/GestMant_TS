import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { Id } from "@/convex/_generated/dataModel";
import type { RoleKey } from "@/lib/roles";
import {
  INCIDENT_STATUS_META,
  alertReachesRole,
  type IncidentStatus,
} from "@/lib/workshop";
import { CircleAlert, X } from "lucide-react";

/**
 * Lo mínimo que necesita el aviso de una incidencia parada. Quién está parado y
 * cuántos días lleva ya lo decidió la regla de trabajo sin constancia
 * (`workWithoutTraceDays`), así que aquí solo hace falta enseñarlo. Es el mismo
 * criterio que el de las reglas del archivo: interfaces estrechas que el
 * documento completo cumple sin tener que fabricar uno entero para probarlas.
 */
export interface StaleWorkEntry {
  incident: {
    _id: Id<"incidents">;
    reference: string;
    status: IncidentStatus;
    assigneeName?: string;
  };
  days: number;
}

/**
 * Aviso de trabajo sin constancia: las incidencias que llevan días en curso sin
 * que quien las trabaja haya anotado nada. Cada referencia abre su ficha y
 * desde aquí se ajusta el margen y la audiencia.
 *
 * El reparto lo decide el propio aviso: manda la lista guardada, no el rol ni
 * los permisos. Un rol que coordina pero no está en la audiencia no lo ve, y
 * uno que no coordina sí, si quien coordina lo añadió. Abrir la ficha que
 * señala sigue dependiendo de los permisos de cada rol. Sin audiencia, sin
 * trabajo parado o con el aviso ya cerrado, no se pinta nada.
 */
export function WorkAlertNotice({
  role,
  audience,
  days,
  staleWork,
  dismissed = false,
  canOpenSettings = false,
  onOpenIncident,
  onOpenSettings,
  onDismiss,
}: {
  /** Rol de quien está mirando: decide si el aviso le toca. */
  role: RoleKey | null | undefined;
  /** Roles destinatarios configurados en «Ajustes del taller». */
  audience: readonly RoleKey[];
  /** Margen configurado, en días (es lo que cuenta el texto). */
  days: number;
  /** Trabajo en curso sin constancia, de lo más parado a lo menos. */
  staleWork: readonly StaleWorkEntry[];
  /** Si esta persona ya lo cerró para este trabajo y este margen. */
  dismissed?: boolean;
  /** ¿Puede ajustar el aviso? Solo entonces se enseña el enlace. */
  canOpenSettings?: boolean;
  onOpenIncident: (id: Id<"incidents">) => void;
  onOpenSettings: () => void;
  onDismiss: () => void;
}) {
  if (dismissed) return null;
  if (staleWork.length === 0) return null;
  if (!alertReachesRole(role, audience)) return null;

  return (
    <Alert variant="destructive" className="relative mt-6 pr-10">
      <CircleAlert />
      <AlertTitle>
        {staleWork.length === 1
          ? "Una incidencia lleva días en curso sin que su técnico anote nada"
          : `${staleWork.length} incidencias llevan días en curso sin que su técnico anote nada`}
      </AlertTitle>
      <AlertDescription>
        Llevan {days} {days === 1 ? "día" : "días"} o más en curso y quien las
        lleva ahora no ha escrito ninguna nota en el cuaderno: puede que se
        estén trabajando sin dejar constancia.
        <ul className="mt-2 flex flex-col gap-1">
          {staleWork.slice(0, 3).map(({ incident, days: staleDays }) => (
            <li
              key={incident._id}
              className="flex flex-wrap items-center gap-x-2 gap-y-1"
            >
              <Button
                type="button"
                variant="link"
                size="sm"
                className="h-auto p-0 font-mono text-xs"
                onClick={() => onOpenIncident(incident._id)}
                title={`Abrir ${incident.reference}`}
              >
                {incident.reference}
              </Button>
              <span className="text-xs">
                {INCIDENT_STATUS_META[incident.status].label}
                {incident.assigneeName ? ` · ${incident.assigneeName}` : ""}
                {` · ${staleDays} ${staleDays === 1 ? "día" : "días"} en curso`}
              </span>
            </li>
          ))}
        </ul>
        {staleWork.length > 3 && (
          <span className="mt-1 block text-xs">
            Y {staleWork.length - 3} más esperando en la cola.
          </span>
        )}
        {canOpenSettings && (
          <Button
            type="button"
            variant="link"
            size="sm"
            className="mt-2 h-auto p-0 text-xs"
            onClick={onOpenSettings}
          >
            Ajustar el margen y a quién le avisa
          </Button>
        )}
      </AlertDescription>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="absolute right-1.5 top-1.5 size-7 text-destructive/70 hover:bg-destructive/10 hover:text-destructive"
        aria-label="Cerrar el aviso de trabajo sin constancia"
        title="Cerrar el aviso (puedes volver a mostrarlo desde la cabecera)"
        onClick={onDismiss}
      >
        <X className="size-4" />
      </Button>
    </Alert>
  );
}
