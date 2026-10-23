/**
 * Estado de carga esqueletal para la vista de usuarios.
 */
export function UsersSkeleton() {
  return (
    <div
      className="rounded-xl border border-border/70 bg-card p-6 shadow-sm"
      aria-busy="true"
      aria-label="Cargando usuarios del taller"
    >
      <div className="h-8 w-40 animate-pulse rounded bg-muted" />
      <div className="mt-4 h-24 rounded-lg bg-muted/60" />
    </div>
  );
}
