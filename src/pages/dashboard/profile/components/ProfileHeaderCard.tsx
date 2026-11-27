import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  effectiveUserRoles,
  fallbackRoleMeta,
  roleBadgeClassName,
} from "@/lib/roles";
import { KeyRound, Pencil } from "lucide-react";
import { getUserInitial } from "../helpers";
import type { ProfileHeaderCardProps } from "../types";

/** Ficha personal con avatar, nombre, roles asignados, badges y chips de contacto. */
export function ProfileHeaderCard({
  user,
  roleLabel,
  roleDetails,
  metaChips,
  onEdit,
  onChangePassword,
}: ProfileHeaderCardProps) {
  const initial = getUserInitial(user);
  const effectiveRoles = effectiveUserRoles(user);
  const badges =
    roleDetails && roleDetails.length > 0
      ? roleDetails.map((detail) => ({ key: detail.key, label: detail.label }))
      : effectiveRoles.map((key) => ({
          key,
          label:
            effectiveRoles.length === 1 && roleLabel
              ? roleLabel
              : fallbackRoleMeta(key).label,
        }));

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
              {badges.length > 0 ? (
                badges.map((badge) => (
                  <Badge
                    key={badge.key}
                    variant="outline"
                    className={roleBadgeClassName(badge.key)}
                  >
                    {badge.label}
                  </Badge>
                ))
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
        <div className="flex flex-wrap items-center gap-2">
          {onChangePassword && (
            <Button
              type="button"
              variant="outline"
              className="gap-2"
              onClick={onChangePassword}
            >
              <KeyRound className="size-4" />
              Cambiar contraseña
            </Button>
          )}
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
      </div>
    </section>
  );
}
