import { ClipboardList } from "lucide-react";

export function OrdersEmptyState() {
  return (
    <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center shadow-sm">
      <span className="mx-auto flex size-11 items-center justify-center rounded-xl bg-signal/10 text-signal">
        <ClipboardList className="size-5" />
      </span>
      <p className="mt-4 text-base font-semibold tracking-tight">
        Todavía no hay órdenes de compra
      </p>
      <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-muted-foreground">
        Se montan a mano desde «Sin tratar»: eliges lo que va al mismo proveedor
        y la orden sale con su número y su fecha.
      </p>
    </div>
  );
}
