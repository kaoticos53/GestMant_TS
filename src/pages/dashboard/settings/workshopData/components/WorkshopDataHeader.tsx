import { Database } from "lucide-react";

export function WorkshopDataHeader() {
  return (
    <div className="flex items-start gap-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <Database className="size-4" />
      </span>
      <div className="max-w-xl">
        <p className="text-sm font-semibold tracking-tight">
          Datos del taller
        </p>
        <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
          La muestra de ejemplo es para probar el flujo completo: trae un
          catálogo de repuestos, equipos, incidencias y peticiones ya
          repartidas. Un taller de verdad no la necesita —basta con dejar el
          taller vacío y dar de alta lo suyo—, y si ya se cargó por error, se
          puede vaciar para empezar de cero. «Compras de ejemplo» añade aparte
          la otra mitad: peticiones sin tratar de varios proveedores, órdenes
          a medio recibir y albaranes con los que recepcionar.
        </p>
      </div>
    </div>
  );
}
