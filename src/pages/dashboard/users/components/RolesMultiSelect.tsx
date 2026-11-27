import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  areRoleListsEqual,
  normalizeUserRoles,
  roleBadgeClassName,
} from "@/lib/roles";
import type { RoleOption } from "../types";

export interface RolesChecklistProps {
  roleOptions: RoleOption[];
  selectedRoles: string[];
  onChange: (nextRoles: string[]) => void;
  disabled?: boolean;
  idPrefix?: string;
}

/**
 * Lista de selección múltiple de roles con casillas. Impide desmarcar el último rol activo.
 */
export function RolesChecklist({
  roleOptions,
  selectedRoles,
  onChange,
  disabled = false,
  idPrefix = "role-opt",
}: RolesChecklistProps) {
  const toggleRole = (key: string, checked: boolean) => {
    if (disabled) return;
    if (checked) {
      onChange(normalizeUserRoles([...selectedRoles, key]));
      return;
    }
    if (selectedRoles.length <= 1) return;
    onChange(normalizeUserRoles(selectedRoles.filter((item) => item !== key)));
  };

  return (
    <div className="max-h-52 divide-y overflow-y-auto rounded-lg border border-border bg-background">
      {roleOptions.map((option) => {
        const checked = selectedRoles.includes(option.key);
        const lastRemaining = checked && selectedRoles.length <= 1;
        const checkboxId = `${idPrefix}-${option.key}`;
        return (
          <label
            key={option.key}
            htmlFor={checkboxId}
            className="flex cursor-pointer items-start gap-2.5 px-3 py-2 text-sm transition-colors hover:bg-muted/40"
          >
            <Checkbox
              id={checkboxId}
              checked={checked}
              disabled={disabled || lastRemaining}
              onCheckedChange={(value) => toggleRole(option.key, value === true)}
              className="mt-0.5"
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="font-medium leading-tight">{option.label}</span>
                {checked && (
                  <Badge
                    variant="outline"
                    className={roleBadgeClassName(option.key)}
                  >
                    Asignado
                  </Badge>
                )}
              </div>
              {option.description && (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {option.description}
                </p>
              )}
            </div>
          </label>
        );
      })}
    </div>
  );
}

export interface UserRolesPopoverProps {
  memberRoles: string[];
  roleOptions: RoleOption[];
  disabled?: boolean;
  memberName: string;
  onSaveRoles: (roles: string[]) => void | Promise<void>;
}

/**
 * Selector rápido multi-rol para la fila de la tabla de usuarios.
 */
export function UserRolesPopover({
  memberRoles,
  roleOptions,
  disabled = false,
  memberName,
  onSaveRoles,
}: UserRolesPopoverProps) {
  const [open, setOpen] = useState(false);
  const [draftRoles, setDraftRoles] = useState<string[]>(memberRoles);
  const [saving, setSaving] = useState(false);

  const handleOpenChange = (nextOpen: boolean) => {
    if (saving) return;
    if (nextOpen) {
      setDraftRoles(memberRoles.length > 0 ? memberRoles : ["technician"]);
    }
    setOpen(nextOpen);
  };

  const unchanged = areRoleListsEqual(draftRoles, memberRoles);

  const handleSave = async () => {
    if (draftRoles.length === 0 || unchanged) {
      setOpen(false);
      return;
    }
    setSaving(true);
    try {
      await onSaveRoles(draftRoles);
      setOpen(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 gap-1 px-2 text-xs"
          disabled={disabled}
          aria-label={`Cambiar roles de ${memberName}`}
        >
          <span>Roles</span>
          <ChevronDown className="size-3 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 space-y-3 p-3">
        <div className="space-y-0.5">
          <p className="text-xs font-semibold">Roles asignados</p>
          <p className="text-[11px] text-muted-foreground">
            El usuario heredará la unión de capacidades de los roles marcados.
          </p>
        </div>
        <RolesChecklist
          roleOptions={roleOptions}
          selectedRoles={draftRoles}
          onChange={setDraftRoles}
          disabled={saving}
          idPrefix={`row-${memberName.replace(/[^a-zA-Z0-9_-]/g, "")}`}
        />
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setOpen(false)}
            disabled={saving}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => void handleSave()}
            disabled={saving || draftRoles.length === 0 || unchanged}
          >
            {saving ? "Guardando..." : "Guardar roles"}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
