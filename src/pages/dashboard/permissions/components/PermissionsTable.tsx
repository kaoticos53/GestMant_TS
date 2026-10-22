import { Fragment, useMemo } from "react";
import { Copy, Lock, Pencil, Trash2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CAPABILITIES, type Capability, type CapabilityMeta } from "@/lib/permissions";
import { ADMIN_KEY, type Draft } from "@/lib/permissionsDraft";
import type { RoleInfo } from "../types";

export interface PermissionsTableProps {
  roles: RoleInfo[];
  current: Draft;
  saving?: boolean;
  onToggle: (roleKey: string, id: Capability) => void;
  onEditRole: (role: RoleInfo) => void;
  onDuplicateRole: (role: RoleInfo) => void;
  onDeleteRole: (role: RoleInfo) => void;
}

const ICON_BUTTON_CLASS =
  "flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50";

const CAPABILITY_CELL_CLASS =
  "sticky left-0 z-10 w-60 min-w-60 max-w-60 whitespace-normal border-r border-border/70 bg-card align-top group-hover:bg-muted/50";

const CAPABILITY_HEAD_CLASS =
  "sticky left-0 z-20 w-60 min-w-60 max-w-60 whitespace-normal border-r border-border/70 bg-card";

/**
 * Tabla matricial bidimensional con cabecera y columna izquierda fijas (sticky),
 * agrupación de capacidades por módulo y switches accesibles para roles editables.
 */
export function PermissionsTable({
  roles,
  current,
  saving = false,
  onToggle,
  onEditRole,
  onDuplicateRole,
  onDeleteRole,
}: PermissionsTableProps) {
  const groups = useMemo(
    () => [...new Set(CAPABILITIES.map((item) => item.group))],
    [],
  );

  const colSpan = 1 + roles.length;

  const renderCell = (role: RoleInfo, item: CapabilityMeta) => {
    if (role.key === ADMIN_KEY || item.locked === true) {
      return (
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Lock className="size-3.5" aria-hidden="true" />
          {role.key === ADMIN_KEY ? "Siempre activo" : "Solo el administrador"}
        </span>
      );
    }
    return (
      <Switch
        checked={current[role.key]?.[item.id] ?? false}
        onCheckedChange={() => onToggle(role.key, item.id)}
        disabled={saving}
        aria-label={`${item.label} — ${role.label}`}
      />
    );
  };

  return (
    <div className="rounded-xl border border-border/70 bg-card shadow-sm">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className={CAPABILITY_HEAD_CLASS}>Capacidad</TableHead>
              {roles.map((role) => (
                <TableHead key={role.key} className="min-w-44 align-bottom">
                  <span className="flex items-center gap-1.5 text-sm font-semibold">
                    {role.label}
                    {role.key === ADMIN_KEY && (
                      <Lock className="size-3.5" aria-hidden="true" />
                    )}
                  </span>
                  <span className="block text-[10px] font-normal text-muted-foreground">
                    {role.userCount === 0
                      ? "Sin personas"
                      : `${role.userCount} ${
                          role.userCount === 1 ? "persona" : "personas"
                        }`}
                  </span>
                  {role.kind === "custom" && (
                    <span className="mt-1 flex gap-1">
                      <button
                        type="button"
                        className={ICON_BUTTON_CLASS}
                        aria-label={`Editar ${role.label}`}
                        disabled={saving}
                        onClick={() => onEditRole(role)}
                      >
                        <Pencil className="size-3.5" />
                      </button>
                      <button
                        type="button"
                        className={ICON_BUTTON_CLASS}
                        aria-label={`Duplicar ${role.label}`}
                        disabled={saving}
                        onClick={() => onDuplicateRole(role)}
                      >
                        <Copy className="size-3.5" />
                      </button>
                      <button
                        type="button"
                        className={ICON_BUTTON_CLASS}
                        aria-label={`Borrar ${role.label}`}
                        disabled={saving}
                        onClick={() => onDeleteRole(role)}
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </span>
                  )}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {groups.map((group) => {
              const items = CAPABILITIES.filter((item) => item.group === group);
              if (items.length === 0) return null;
              return (
                <Fragment key={group}>
                  <TableRow className="hover:bg-transparent">
                    <TableCell
                      colSpan={colSpan}
                      className="sticky left-0 bg-muted/40 pb-1.5 pt-5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
                    >
                      {group}
                    </TableCell>
                  </TableRow>
                  {items.map((item) => (
                    <TableRow key={item.id} className="group">
                      <TableCell className={CAPABILITY_CELL_CLASS}>
                        <p className="text-sm font-medium leading-5">
                          {item.label}
                        </p>
                        <p
                          className="line-clamp-2 text-xs leading-5 text-muted-foreground"
                          title={item.description}
                        >
                          {item.description}
                        </p>
                      </TableCell>
                      {roles.map((role) => (
                        <TableCell key={role.key} className="align-top">
                          {renderCell(role, item)}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </Fragment>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
