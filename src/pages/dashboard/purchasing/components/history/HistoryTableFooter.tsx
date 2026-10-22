export function HistoryTableFooter({
  visibleCount,
  allRowsCount,
  selectedCount,
}: {
  visibleCount: number;
  allRowsCount: number;
  selectedCount: number;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border bg-muted/30 px-4 py-2 text-xs text-muted-foreground">
      <span>
        Mostrando <strong>{visibleCount}</strong> de{" "}
        <strong>{allRowsCount}</strong> líneas de compra
        {selectedCount > 0 && (
          <span className="ml-2 font-medium text-primary">
            ({selectedCount} celdas señaladas)
          </span>
        )}
      </span>
      <span className="italic">
        💡 Haz clic en cualquier celda para señalarla o usa la casilla de la izquierda para filas enteras. Pulsa en las cabeceras para ordenar.
      </span>
    </div>
  );
}
