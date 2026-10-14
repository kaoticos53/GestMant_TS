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
import { Label } from "@/components/ui/label";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { isClosedIncident, isIncidentInProgress } from "@/lib/incidentFlow";
import { richDocToPlainText } from "@/lib/richDoc";
import {
  DEFAULT_ROLE,
  fallbackRoleMeta,
  roleBadgeClassName,
} from "@/lib/roles";
import { cn } from "@/lib/utils";
import {
  INCIDENT_STATUS_META,
  PRIORITY_META,
  STATUS_META,
  formatRelativeTime,
  getErrorMessage,
} from "@/lib/workshop";
import { useMutation, useQuery } from "convex/react";
import {
  ArrowRight,
  Bell,
  Briefcase,
  MapPin,
  Package,
  Pencil,
  Phone,
  Siren,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

/**
 * Perfil del usuario: mini-dashboard con sus datos, sus incidencias
 * asignadas, sus peticiones y sus avisos. Se abre pulsando su nombre en la
 * barra lateral inferior.
 */
export function ProfileView({
  user,
  onOpenIncidents,
  onOpenRequests,
}: {
  user: Doc<"users"> | null | undefined;
  onOpenIncidents: () => void;
  onOpenRequests: () => void;
}) {
  // «Mis incidencias» y «mis peticiones» salen de las colas vivas, que carga el
  // propio perfil: el armazón no le pasa datos, solo la sesión.
  const incidents = useQuery(api.incidents.list, {}) ?? [];
  const requests = useQuery(api.partRequests.list, {}) ?? [];
  const notifications = useQuery(api.notifications.list);
  // Etiqueta real del miembro (los roles personalizados tienen nombre propio).
  const me = useQuery(api.permissions.myPermissions);
  const [editOpen, setEditOpen] = useState(false);

  if (!user) {
    return (
      <div className="grid gap-4">
        <div className="h-36 animate-pulse rounded-xl bg-muted" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="h-28 animate-pulse rounded-xl bg-muted"
            />
          ))}
        </div>
      </div>
    );
  }

  const displayName = user.name || user.email || "U";
  const initial = displayName.trim().charAt(0).toUpperCase() || "U";
  const role = user.role ?? DEFAULT_ROLE;

  const myIncidents = incidents
    .filter(
      (item) =>
        item.assigneeId === user._id || item.workshopAssigneeId === user._id,
    )
    .sort((a, b) => b.updatedAt - a.updatedAt);
  // «En curso» y «cerrada» son preguntas de la máquina de la incidencia
  // (`lib/incidentFlow`): la ficha no las responde por su cuenta.
  const openIncidents = myIncidents.filter((item) =>
    isIncidentInProgress(item.status),
  );
  const closedIncidents = myIncidents.filter((item) =>
    isClosedIncident(item.status),
  );

  const myRequests = requests
    .filter(
      (item) =>
        item.requesterId === user._id ||
        (item.requesterId === undefined &&
          item.requesterName === (user.name ?? "")),
    )
    .sort((a, b) => b.createdAt - a.createdAt);
  const pendingRequests = myRequests.filter(
    (item) => item.status === "pending",
  );

  const avisos = notifications ?? [];
  const unread = avisos.filter((item) => !item.read).length;

  const stats = [
    {
      label: "Incidencias activas",
      value: openIncidents.length,
      hint:
        openIncidents.length === 0
          ? "Nada pendiente de ti"
          : "En curso o taller",
      icon: Siren,
      iconClassName: "bg-signal/10 text-signal",
    },
    {
      label: "Incidencias cerradas",
      value: closedIncidents.length,
      hint: "Resueltas o sin resolución",
      icon: Briefcase,
      iconClassName: "bg-emerald-600/10 text-emerald-700",
    },
    {
      label: "Mis peticiones",
      value: myRequests.length,
      hint:
        pendingRequests.length > 0
          ? `${pendingRequests.length} pendiente${
              pendingRequests.length === 1 ? "" : "s"
            } de revisión`
          : myRequests.length === 0
            ? "Todavía no has pedido material"
            : "Ninguna pendiente",
      icon: Package,
      iconClassName: "bg-amber-500/10 text-amber-700",
    },
    {
      label: "Avisos sin leer",
      value: unread,
      hint: unread === 0 ? "Todo al día" : "Pulsa la campana para revisarlos",
      icon: Bell,
      iconClassName: "bg-muted text-muted-foreground",
    },
  ];

  const metaChips = [
    user.position ? { icon: Briefcase, text: user.position } : null,
    user.location ? { icon: MapPin, text: user.location } : null,
    user.phone ? { icon: Phone, text: user.phone } : null,
  ].filter(Boolean);

  return (
    <div className="flex flex-col gap-5">
      {/* Ficha personal */}
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
                    {me?.label ?? fallbackRoleMeta(role).label}
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
                  {metaChips.map((chip) =>
                    chip ? (
                      <span
                        key={chip.text}
                        className="flex items-center gap-1.5 text-xs text-muted-foreground"
                      >
                        <chip.icon className="size-3.5" />
                        {chip.text}
                      </span>
                    ) : null,
                  )}
                </div>
              )}
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            className="gap-2"
            onClick={() => setEditOpen(true)}
          >
            <Pencil className="size-4" />
            Editar perfil
          </Button>
        </div>
      </section>

      {/* Resumen personal */}
      <section
        aria-label="Mi resumen"
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl border border-border/70 bg-card p-4 shadow-sm"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-medium text-muted-foreground">
                {stat.label}
              </p>
              <span
                className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${stat.iconClassName}`}
              >
                <stat.icon className="size-4" />
              </span>
            </div>
            <p className="mt-2 text-3xl font-semibold tabular-nums tracking-tight">
              {stat.value}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{stat.hint}</p>
          </div>
        ))}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Mis incidencias */}
        <section className="rounded-xl border border-border/70 bg-card shadow-sm">
          <header className="flex items-center justify-between gap-2 border-b border-border/70 px-4 py-3">
            <h3 className="text-sm font-semibold">Mis incidencias</h3>
            <button
              type="button"
              onClick={onOpenIncidents}
              className="flex items-center gap-1 text-xs font-medium text-signal hover:underline"
            >
              Ver cola
              <ArrowRight className="size-3.5" />
            </button>
          </header>
          {myIncidents.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted-foreground">
              No tienes ninguna incidencia asignada todavía.
            </p>
          ) : (
            <ul className="divide-y divide-border/60">
              {myIncidents.slice(0, 5).map((incident) => {
                const meta = INCIDENT_STATUS_META[incident.status];
                return (
                  <li key={incident._id}>
                    <button
                      type="button"
                      onClick={onOpenIncidents}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/60"
                    >
                      <span className="font-mono text-xs font-semibold text-muted-foreground">
                        {incident.reference}
                      </span>
                      <Badge variant="outline" className={meta.badgeClassName}>
                        {meta.label}
                      </Badge>
                      <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
                        {incident.equipmentKind} · {incident.model}
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {formatRelativeTime(incident.updatedAt)}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Mis peticiones */}
        <section className="rounded-xl border border-border/70 bg-card shadow-sm">
          <header className="flex items-center justify-between gap-2 border-b border-border/70 px-4 py-3">
            <h3 className="text-sm font-semibold">
              Mis peticiones de repuesto
            </h3>
            <button
              type="button"
              onClick={onOpenRequests}
              className="flex items-center gap-1 text-xs font-medium text-signal hover:underline"
            >
              Ver cola
              <ArrowRight className="size-3.5" />
            </button>
          </header>
          {myRequests.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted-foreground">
              Todavía no has creado ninguna petición de material.
            </p>
          ) : (
            <ul className="divide-y divide-border/60">
              {myRequests.slice(0, 5).map((request) => (
                <li key={request._id}>
                  <button
                    type="button"
                    onClick={onOpenRequests}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/60"
                  >
                    <span className="font-mono text-xs font-semibold text-muted-foreground">
                      {request.reference}
                    </span>
                    <Badge
                      variant="outline"
                      className={
                        STATUS_META[request.status]?.badgeClassName ??
                        STATUS_META.pending.badgeClassName
                      }
                    >
                      {STATUS_META[request.status]?.label ??
                        STATUS_META.pending.label}
                    </Badge>
                    <span
                      className={cn(
                        "text-xs",
                        PRIORITY_META[request.priority].label === "Urgente"
                          ? "font-medium text-destructive"
                          : "text-muted-foreground",
                      )}
                    >
                      {PRIORITY_META[request.priority].label}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-right text-xs text-muted-foreground">
                      {/* La descripción se escribe con el editor: aquí se enseña
                          su texto, no el documento con formato. */}
                      {request.equipment ??
                        richDocToPlainText(request.description)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Avisos recientes */}
      <section className="rounded-xl border border-border/70 bg-card shadow-sm">
        <header className="border-b border-border/70 px-4 py-3">
          <h3 className="text-sm font-semibold">Avisos recientes</h3>
        </header>
        {avisos.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted-foreground">
            No tienes avisos. Te avisaremos aquí cuando algo dependa de ti.
          </p>
        ) : (
          <ul className="divide-y divide-border/60">
            {avisos.slice(0, 4).map((item) => (
              <li
                key={item._id}
                className="flex items-center gap-3 px-4 py-3 text-sm"
              >
                <span
                  className={cn(
                    "size-2 shrink-0 rounded-full",
                    item.read ? "bg-border" : "bg-signal",
                  )}
                />
                <span className="min-w-0 flex-1 truncate">{item.text}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {formatRelativeTime(item.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {editOpen && (
        <EditProfileDialog user={user} onClose={() => setEditOpen(false)} />
      )}
    </div>
  );
}

/** Edita el perfil de la persona que tiene la sesión (nunca el rol). */
function EditProfileDialog({
  user,
  onClose,
}: {
  user: Doc<"users">;
  onClose: () => void;
}) {
  const updateProfile = useMutation(api.members.updateProfile);
  const [name, setName] = useState(user.name ?? "");
  const [position, setPosition] = useState(user.position ?? "");
  const [location, setLocation] = useState(user.location ?? "");
  const [phone, setPhone] = useState(user.phone ?? "");
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
      await updateProfile({
        name: name.trim(),
        // Cadena vacía = limpiar el dato de la ficha.
        position,
        location,
        phone,
      });
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
          <DialogTitle>Editar mi perfil</DialogTitle>
          <DialogDescription>
            Tu nombre, puesto y datos de contacto. El rol lo gestiona el
            administrador.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="profile-name">Nombre y apellidos *</Label>
            <Input
              id="profile-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              disabled={busy}
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="profile-position">Puesto</Label>
            <Input
              id="profile-position"
              value={position}
              onChange={(event) => setPosition(event.target.value)}
              placeholder="p. ej. Realización"
              disabled={busy}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="profile-location">Ubicación</Label>
            <Input
              id="profile-location"
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              placeholder="p. ej. Plató 2 · Sala de realización"
              disabled={busy}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="profile-phone">Teléfono</Label>
            <Input
              id="profile-phone"
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
