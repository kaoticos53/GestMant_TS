import { Link } from "react-router";
import { SearchX, Siren, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  INCIDENT_STATUS_META,
  type IncidentStatus,
} from "@/lib/workshop";
import type { IncidentFilterId } from "../types";

export function IncidentsEmptyState({
  search,
  filter,
  onClearSearch,
}: {
  search: string;
  filter: IncidentFilterId;
  onClearSearch: () => void;
}) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center shadow-sm">
      <span className="mx-auto flex size-11 items-center justify-center rounded-xl bg-signal/10 text-signal">
        {search !== "" ? (
          <SearchX className="size-5" />
        ) : (
          <Siren className="size-5" />
        )}
      </span>
      <p className="mt-4 text-base font-semibold tracking-tight">
        {search !== ""
          ? `Ninguna incidencia coincide con «${search}»`
          : filter === "all"
            ? "No hay incidencias notificadas"
            : `No hay incidencias «${INCIDENT_STATUS_META[filter as IncidentStatus].label}»`}
      </p>
      <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-muted-foreground">
        {search !== ""
          ? "Prueba con otra referencia, otro equipo o el nombre del técnico, o limpia la búsqueda."
          : "Cualquier persona del taller puede notificar una incidencia desde el formulario público; aparecerá aquí para asignarla."}
      </p>
      {search !== "" ? (
        <Button
          type="button"
          variant="outline"
          className="mt-5 gap-2"
          onClick={onClearSearch}
        >
          <X className="size-4" />
          Limpiar la búsqueda
        </Button>
      ) : (
        <Button asChild variant="outline" className="mt-5 gap-2">
          <Link to="/reportar" target="_blank">
            <Siren className="size-4" />
            Abrir formulario
          </Link>
        </Button>
      )}
    </div>
  );
}
