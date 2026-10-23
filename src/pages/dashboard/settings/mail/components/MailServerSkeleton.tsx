import { Skeleton } from "@/components/ui/skeleton";

/**
 * Estado de carga esqueletal para la tarjeta del servidor de correo.
 */
export function MailServerSkeleton() {
  return (
    <div
      className="mt-4 grid gap-2"
      aria-busy="true"
      aria-label="Cargando configuración de correo"
    >
      <Skeleton className="h-11 rounded-lg" />
      <Skeleton className="h-24 rounded-lg" />
    </div>
  );
}
