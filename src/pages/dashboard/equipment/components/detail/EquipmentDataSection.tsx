import { Button } from "@/components/ui/button";
import { RichText } from "@/components/RichText";
import { formatDate } from "@/lib/workshop";
import { FileDown } from "lucide-react";
import type { EquipmentDoc } from "../../types";

interface EquipmentDataSectionProps {
  item: EquipmentDoc;
  exporting: boolean;
  onExport: () => void | Promise<void>;
}

/**
 * Sección de descripción y especificaciones técnicas de la ficha del equipo,
 * con opción de descarga de informe en PDF.
 */
export function EquipmentDataSection({
  item,
  exporting,
  onExport,
}: EquipmentDataSectionProps) {
  return (
    <>
      {item.description && (
        <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Descripción
          </p>
          <RichText value={item.description} className="mt-1.5" />
        </div>
      )}

      <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Ficha del equipo
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            disabled={exporting}
            title="Descargar la ficha con sus manuales, sus intervenciones y sus peticiones"
            onClick={() => void onExport()}
          >
            <FileDown className="size-4" />
            {exporting ? "Preparando..." : "Exportar ficha en PDF"}
          </Button>
        </div>
        <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          <div>
            <dt className="text-xs text-muted-foreground">Nº de serie</dt>
            <dd className="font-mono">{item.serialNumber ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Proveedor</dt>
            <dd>{item.supplier ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Fecha de alta</dt>
            <dd>{item.purchaseDate ? formatDate(item.purchaseDate) : "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Fin de garantía</dt>
            <dd>
              {item.warrantyEndDate ? formatDate(item.warrantyEndDate) : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Fecha de baja</dt>
            <dd>
              {item.decommissionDate
                ? formatDate(item.decommissionDate)
                : "—"}
            </dd>
          </div>
        </dl>
      </div>
    </>
  );
}
