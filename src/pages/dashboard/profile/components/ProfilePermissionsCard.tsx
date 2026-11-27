import { ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { CAPABILITIES, type Capability } from "@/lib/permissions";

export interface ProfilePermissionsCardProps {
  grants?: Partial<Record<Capability, boolean>>;
}

/**
 * Tarjeta de solo lectura que muestra todas las capacidades activas del usuario
 * agrupadas por módulo, resolviendo el conjunto efectivo de sus roles.
 */
export function ProfilePermissionsCard({
  grants,
}: ProfilePermissionsCardProps) {
  const groups = [...new Set(CAPABILITIES.map((c) => c.group))]
    .map((group) => ({
      group,
      items: CAPABILITIES.filter(
        (cap) => cap.group === group && grants?.[cap.id] === true,
      ),
    }))
    .filter((entry) => entry.items.length > 0);

  const activeCount = groups.reduce((acc, g) => acc + g.items.length, 0);

  return (
    <section className="rounded-xl border border-border/70 bg-card shadow-sm">
      <header className="flex items-center justify-between gap-2 border-b border-border/70 px-4 py-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <ShieldCheck className="size-4 text-signal" />
          Mis permisos efectivos
        </h3>
        <span className="text-xs text-muted-foreground tabular-nums">
          {activeCount === 1
            ? "1 capacidad activa"
            : `${activeCount} capacidades activas`}
        </span>
      </header>
      {groups.length === 0 ? (
        <p className="px-4 py-6 text-sm text-muted-foreground">
          {grants === undefined
            ? "Cargando permisos efectivos..."
            : "No tienes capacidades asignadas en este momento."}
        </p>
      ) : (
        <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map(({ group, items }) => (
            <div
              key={group}
              className="rounded-lg border border-border/60 bg-muted/20 p-3"
            >
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {group}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {items.map((cap) => (
                  <Badge
                    key={cap.id}
                    variant="secondary"
                    title={cap.description}
                    className="font-normal"
                  >
                    {cap.label}
                  </Badge>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
