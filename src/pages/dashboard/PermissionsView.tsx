import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/convex/_generated/api";
import {
  CAPABILITIES,
  type Capability,
  type CapabilityMeta,
} from "@/lib/permissions";
import {
  ADMIN_KEY,
  canRestoreDefaults,
  dropRole,
  editableGrants,
  isDirty,
  mergeDraft,
  pendingChanges,
  restoreSystemDefaults,
  toggleGrant,
  type Draft,
  type Grants,
} from "@/lib/permissionsDraft";
import { DEFAULT_ROLE } from "@/lib/roles";
import { getErrorMessage } from "@/lib/workshop";
import { useMutation, useQuery } from "convex/react";
import {
  Copy,
  Lock,
  Pencil,
  Plus,
  RotateCcw,
  Save,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { Fragment, useState } from "react";
import { toast } from "sonner";

/** Fila que devuelve `permissions.listRoles`. */
interface RoleInfo {
  key: string;
  label: string;
  description: string;
  kind: "system" | "custom";
  grants: Grants;
  userCount: number;
}

type DialogState = {
  mode: "new" | "edit";
  role?: RoleInfo;
  template?: RoleInfo;
} | null;

/**
 * Roles y permisos (solo administrador): matriz de qué puede ver y modificar
 * cada rol, más el alta, renombrado, duplicado y borrado de roles. Los
 * cambios se aplican de inmediato en el menú y en las acciones del backend.
 */
export function PermissionsView() {
  const roles = useQuery(api.permissions.listRoles);
  const setRolePermissions = useMutation(api.permissions.setRolePermissions);
  const deleteRole = useMutation(api.permissions.deleteRole);

  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [deleting, setDeleting] = useState<RoleInfo | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  // Lo guardado con los cambios locales encima: así un rol creado mientras
  // hay cambios sin guardar aparece con sus permisos reales y editable.
  const saved = roles === undefined ? undefined : editableGrants(roles);
  const current: Draft | undefined =
    saved === undefined ? undefined : mergeDraft(saved, draft);
  const dirty = draft !== null && saved !== undefined && isDirty(draft, saved);

  const toggle = (roleKey: string, id: Capability) => {
    if (!current) return;
    setDraft(toggleGrant(current, roleKey, id));
  };

  /** Revierte los roles del sistema a sus permisos de código. */
  const restoreDefaults = () => {
    if (!current) return;
    setDraft(restoreSystemDefaults(current));
  };

  const canRestore = current !== undefined && canRestoreDefaults(current);

  const handleSave = async () => {
    if (!draft || !saved) return;
    const changes = pendingChanges(draft, saved);
    if (changes.length === 0) {
      setDraft(null);
      return;
    }
    setSaving(true);
    try {
      for (const change of changes) {
        await setRolePermissions({ role: change.key, grants: change.grants });
      }
      setDraft(null);
      toast.success("Permisos actualizados: ya se aplican a cada rol");
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      await deleteRole({ key: deleting.key });
      setDraft((prev) => (prev === null ? null : dropRole(prev, deleting.key)));
      toast.success(`Rol «${deleting.label}» borrado`);
      setDeleting(null);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setDeleteBusy(false);
    }
  };

  if (!current || !roles) {
    return (
      <div className="rounded-xl border border-border/70 bg-card p-6 shadow-sm">
        <div className="h-8 w-56 animate-pulse rounded bg-muted" />
        <div className="mt-4 space-y-2">
          <div className="h-10 rounded-lg bg-muted/60" />
          <div className="h-10 rounded-lg bg-muted/60" />
          <div className="h-10 rounded-lg bg-muted/60" />
        </div>
      </div>
    );
  }

  const colSpan = 1 + roles.length;
  const editableRoles = roles.filter((role) => role.key !== ADMIN_KEY);

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
        onCheckedChange={() => toggle(role.key, item.id)}
        disabled={saving}
        aria-label={`${item.label} — ${role.label}`}
      />
    );
  };

  const iconButtonClass =
    "flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50";

  // La columna de capacidades no se mueve: con muchos roles la matriz se
  // desplaza de lado, y sin ella fija se perdía de vista qué permiso se estaba
  // cambiando. Va pegada a la izquierda, con fondo propio (tapa lo que pasa por
  // debajo) y una raya que la separa del resto. Ancho corto y texto recortado a
  // dos líneas: el nombre de la capacidad es lo que se lee al recorrer la fila.
  const capabilityCellClass =
    "sticky left-0 z-10 w-60 min-w-60 max-w-60 whitespace-normal border-r border-border/70 bg-card align-top group-hover:bg-muted/50";
  const capabilityHeadClass =
    "sticky left-0 z-20 w-60 min-w-60 max-w-60 whitespace-normal border-r border-border/70 bg-card";

  const renderHeader = (role: RoleInfo) => (
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
          : `${role.userCount} ${role.userCount === 1 ? "persona" : "personas"}`}
      </span>
      {role.kind === "custom" && (
        <span className="mt-1 flex gap-1">
          <button
            type="button"
            className={iconButtonClass}
            aria-label={`Editar ${role.label}`}
            disabled={saving}
            onClick={() => setDialog({ mode: "edit", role })}
          >
            <Pencil className="size-3.5" />
          </button>
          <button
            type="button"
            className={iconButtonClass}
            aria-label={`Duplicar ${role.label}`}
            disabled={saving}
            onClick={() => setDialog({ mode: "new", template: role })}
          >
            <Copy className="size-3.5" />
          </button>
          <button
            type="button"
            className={iconButtonClass}
            aria-label={`Borrar ${role.label}`}
            disabled={saving}
            onClick={() => setDeleting(role)}
          >
            <Trash2 className="size-3.5" />
          </button>
        </span>
      )}
    </TableHead>
  );

  const renderGroup = (group: string) => {
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
            <TableCell className={capabilityCellClass}>
              <p className="text-sm font-medium leading-5">{item.label}</p>
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
  };

  const groups = [...new Set(CAPABILITIES.map((item) => item.group))];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
            <ShieldCheck className="size-5 text-signal" />
            Roles y permisos
          </h2>
          <p className="text-sm text-muted-foreground">
            Crea los roles del taller y decide en la matriz qué ve y qué puede
            modificar cada uno. Los cambios se aplican al instante en el menú y
            en las acciones del backend.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            className="gap-2"
            onClick={restoreDefaults}
            disabled={saving || !canRestore}
          >
            <RotateCcw className="size-4" />
            Restaurar sistema
          </Button>
          <Button
            type="button"
            variant="outline"
            className="gap-2"
            onClick={() => setDialog({ mode: "new" })}
            disabled={saving}
          >
            <Plus className="size-4" />
            Nuevo rol
          </Button>
          <Button
            type="button"
            className="gap-2"
            onClick={handleSave}
            disabled={!dirty || saving}
          >
            <Save className="size-4" />
            {saving ? "Guardando..." : "Guardar cambios"}
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-signal/25 bg-signal/5 p-4">
        <p className="flex items-center gap-2 text-sm font-medium text-signal">
          <ShieldCheck className="size-4" />
          El administrador siempre tiene todas las capacidades
        </p>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          Los roles del sistema (Administrador, Responsable y Técnico) no se
          borran ni se renombran; los personalizados sí. Las capacidades con
          candado solo las tiene el administrador y un rol nuevo parte de la
          plantilla que elijas. Las de modificar se comprueban en el backend de
          cada módulo; las de «ver» deciden qué módulos aparecen en el menú y en
          el resumen.
        </p>
      </div>

      <div className="rounded-xl border border-border/70 bg-card shadow-sm">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className={capabilityHeadClass}>Capacidad</TableHead>
                {roles.map(renderHeader)}
              </TableRow>
            </TableHeader>
            <TableBody>{groups.map((group) => renderGroup(group))}</TableBody>
          </Table>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {editableRoles.map((role) => {
          const total = CAPABILITIES.filter(
            (item) => item.locked !== true,
          ).length;
          const granted = CAPABILITIES.filter(
            (item) => item.locked !== true && current[role.key]?.[item.id],
          ).length;
          return (
            <span key={role.key}>
              {role.label}:{" "}
              <span className="font-medium text-foreground">
                {granted} de {total}
              </span>{" "}
              capacidades concedidas
            </span>
          );
        })}
      </div>

      {dialog && (
        <RoleDialog
          state={dialog}
          roles={roles}
          onClose={() => setDialog(null)}
        />
      )}

      {deleting && (
        <AlertDialog
          open
          onOpenChange={(open) => {
            if (!open && !deleteBusy) setDeleting(null);
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                ¿Borrar el rol «{deleting.label}»?
              </AlertDialogTitle>
              <AlertDialogDescription>
                {deleting.userCount > 0
                  ? `Tienen este rol ${deleting.userCount} ${
                      deleting.userCount === 1 ? "persona" : "personas"
                    }. Reasígnalas desde el módulo de usuarios antes de borrarlo.`
                  : "Se borrarán sus permisos y dejará de aparecer en la lista de roles. Esta acción no se puede deshacer."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleteBusy}>
                Cancelar
              </AlertDialogCancel>
              <AlertDialogAction
                disabled={deleteBusy}
                onClick={(event) => {
                  event.preventDefault();
                  void handleDelete();
                }}
              >
                {deleteBusy ? "Borrando..." : "Borrar rol"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}

/** Alta y renombrado de roles (la plantilla solo aplica al crear). */
function RoleDialog({
  state,
  roles,
  onClose,
}: {
  state: NonNullable<DialogState>;
  roles: RoleInfo[];
  onClose: () => void;
}) {
  const createRole = useMutation(api.permissions.createRole);
  const updateRole = useMutation(api.permissions.updateRole);
  const isEdit = state.mode === "edit" && state.role !== undefined;

  const [label, setLabel] = useState(
    isEdit
      ? state.role!.label
      : state.template
        ? `${state.template.label} (copia)`
        : "",
  );
  const [description, setDescription] = useState(
    isEdit ? state.role!.description : (state.template?.description ?? ""),
  );
  const [templateKey, setTemplateKey] = useState(
    state.template?.key ?? DEFAULT_ROLE,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const templateOptions = roles.filter((role) => role.key !== ADMIN_KEY);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (isEdit && state.role) {
        await updateRole({ key: state.role.key, label, description });
        toast.success("Rol actualizado");
      } else {
        const key = await createRole({ label, description, templateKey });
        toast.success(`Rol «${label}» creado (clave «${key}»)`);
      }
      onClose();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="size-4" />
            {isEdit
              ? "Editar rol"
              : state.template
                ? "Duplicar rol"
                : "Nuevo rol"}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Cambia el nombre visible y la descripción. La clave con la que se guarda el rol no cambia."
              : "El nombre genera la clave única del rol; partimos de los permisos de otro rol para empezar."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="role-label">Nombre del rol *</Label>
            <Input
              id="role-label"
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              placeholder="p. ej. Auxiliar de almacén"
              maxLength={60}
              disabled={busy}
              required
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="role-description">Descripción</Label>
            <Textarea
              id="role-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Qué hace este rol en el taller"
              rows={2}
              maxLength={160}
              disabled={busy}
            />
          </div>

          {!isEdit && (
            <div className="grid gap-2">
              <Label htmlFor="role-template">Partir de los permisos de</Label>
              <Select
                value={templateKey}
                onValueChange={setTemplateKey}
                disabled={busy}
              >
                <SelectTrigger id="role-template">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {templateOptions.map((role) => (
                    <SelectItem key={role.key} value={role.key}>
                      {role.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={busy}
            >
              Cancelar
            </Button>
            <Button type="submit" className="gap-2" disabled={busy}>
              {busy ? "Guardando..." : isEdit ? "Guardar rol" : "Crear rol"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
