import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DEFAULT_ROLE,
  fallbackRoleMeta,
  roleBadgeClassName,
} from "@/lib/roles";
import { Pencil } from "lucide-react";
import { getUserInitial } from "../helpers";
import type { ProfileHeaderCardProps } from "../types";

/** Ficha personal con avatar, nombre, rol, badges y chips de contacto. */
export function ProfileHeaderCard({
  user,
  roleLabel,
  metaChips,
  onEdit,
}: ProfileHeaderCardProps) {
  const initial = getUserInitial(user);
  const role = user.role ?? DEFAULT_ROLE;

  return (
    <section className="rounded-xl border border-border/70 bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-signal/10 text-xl font-semibold text-signal">
            {initial}
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate text-xl font-semibold tracking-tight">
                {user.name || "Sin nombre"}
              </h2>
              {user.role ? (
                <Badge variant="outline" className={roleBadgeClassName(role)}>
                  {roleLabel ?? fallbackRoleMeta(role).label}
                </Badge>
              ) : (
                <Badge variant="outline" className="text-muted-foreground">
                  Configurando rol...
                </Badge>
              )}
              {user.active === false && (
                <Badge
                  variant="outline"
                  className="border-destructive/25 bg-destructive/10 text-destructive"
                >
                  Cuenta desactivada
                </Badge>
              )}
            </div>
            <p className="mt-0.5 truncate text-sm text-muted-foreground">
              {user.email ??
                (user.isAnonymous ? "Sesión de invitado" : "Sin correo")}
            </p>
            {metaChips.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                {metaChips.map((chip) => (
                  <span
                    key={chip.text}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground"
                  >
                    <chip.icon className="size-3.5" />
                    {chip.text}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          className="gap-2"
          onClick={onEdit}
        >
          <Pencil className="size-4" />
          Editar perfil
        </Button>
      </div>
    </section>
  );
}
