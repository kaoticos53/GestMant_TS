import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { OrderSolicitudeCodeCardProps } from "../types";

export function OrderSolicitudeCodeCard({
  solicitudeCode,
  canManage,
  editandoSolicitud,
  codigoSolicitud,
  guardandoSolicitud,
  onStartEditing,
  onCancelEditing,
  onChangeCode,
  onSave,
}: OrderSolicitudeCodeCardProps) {
  return (
    <div className="rounded-lg border border-border bg-card p-3 shadow-xs">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
            Solicitud de compra
          </p>
          {!editandoSolicitud && (
            <p className="mt-0.5 text-sm font-semibold">
              {solicitudeCode ? (
                <span className="font-mono text-foreground">
                  {solicitudeCode}
                </span>
              ) : (
                <span className="font-normal italic text-muted-foreground">
                  Sin código asignado
                </span>
              )}
            </p>
          )}
        </div>
        {canManage && !editandoSolicitud && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={onStartEditing}
          >
            {solicitudeCode ? "Modificar" : "Asignar"}
          </Button>
        )}
      </div>
      {editandoSolicitud && (
        <div className="mt-2 flex items-center gap-2">
          <Input
            value={codigoSolicitud}
            onChange={(e) => onChangeCode(e.target.value)}
            placeholder="Ej. 10034573"
            className="h-8 text-sm"
            autoFocus
          />
          <Button
            type="button"
            size="sm"
            className="h-8 px-2.5"
            disabled={guardandoSolicitud}
            onClick={onSave}
          >
            <Check className="size-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-xs"
            onClick={onCancelEditing}
          >
            Cancelar
          </Button>
        </div>
      )}
    </div>
  );
}
