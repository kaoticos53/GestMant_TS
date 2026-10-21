import { useCallback, useState } from "react";
import { toast } from "sonner";
import {
  historyRowsToCsv,
  historyRowsToTsv,
  selectedCellsToTsv,
  type PurchaseHistoryRow,
} from "@/lib/purchasing";

export interface HistoryExportApi {
  isCopied: boolean;
  copyToClipboard: () => Promise<boolean>;
  downloadCsv: (customFilename?: string) => void;
}

/**
 * Hook para exportar filas y celdas del histórico de compras a portapapeles (TSV Excel) o archivo CSV.
 */
export function useHistoryExport(
  rows: readonly PurchaseHistoryRow[],
  selectedCells: ReadonlySet<string>,
): HistoryExportApi {
  const [isCopied, setIsCopied] = useState(false);

  const copyToClipboard = useCallback(async (): Promise<boolean> => {
    if (rows.length === 0) {
      toast.error("No hay datos para copiar");
      return false;
    }

    try {
      let tsv = "";
      let mensaje = "";

      if (selectedCells.size > 0) {
        tsv = selectedCellsToTsv(
          rows as PurchaseHistoryRow[],
          selectedCells as Set<string>,
        );
        const count = selectedCells.size;
        const plural = count === 1 ? "" : "s";
        mensaje = `${count} celda${plural} señalada${plural} copiada${plural} al portapapeles`;
      } else {
        tsv = historyRowsToTsv(rows as PurchaseHistoryRow[]);
        const count = rows.length;
        const plural = count === 1 ? "" : "s";
        mensaje = `Toda la tabla visible (${count} fila${plural}) copiada al portapapeles`;
      }

      await navigator.clipboard.writeText(tsv);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);

      toast.success(mensaje, {
        description:
          "Pégalas directamente en Excel con Ctrl + V para pegarlas en sus celdas correspondientes.",
      });
      return true;
    } catch {
      toast.error("No se pudo copiar al portapapeles");
      return false;
    }
  }, [rows, selectedCells]);

  const downloadCsv = useCallback(
    (customFilename?: string) => {
      if (rows.length === 0) {
        toast.error("No hay filas para exportar");
        return;
      }

      const csv = historyRowsToCsv(rows as PurchaseHistoryRow[]);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const defaultFilename = `historico_compras_${new Date().toISOString().split("T")[0]}.csv`;

      link.href = url;
      link.download = customFilename ?? defaultFilename;
      link.click();
      URL.revokeObjectURL(url);

      toast.success("Archivo CSV generado para Excel");
    },
    [rows],
  );

  return {
    isCopied,
    copyToClipboard,
    downloadCsv,
  };
}
