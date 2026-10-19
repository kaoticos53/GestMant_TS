import { Badge } from "@/components/ui/badge";
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
import { AutocompleteInput } from "@/components/ui/AutocompleteInput";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ListArea } from "@/components/ListArea";
import { TablePagination } from "@/components/TablePagination";
import { SortableTableHead, TableSortBar } from "@/components/TableSort";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useAuth } from "@/hooks/use-auth";
import { useRowsThatFit } from "@/hooks/use-rows-that-fit";
import { useTablePagination } from "@/hooks/use-table-pagination";
import { useTableSort } from "@/hooks/use-table-sort";
import { fallbackRoleMeta, roleBadgeClassName } from "@/lib/roles";
import { sortRows } from "@/lib/tableSort";
import { getErrorMessage } from "@/lib/workshop";
import { useAction, useMutation, useQuery } from "convex/react";
import { Pencil, UserCheck, UserPlus, UserX, Users } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

/** Proyección de usuario que devuelve `members.list`. */
interface Member {
  _id: Id<"users">;
  name: string | null;
  email: string | null;
  /** Clave del rol: del sistema o personalizada. */
  role: string | null;
  position: string | null;
  location: string | null;
  phone: string | null;
  active: boolean;
  isAnonymous: boolean;
}

export function UsersView() {
  const users = useQuery(api.members.list);
  const setRole = useMutation(api.members.setRole);
  const setActive = useAction(api.members.setActive);
  const { user: currentUser } = useAuth();

  // Roles seleccionables: los del sistema más los personalizados.
  const roleOptions = useQuery(api.permissions.listRoles);
  const roleLabelOf = (key: string | null) =>
    roleOptions?.find((option) => option.key === key)?.label ??
    fallbackRoleMeta(key ?? "").label;

  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Member | null>(null);

  /**
   * Las columnas que se pueden ordenar: la etiqueta que enseña la cabecera y de
   * dónde sale lo que ordena esa columna —el rol y el estado por lo que se lee,
   * que es lo que se compara al mirarlos—. Se declaran aquí arriba porque el
   * orden es del estado del componente: tiene que salir antes de cualquier
   * salida temprana, como todos los `useState`.
   */
  const columns = {
    member: {
      label: "Usuario",
      value: (member: Member) => member.name ?? member.email ?? "",
    },
    position: {
      label: "Puesto y ubicación",
      value: (member: Member) => member.position ?? "",
    },
    role: {
      label: "Rol",
      value: (member: Member) => roleLabelOf(member.role),
    },
    state: {
      label: "Estado",
      value: (member: Member) => (member.active ? "Activo" : "De baja"),
    },
  } as const;

  // El orden que elige quien mira, recordado para su próxima visita: sin nada
  // elegido, la lista se queda como llega del servidor.
  const [sort, setSort] = useTableSort({
    table: "users",
    columns,
    userId: currentUser?._id ?? null,
  });
  // El área de la tabla, para contar las filas que caben en su alto, y la lista
  // partida en páginas con esas filas: sin paginar, el pie con el recuento queda
  // a dos pantallas de la primera fila. Van antes de la salida de «cargando»
  // porque son enganches y tienen que salir en todos los pases del render. Sin
  // búsqueda ni filtros, la firma va vacía.
  const { areaRef, rowsFit } = useRowsThatFit();
  const paging = useTablePagination({
    total: users?.length ?? 0,
    rowsFit,
  });
  const [deactivating, setDeactivating] = useState<Member | null>(null);

  const handleChangeRole = async (userId: Id<"users">, role: string) => {
    try {
      await setRole({ userId, role });
      toast.success(`Rol actualizado a ${roleLabelOf(role)}`);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const handleToggleActive = async (member: Member) => {
    if (member.active) {
      setDeactivating(member);
      return;
    }
    try {
      await setActive({ userId: member._id, active: true });
      toast.success(`${member.name ?? "Usuario"} reactivado`);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const handleConfirmDeactivate = async () => {
    if (!deactivating) return;
    try {
      await setActive({ userId: deactivating._id, active: false });
      toast.success(`${deactivating.name ?? "Usuario"} dado de baja`);
      setDeactivating(null);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  if (users === undefined) {
    return (
      <div className="rounded-xl border border-border/70 bg-card p-6 shadow-sm">
        <div className="h-8 w-40 animate-pulse rounded bg-muted" />
        <div className="mt-4 h-24 rounded-lg bg-muted/60" />
      </div>
    );
  }

  const activeCount = users.filter((member) => member.active).length;
  const rows = sortRows(
    users,
    (member, column) => columns[column].value(member),
    sort,
  );
  const visible = rows.slice(paging.from - 1, paging.to);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">
            Usuarios del taller
          </h2>
          <p className="text-sm text-muted-foreground">
            Da de alta cuentas, ajusta el puesto y la ubicación de cada persona
            y gestiona quién tiene acceso.
          </p>
        </div>
        <Button
          type="button"
          className="gap-2"
          onClick={() => setCreateOpen(true)}
        >
          <UserPlus className="size-4" />
          Nuevo usuario
        </Button>
      </div>

      <div className="rounded-xl border border-border/70 bg-card shadow-sm">
        <TableSortBar columns={columns} sort={sort} onSortChange={setSort} />
        <ListArea ref={areaRef} resetKey={paging.page}>
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-card">
              <TableRow>
                <SortableTableHead
                  column="member"
                  label="Usuario"
                  sort={sort}
                  onSortChange={setSort}
                />
                <SortableTableHead
                  column="position"
                  label="Puesto y ubicación"
                  sort={sort}
                  onSortChange={setSort}
                  className="hidden md:table-cell"
                />
                <SortableTableHead
                  column="role"
                  label="Rol"
                  sort={sort}
                  onSortChange={setSort}
                  className="hidden sm:table-cell"
                />
                <SortableTableHead
                  column="state"
                  label="Estado"
                  sort={sort}
                  onSortChange={setSort}
                  align="right"
                  className="text-right"
                />
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((member) => {
                const role = member.role ?? "technician";
                const isSelf = member._id === currentUser?._id;
                return (
                  <TableRow
                    key={member._id}
                    className={member.active ? undefined : "opacity-70"}
                  >
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
                        <Badge
                          variant="outline"
                          className={roleBadgeClassName(role)}
                        >
                          {roleLabelOf(member.role)}
                        </Badge>
                        <Select
                          value={role}
                          onValueChange={(value) =>
                            handleChangeRole(member._id, value)
                          }
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
                            {(roleOptions ?? []).map((option) => (
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
                          onClick={() => setEditing(member)}
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
                            isSelf
                              ? "No puedes dar de baja tu propia cuenta"
                              : undefined
                          }
                          disabled={isSelf}
                          onClick={() => void handleToggleActive(member)}
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
              })}
            </TableBody>
          </Table>
        </ListArea>

        <TablePagination
          paging={paging}
          singular="usuario"
          plural="usuarios"
          detail={
            <span className="flex items-center gap-1.5">
              <Users className="size-3.5" aria-hidden="true" />
              {activeCount} con acceso · el administrador no puede cambiar su
              propio rol ni darse de baja
            </span>
          }
        />
      </div>

      {createOpen && <CreateUserDialog onClose={() => setCreateOpen(false)} />}
      {editing && (
        <EditUserDialog member={editing} onClose={() => setEditing(null)} />
      )}
      {deactivating && (
        <DeactivateDialog
          member={deactivating}
          onConfirm={handleConfirmDeactivate}
          onClose={() => setDeactivating(null)}
        />
      )}
    </div>
  );
}

/** Clases del botón de baja/reactivación según el estado. */
function cnActive(active: boolean): string {
  return active
    ? "text-muted-foreground hover:text-destructive"
    : "text-muted-foreground hover:text-emerald-700";
}

/** Alta: crea la persona y su cuenta de acceso (correo + contraseña). */
function CreateUserDialog({ onClose }: { onClose: () => void }) {
  const createUser = useAction(api.members.createUser);
  const roleOptions = useQuery(api.permissions.listRoles);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<string>("technician");
  const [position, setPosition] = useState("");
  const [location, setLocation] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError("Indica tu nombre y apellidos.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Indica un correo electrónico válido.");
      return;
    }
    if (password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    setBusy(true);
    try {
      await createUser({
        name: name.trim(),
        email: email.trim(),
        password,
        role,
        position: position.trim() || undefined,
        location: location.trim() || undefined,
        phone: phone.trim() || undefined,
      });
      toast.success(`Usuario creado: ${email.trim()}`);
      onClose();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="size-4" />
            Dar de alta a un usuario
          </DialogTitle>
          <DialogDescription>
            Crea su ficha en el taller y su cuenta de acceso. Podrá entrar con
            su correo y esta contraseña desde la página de acceso.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="user-name">Nombre y apellidos *</Label>
              <Input
                id="user-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Sandra Ruiz"
                disabled={busy}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="user-email">Correo de acceso *</Label>
              <Input
                id="user-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="sandra@taller.es"
                autoComplete="off"
                disabled={busy}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="user-password">Contraseña inicial *</Label>
              <Input
                id="user-password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Mínimo 8 caracteres"
                autoComplete="new-password"
                disabled={busy}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="user-role">Rol</Label>
              <Select
                value={role}
                onValueChange={(value) => setRole(value)}
                disabled={busy}
              >
                <SelectTrigger id="user-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(roleOptions ?? []).map((option) => (
                    <SelectItem key={option.key} value={option.key}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="user-position">Puesto</Label>
              <Input
                id="user-position"
                value={position}
                onChange={(event) => setPosition(event.target.value)}
                placeholder="p. ej. Cámara"
                disabled={busy}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="user-location">Ubicación</Label>
              <Input
                id="user-location"
                value={location}
                onChange={(event) => setLocation(event.target.value)}
                placeholder="p. ej. Plató 1"
                disabled={busy}
              />
            </div>
            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor="user-phone">Teléfono</Label>
              <Input
                id="user-phone"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="p. ej. 600 123 456"
                disabled={busy}
              />
            </div>
          </div>

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
              {busy ? "Creando..." : "Crear usuario"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Edición del perfil de un usuario por parte del administrador. */
function EditUserDialog({
  member,
  onClose,
}: {
  member: Member;
  onClose: () => void;
}) {
  const updateUser = useMutation(api.members.updateUser);
  const catalogPositions = useQuery(api.catalogs.list, { kind: "position" }) ?? [];
  const catalogLocations = useQuery(api.catalogs.list, { kind: "equipmentLocation" }) ?? [];
  const ensureCatalogItem = useMutation(api.catalogs.ensureItem);
  const [name, setName] = useState(member.name ?? "");
  const [position, setPosition] = useState(member.position ?? "");
  const [location, setLocation] = useState(member.location ?? "");
  const [phone, setPhone] = useState(member.phone ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!name.trim()) {
      setError("Indica tu nombre y apellidos.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await updateUser({
        userId: member._id,
        name: name.trim(),
        // Cadena vacía = limpiar el dato de la ficha.
        position,
        location,
        phone,
      });

      // Registro transparente en catálogos
      if (position.trim()) {
        void ensureCatalogItem({ kind: "position", name: position.trim() }).catch(() => {});
      }
      if (location.trim()) {
        void ensureCatalogItem({ kind: "equipmentLocation", name: location.trim() }).catch(() => {});
      }

      toast.success("Perfil actualizado");
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
          <DialogTitle>Editar usuario</DialogTitle>
          <DialogDescription>
            {member.email ?? "Sin correo de acceso"}
            {member.email ? " · el correo de acceso no se puede cambiar" : ""}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="edit-name">Nombre y apellidos *</Label>
            <Input
              id="edit-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              disabled={busy}
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="edit-position">Puesto</Label>
            <AutocompleteInput
              id="edit-position"
              value={position}
              onChange={setPosition}
              items={catalogPositions}
              kind="position"
              placeholder="p. ej. Audio"
              disabled={busy}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="edit-location">Ubicación</Label>
            <AutocompleteInput
              id="edit-location"
              value={location}
              onChange={setLocation}
              items={catalogLocations}
              kind="location"
              placeholder="p. ej. Plató 2"
              disabled={busy}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="edit-phone">Teléfono</Label>
            <Input
              id="edit-phone"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="p. ej. 600 123 456"
              disabled={busy}
            />
          </div>

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
            <Button type="submit" disabled={busy}>
              {busy ? "Guardando..." : "Guardar cambios"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Confirmación de baja (el acceso se revoca y se pueden reactivar después). */
function DeactivateDialog({
  member,
  onConfirm,
  onClose,
}: {
  member: Member;
  onConfirm: () => Promise<void>;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    setBusy(true);
    setError(null);
    try {
      await onConfirm();
      onClose();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserX className="size-4" />
            Dar de baja
          </DialogTitle>
          <DialogDescription>
            {member.name ?? member.email ?? "Este usuario"} perderá el acceso a
            Pulso Taller y se cerrarán sus sesiones. Su historial se conserva y
            podrás reactivarlo cuando quieras.
          </DialogDescription>
        </DialogHeader>

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
          <Button
            type="button"
            variant="destructive"
            onClick={() => void handleConfirm()}
            disabled={busy}
          >
            {busy ? "Dando de baja..." : "Dar de baja"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
