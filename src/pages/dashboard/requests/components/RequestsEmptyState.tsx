import { Check, ClipboardList, Plus, SearchX, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { EquipmentDoc, RequestFilterId } from "../types";

export function RequestsEmptyState({
  search,
  filter,
  emptyByEquipment,
  filterEquipment,
  onClearSearch,
  onNewRequest,
}: {
  search: string;
  filter: RequestFilterId;
  emptyByEquipment: boolean;
  filterEquipment: EquipmentDoc | undefined;
  onClearSearch: () => void;
  onNewRequest: () => void;
}) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center shadow-sm">
      <span className="mx-auto flex size-11 items-center justify-center rounded-xl bg-signal/10 text-signal">
        {search !== "" ? (
          <SearchX className="size-5" />
        ) : filter === "pending" && !emptyByEquipment ? (
          <Check className="size-5" />
        ) : (
          <ClipboardList className="size-5" />
        )}
      </span>
      <p className="mt-4 text-base font-semibold tracking-tight">
        {search !== ""
          ? `Ninguna petición coincide con «${search}»`
          : emptyByEquipment
            ? `No hay peticiones de ${filterEquipment?.model ?? "ese equipo"}`
            : filter === "pending"
              ? "No hay peticiones pendientes"
              : "No hay peticiones en este estado"}
      </p>
      <p className="mx-auto mt-1 max-w-sm text-sm leading-6 text-muted-foreground">
        {search !== ""
          ? "Prueba con otra referencia, un repuesto o el nombre de quien la pide, o limpia la búsqueda."
          : emptyByEquipment
            ? "Ninguna petición coincide con este equipo. Prueba con otro o quita el filtro."
            : filter === "pending"
              ? "La cola está al día: no hay nada que revisar ahora mismo."
              : "Cambia de filtro o registra una petición de repuestos."}
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
        <Button
          type="button"
          variant="outline"
          className="mt-5 gap-2"
          onClick={onNewRequest}
        >
          <Plus className="size-4" />
          Nueva petición
        </Button>
      )}
    </div>
  );
}
