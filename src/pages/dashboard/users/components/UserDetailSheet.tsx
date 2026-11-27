import { useQuery } from "convex/react";
import {
  Activity,
  History,
  KeyRound,
  Mail,
  MapPin,
  Pencil,
  Phone,
  ShieldCheck,
  UserCheck,
  UserX,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { api } from "@/convex/_generated/api";
import { STOCK_MOVEMENT_META, type StockMovementKind } from "@/lib/movements";
import { roleBadgeClassName } from "@/lib/roles";
import { formatDateTime } from "@/lib/workshop";
import { getMemberRoleKeys } from "../helpers";
import type { Member } from "../types";

export interface UserDetailSheetProps {
  member: Member | null;
  isSelf: boolean;
  roleLabelOf: (key: string | null) => string;
  onClose: () => void;
  onEdit: (member: Member) => void;
  onToggleActive: (member: Member) => void | Promise<void>;
  onResetPassword?: (member: Member) => void;
}

export function UserDetailSheet({
  member,
  isSelf,
  roleLabelOf,
  onClose,
  onEdit,
  onToggleActive,
  onResetPassword,
}: UserDetailSheetProps) {
  const summary = useQuery(
    api.members.getMemberSummary,
    member ? { userId: member._id } : "skip",
  );

  const roleKeys = member ? getMemberRoleKeys(member) : [];
  const displayRoles =
    roleKeys.length > 0 ? roleKeys : [member?.role ?? "technician"];

  return (
    <Sheet open={member !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="flex w-full flex-col gap-0 overflow-y-auto sm:max-w-lg">
        {member && (
          <>
            <SheetHeader className="space-y-2 border-b pb-4">
              <div className="flex flex-wrap items-center gap-2 pr-6">
                {displayRoles.map((key) => (
                  <Badge
                    key={key}
                    variant="outline"
                    className={roleBadgeClassName(key)}
                  >
                    {roleLabelOf(key)}
                  </Badge>
                ))}
                <Badge variant={member.active ? "secondary" : "destructive"}>
                  {member.active ? "Activo" : "Inactivo"}
                </Badge>
                {isSelf && <Badge variant="outline">Tu cuenta</Badge>}
              </div>
              <SheetTitle className="text-left text-lg leading-snug">
                {member.name ?? "Sin nombre"}
              </SheetTitle>
              <SheetDescription className="text-left">
                {member.position ?? "Sin puesto asignado"}
              </SheetDescription>
            </SheetHeader>

            <div className="grid min-w-0 gap-5 px-4 py-4 pb-6 sm:px-6 [&>*]:min-w-0">
              <div className="space-y-2 rounded-xl border bg-muted/20 p-3.5 text-xs text-muted-foreground">
                <div className="flex min-w-0 items-center gap-2">
                  <Mail className="size-3.5 shrink-0" />
                  <span className="min-w-0 break-all">
                    {member.email ?? "Sin correo de acceso"}
                  </span>
                </div>
                <div className="flex min-w-0 items-center gap-2">
                  <MapPin className="size-3.5 shrink-0" />
                  <span className="min-w-0 break-words">
                    {member.location ?? "Sin ubicación"}
                  </span>
                </div>
                <div className="flex min-w-0 items-center gap-2">
                  <Phone className="size-3.5 shrink-0" />
                  <span className="min-w-0 break-all">
                    {member.phone ?? "Sin teléfono"}
                  </span>
                </div>
              </div>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  onClose();
                  onEdit(member);
                }}
              >
                <Pencil className="mr-1.5 size-4" />
                Editar perfil
              </Button>
              {!isSelf &&
                member.isAnonymous !== true &&
                Boolean(member.email) &&
                onResetPassword && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      onClose();
                      onResetPassword(member);
                    }}
                  >
                    <KeyRound className="mr-1.5 size-4" />
                    Restablecer contraseña
                  </Button>
                )}
              {!isSelf && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    void onToggleActive(member);
                    onClose();
                  }}
                >
                  {member.active ? (
                    <>
                      <UserX className="mr-1.5 size-4" />
                      Desactivar cuenta
                    </>
                  ) : (
                    <>
                      <UserCheck className="mr-1.5 size-4" />
                      Reactivar cuenta
                    </>
                  )}
                </Button>
              )}
            </div>

            {summary === undefined ? (
              <div className="space-y-3" aria-label="Cargando resumen de usuario">
                <Skeleton className="h-20 rounded-lg" />
                <Skeleton className="h-14 rounded-lg" />
              </div>
            ) : summary === null ? (
              <p className="text-xs text-muted-foreground">
                No se encontró el resumen del usuario.
              </p>
            ) : (
              <>
                <section className="space-y-2">
                  <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <Activity className="size-3.5" />
                    Actividad en el taller
                  </h3>
                  <div className="grid grid-cols-3 gap-2 rounded-lg border p-3 text-center">
                    <div>
                      <p className="text-lg font-bold tabular-nums">
                        {summary.activeAssignedIncidents}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        Incidencias activas
                      </p>
                    </div>
                    <div>
                      <p className="text-lg font-bold tabular-nums">
                        {summary.assignedIncidentsTotal}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        Total asignadas
                      </p>
                    </div>
                    <div>
                      <p className="text-lg font-bold tabular-nums">
                        {summary.requestsCount}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        Peticiones
                      </p>
                    </div>
                  </div>
                </section>

                <section className="space-y-2">
                  <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <ShieldCheck className="size-3.5" />
                    Capacidades efectivas ({summary.capabilities.length})
                  </h3>
                  {summary.capabilities.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      Sin capacidades concedidas para este rol.
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {summary.capabilities.map((cap) => (
                        <Badge key={cap.key} variant="secondary">
                          {cap.label}
                        </Badge>
                      ))}
                    </div>
                  )}
                </section>

                <section className="space-y-2">
                  <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <History className="size-3.5" />
                    Últimos movimientos de stock
                  </h3>
                  {summary.recentMovements.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      Sin movimientos de almacén recientes registrados.
                    </p>
                  ) : (
                    <ul className="divide-y rounded-lg border">
                      {summary.recentMovements.map((mov) => {
                        const meta =
                          STOCK_MOVEMENT_META[mov.kind as StockMovementKind] ?? {
                            label: mov.kind,
                            signTone: "neutral",
                          };
                        const deltaText =
                          mov.delta > 0 ? `+${mov.delta}` : String(mov.delta);
                        return (
                          <li
                            key={mov._id}
                            className="flex items-center justify-between gap-2 px-3 py-2 text-xs"
                          >
                            <div className="min-w-0">
                              <p className="truncate font-medium">
                                {mov.partName}
                              </p>
                              <p className="truncate text-muted-foreground">
                                {meta.label} · {formatDateTime(mov.createdAt)}
                              </p>
                            </div>
                            <span className="shrink-0 font-semibold tabular-nums">
                              {deltaText}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </section>
              </>
            )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
