import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { readAuditAlertRoles } from "../auditAlerts";
import { hasCapability } from "../permissions";
import { DEFAULT_ROLE } from "../../lib/roles";
import { INCIDENT_STATUSES, ROLES } from "../schema";

export type Actor = Doc<"users">;
export type LifecycleNote = NonNullable<Doc<"incidents">["lifecycleNotes"]>[number];

/** Coordinador del taller: responsable de repuestos o administrador. */
export function isModerator(user: Actor | null): boolean {
  return user?.role === ROLES.ADMIN || user?.role === ROLES.MANAGER;
}

export function actorName(user: Actor): string {
  return user.name?.trim() || user.email?.trim() || "Usuario del taller";
}

/** ¿La incidencia está en manos de este actor (técnico u orden de taller)? */
export function isAssignedTo(actor: Actor, incident: Doc<"incidents">): boolean {
  return (
    incident.assigneeId === actor._id ||
    incident.workshopAssigneeId === actor._id
  );
}

/** Usuario autenticado o error. */
export async function requireActor(ctx: QueryCtx | MutationCtx): Promise<Actor> {
  const userId = await getAuthUserId(ctx);
  const user = userId === null ? null : await ctx.db.get(userId);
  if (!user || user.active === false || user.isAnonymous === true) {
    throw new ConvexError(
      user?.active === false
        ? "Esta cuenta ha sido dada de baja o no está activa."
        : "Debes iniciar sesión con una cuenta registrada para gestionar incidencias.",
    );
  }
  return user;
}

export async function getIncident(ctx: QueryCtx | MutationCtx, id: Id<"incidents">) {
  const incident = await ctx.db.get(id);
  if (!incident) throw new ConvexError("La incidencia ya no existe.");
  return incident;
}

/**
 * Quién puede corregir los datos del equipo: el mismo que escribe en el
 * cuaderno —quien coordina y quien tiene la incidencia entre manos—, que es
 * quien puede llegar a saber el modelo y el número de serie de verdad.
 */
export async function requireEquipmentEditor(
  ctx: MutationCtx,
  actor: Actor,
  incident: Doc<"incidents">,
): Promise<void> {
  if (await hasCapability(ctx, actor, "manageIncidents")) return;
  if (isAssignedTo(actor, incident)) return;
  throw new ConvexError(
    "Solo el técnico asignado o quien coordina la incidencia pueden corregir los datos del equipo.",
  );
}

/**
 * Quién recibe los avisos del expediente: los usuarios activos cuyo rol está en
 * la audiencia configurada en «Ajustes del taller».
 */
export async function auditAlertRecipientIds(
  ctx: MutationCtx,
): Promise<Id<"users">[]> {
  const roles = new Set(await readAuditAlertRoles(ctx));
  if (roles.size === 0) return [];
  const users = await ctx.db.query("users").collect();
  return users
    .filter(
      (user) => user.active !== false && roles.has(user.role ?? DEFAULT_ROLE),
    )
    .map((user) => user._id);
}

/** Traza que cada paso deja en la ficha de la incidencia. */
export function historyEntry(
  status: (typeof INCIDENT_STATUSES)[keyof typeof INCIDENT_STATUSES],
  at: number,
  by?: string,
  note?: string,
) {
  return {
    status,
    at,
    ...(by ? { by } : {}),
    ...(note ? { note } : {}),
  };
}

/**
 * Control de Concurrencia Optimista (Optimistic Locking).
 * Si el cliente envía `expectedUpdatedAt` y la incidencia en base de datos
 * tiene un `updatedAt` posterior, se rechaza la mutación para evitar sobreescritura
 * accidental entre técnicos concurrentes.
 */
export function assertIncidentNotModified(
  incident: Doc<"incidents">,
  expectedUpdatedAt?: number,
): void {
  if (expectedUpdatedAt === undefined) return;
  if (incident.updatedAt > expectedUpdatedAt) {
    throw new ConvexError(
      "CONFLICT: La incidencia ha sido modificada por otro usuario mientras la editabas. Por favor, revisa los cambios antes de continuar.",
    );
  }
}

