import { FileSpreadsheet } from "lucide-react";

export function HistoryEmptyState() {
  return (
    <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center shadow-xs">
      <span className="mx-auto flex size-11 items-center justify-center rounded-xl bg-signal/10 text-signal">
        <FileSpreadsheet className="size-5" />
      </span>
      <p className="mt-4 text-base font-semibold tracking-tight">
        No hay compras en el histórico
      </p>
      <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-muted-foreground">
        A medida que crees órdenes de compra y les asignes códigos de solicitud,
        se irán registrando aquí en formato tipo hoja de cálculo listo para copiar o exportar.
      </p>
    </div>
  );
}
