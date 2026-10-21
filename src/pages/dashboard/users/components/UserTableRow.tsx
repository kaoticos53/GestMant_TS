import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TableCell, TableRow } from "@/components/ui/table";
import type { Id } from "@/convex/_generated/dataModel";
import { roleBadgeClassName } from "@/lib/roles";
import { Pencil, UserCheck, UserX } from "lucide-react";
import { memo } from "react";
import type { Member, RoleOption } from "../types";

interface UserTableRowProps {
  member: Member;
  isSelf: boolean;
  roleOptions: RoleOption[];
  roleLabelOf: (key: string | null) => string;
  onChangeRole: (userId: Id<"users">, role: string) => void | Promise<void>;
  onEdit: (member: Member) => void;
  onToggleActive: (member: Member) => void | Promise<void>;
}

function cnActive(active: boolean): string {
  return active
    ? "text-muted-foreground hover:text-destructive"
    : "text-muted-foreground hover:text-emerald-700";
}

/**
 * Fila memoizada de usuario en la tabla con avatar, badges, selector de rol y acciones.
 */
export const UserTableRow = memo(function UserTableRow({
  member,
  isSelf,
  roleOptions,
  roleLabelOf,
  onChangeRole,
  onEdit,
  onToggleActive,
}: UserTableRowProps) {
  const role = member.role ?? "technician";

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
            <p className="truncate text-sm font-medium">
              {member.name ?? "Sin nombre"}
              {isSelf && (
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  (tú)
                </span>
              )}
            </p>
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
        <div className="flex items-center justify-start gap-2">
          <Badge variant="outline" className={roleBadgeClassName(role)}>
            {roleLabelOf(member.role)}
          </Badge>
          <Select
            value={role}
            onValueChange={(value) => void onChangeRole(member._id, value)}
            disabled={isSelf}
          >
            <SelectTrigger
              className="h-8 w-32 text-xs"
              aria-label={`Cambiar rol de ${member.email ?? member.name ?? "usuario"}`}
              disabled={isSelf}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {roleOptions.map((option) => (
                <SelectItem key={option.key} value={option.key}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
          {member.active ? "Activo" : "De baja"}
        </Badge>
      </TableCell>
      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-1.5">
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
