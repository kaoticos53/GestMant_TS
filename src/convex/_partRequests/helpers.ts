import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { hasCapability } from "../permissions";
import {
  canEditRequest,
  nextRequestStatus,
  type RequestAction,
} from "../../lib/requestFlow";
import { richDocToPlainText, richDocToStore } from "../../lib/richDoc";

/** Toda la gestión de peticiones requiere sesión iniciada. */
export async function requireUser(ctx: QueryCtx): Promise<Id<"users">> {
  const userId = await getAuthUserId(ctx);
  if (userId === null) {
    throw new ConvexError(
      "Debes iniciar sesión para gestionar las peticiones.",
    );
  }
  const user = await ctx.db.get(userId);
  if (!user || user.active === false || user.isAnonymous === true) {
    throw new ConvexError(
      user?.active === false
        ? "Esta cuenta ha sido dada de baja o no está activa."
        : "Debes iniciar sesión con una cuenta registrada para gestionar las peticiones.",
    );
  }
  return userId;
}

/** Decisiones sobre peticiones: capacidad «decideRequests» (admin siempre). */
export async function requireDecisionCapability(
  ctx: QueryCtx,
  action: string,
): Promise<Id<"users">> {
  const userId = await requireUser(ctx);
  const user = await ctx.db.get(userId);
  if (!user || !(await hasCapability(ctx, user, "decideRequests"))) {
    throw new ConvexError(
      `No tienes permisos para ${action}. Revisa la configuración de tu rol con el administrador.`,
    );
  }
  return userId;
}

/** Nombre visible de quien firma una decisión. */
export async function actorName(
  ctx: QueryCtx,
  userId: Id<"users">,
): Promise<string> {
  const user = await ctx.db.get(userId);
  return user?.name || user?.email || "Responsable de repuestos";
}

/**
 * El motivo de una decisión, tal y como se guarda: el documento que escribe el
 * editor —con sus negritas, sus listas y sus fotos— o, si no dice nada, nada.
 */
export function decisionReason(note: string | undefined): string | undefined {
  return richDocToStore(note);
}

/**
 * El mismo motivo, en una línea: es lo que queda en la traza de decisiones, que
 * se lee de un vistazo y no admite el formato de la ficha.
 */
export function reasonOneLine(reason: string | undefined): string {
  return richDocToPlainText(reason);
}

export const attachmentArgs = v.array(
  v.object({
    storageId: v.id("_storage"),
    name: v.string(),
    kind: v.union(v.literal("image"), v.literal("document")),
  }),
);

export const partPayloadArgs = {
  code: v.string(),
  name: v.string(),
  description: v.optional(v.string()),
  category: v.string(),
  unit: v.string(),
  stock: v.number(),
  minStock: v.number(),
  location: v.optional(v.string()),
  supplier: v.optional(v.string()),
  partNumber: v.optional(v.string()),
  unitPrice: v.optional(v.number()),
  purchaseUrl: v.optional(v.string()),
};

export type PartPayload = {
  code: string;
  name: string;
  description?: string;
  category: string;
  unit: string;
  stock: number;
  minStock: number;
  location?: string;
  supplier?: string;
  partNumber?: string;
  unitPrice?: number;
  purchaseUrl?: string;
};

/** Construye el documento de repuesto a partir de los datos del formulario. */
export function buildPart(payload: PartPayload) {
  const code = payload.code.trim().toUpperCase();
  const name = payload.name.trim();
  if (!code) throw new ConvexError("El código del repuesto es obligatorio.");
  if (!name) throw new ConvexError("El nombre del repuesto es obligatorio.");
  return {
    code,
    name,
    ...(richDocToStore(payload.description)
      ? { description: richDocToStore(payload.description) }
      : {}),
    category: payload.category,
    unit: payload.unit.trim() || "ud",
    stock: Math.max(0, Math.floor(payload.stock)),
    minStock: Math.max(0, Math.floor(payload.minStock)),
    ...(payload.location?.trim()
      ? { location: payload.location.trim().toUpperCase() }
      : {}),
    ...(payload.supplier?.trim() ? { supplier: payload.supplier.trim() } : {}),
    ...(payload.partNumber?.trim()
      ? { partNumber: payload.partNumber.trim() }
      : {}),
    ...(typeof payload.unitPrice === "number" && payload.unitPrice >= 0
      ? { unitPrice: payload.unitPrice }
      : {}),
    ...(payload.purchaseUrl?.trim()
      ? { purchaseUrl: payload.purchaseUrl.trim() }
      : {}),
  };
}

export async function assertPending(ctx: QueryCtx, requestId: Id<"partRequests">) {
  const request = await ctx.db.get(requestId);
  if (!request) throw new ConvexError("La petición ya no existe.");
  if (!canEditRequest(request.status)) {
    throw new ConvexError(
      `La petición ${request.reference} ya fue resuelta y no puede modificarse.`,
    );
  }
  return request;
}

/** El paso, o el aviso de por qué no se puede dar desde donde está. */
export function requireRequestStep(
  request: Doc<"partRequests">,
  action: RequestAction,
  blocked: (status: Doc<"partRequests">["status"]) => string,
): Doc<"partRequests">["status"] {
  const next = nextRequestStatus(request.status, action, request.heldFrom);
  if (next === null) throw new ConvexError(blocked(request.status));
  return next;
}
