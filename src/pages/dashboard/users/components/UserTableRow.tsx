import { DetailTitleButton } from "@/components/DetailTitleButton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TableCell, TableRow } from "@/components/ui/table";
import type { Id } from "@/convex/_generated/dataModel";
import { roleBadgeClassName } from "@/lib/roles";
import { KeyRound, Pencil, UserCheck, UserX } from "lucide-react";
import { memo } from "react";
import { getMemberRoleKeys } from "../helpers";
import type { Member, RoleOption } from "../types";
import { UserRolesPopover } from "./RolesMultiSelect";

export interface UserTableRowProps {
  member: Member;
  isSelf: boolean;
  roleOptions: RoleOption[];
  roleLabelOf: (key: string | null) => string;
  onChangeRoles: (userId: Id<"users">, roles: string[]) => void | Promise<void>;
  onOpenDetail: (member: Member) => void;
  onEdit: (member: Member) => void;
  onToggleActive: (member: Member) => void | Promise<void>;
  onResetPassword?: (member: Member) => void;
}

function cnActive(active: boolean): string {
  return active
    ? "text-muted-foreground hover:text-destructive"
    : "text-muted-foreground hover:text-emerald-700";
}

/**
 * Fila memoizada de usuario en la tabla con avatar, múltiples badges de rol y acciones.
 */
export const UserTableRow = memo(function UserTableRow({
  member,
  isSelf,
  roleOptions,
  roleLabelOf,
  onChangeRoles,
  onOpenDetail,
  onEdit,
  onToggleActive,
  onResetPassword,
}: UserTableRowProps) {
  const memberRoles = getMemberRoleKeys(member);
  const displayRoles =
    memberRoles.length > 0 ? memberRoles : [member.role ?? "technician"];
  const memberDisplayName =
    member.email ?? member.name ?? "usuario";

  return (
    <TableRow className={member.active ? undefined : "opacity-70"}>
      <TableCell>
        <div className="flex items-center gap-3">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-signal/10 text-xs font-semibold text-signal">
            {(member.name ?? member.email ?? "?")
              .trim()
              .charAt(0)
              .toUpperCase() || "?"}
          </span>
          <div className="min-w-0">
            <DetailTitleButton
              onClick={() => onOpenDetail(member)}
              className="text-sm"
            >
              {member.name ?? "Sin nombre"}
              {isSelf && (
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  (tú)
                </span>
              )}
            </DetailTitleButton>
            <p className="truncate text-xs text-muted-foreground">
              {member.email ?? "Sin correo de acceso"}
              {member.isAnonymous && " · invitado"}
            </p>
          </div>
        </div>
      </TableCell>
      <TableCell className="hidden md:table-cell">
        <p className="text-sm">{member.position ?? "—"}</p>
        <p className="text-xs text-muted-foreground">
          {member.location ?? "Sin ubicación"}
        </p>
      </TableCell>
      <TableCell className="hidden sm:table-cell">
        <div className="flex flex-wrap items-center justify-start gap-1.5">
          {displayRoles.map((roleKey) => (
            <Badge
              key={roleKey}
              variant="outline"
              className={roleBadgeClassName(roleKey)}
            >
              {roleLabelOf(roleKey)}
            </Badge>
          ))}
          <UserRolesPopover
            memberRoles={memberRoles}
            roleOptions={roleOptions}
            disabled={isSelf || member.isAnonymous === true}
            memberName={memberDisplayName}
            onSaveRoles={(roles) => onChangeRoles(member._id, roles)}
          />
        </div>
      </TableCell>
      <TableCell className="text-right">
        <Badge
          variant="outline"
          className={
            member.active
              ? "border-emerald-600/25 bg-emerald-600/10 text-emerald-700"
              : "border-destructive/25 bg-destructive/10 text-destructive"
          }
        >
          {member.active ? "Activo" : "Inactivo"}
        </Badge>
      </TableCell>
      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-1.5">
          {!isSelf &&
            member.isAnonymous !== true &&
            Boolean(member.email) &&
            onResetPassword && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8 text-muted-foreground"
                aria-label={`Restablecer contraseña de ${member.name ?? member.email ?? "usuario"}`}
                title="Restablecer contraseña"
                onClick={() => onResetPassword(member)}
              >
                <KeyRound className="size-4" />
              </Button>
            )}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 text-muted-foreground"
            aria-label={`Editar perfil de ${member.name ?? member.email ?? "usuario"}`}
            onClick={() => onEdit(member)}
          >
            <Pencil className="size-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cnActive(member.active)}
            aria-label={
              member.active
                ? `Dar de baja a ${member.name ?? member.email ?? "usuario"}`
                : `Reactivar a ${member.name ?? member.email ?? "usuario"}`
            }
            title={
              isSelf ? "No puedes dar de baja tu propia cuenta" : undefined
            }
            disabled={isSelf}
            onClick={() => void onToggleActive(member)}
          >
            {member.active ? (
              <UserX className="size-4" />
            ) : (
              <UserCheck className="size-4" />
            )}
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
});
