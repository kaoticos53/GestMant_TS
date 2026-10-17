import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import {
  canAdvanceIncident,
  incidentStepStatus,
  incidentWithoutPartsStep,
  isIncidentInWorkshop,
  isIncidentRepairing,
  type IncidentAction,
} from "../../lib/incidentFlow";
import {
  isRequestAwaitingDelivery,
  isRequestDelivered,
} from "../../lib/requestFlow";
import { historyEntry } from "../_incidents/helpers";
import { scheduleReporterEmail } from "../incidentMail";
import { notifyUsers } from "../notify";

/**
 * El otro lado de la petición de repuestos: lo que le pasa a la incidencia que la
 * abrió.
 *
 * La incidencia y la petición son dos máquinas, pero una cuelga de la otra: quien
 * pide material para un caso lo hace porque sin él no puede seguir, y quien lo
 * entrega cierra esa espera. Esto es el puente, escrito una sola vez para que las
 * cuatro mutaciones que lo cruzan —abrir, entregar y las tres formas de cerrar
 * una petición sin servir material— cuenten la misma historia.
 *
 * No decide estados por su cuenta: pregunta a `lib/incidentFlow` si el paso cabe
 * desde donde está la incidencia y escribe el destino que dice su tabla
 * (`incidentStepStatus`). Si no cabe —una incidencia ya cerrada, o una petición
 * abierta para un caso que nunca entró en el flujo— no toca nada.
 */

/** Los avisos que recibe quien trabaja la incidencia. */
function interestedIn(incident: Doc<"incidents">): Id<"users">[] {
  return [incident.assigneeId, incident.workshopAssigneeId].filter(
    (id): id is Id<"users"> => Boolean(id),
  );
}

/**
 * La petición recién abierta deja la incidencia esperando el material. Deja su
 * rastro en la ficha, avisa a quien la lleva y a quien la notificó, y no hace
 * nada si la incidencia no admite una espera más (`waitParts` no cabe desde un
 * caso cerrado, ni desde uno que ya está esperando).
 */
export async function holdIncidentForParts(
  ctx: MutationCtx,
  incident: Doc<"incidents">,
  args: { reference: string; by: string },
): Promise<void> {
  const action: IncidentAction = "waitParts";
  if (!canAdvanceIncident(incident.status, action)) return;
  const status = incidentStepStatus(action);
  const now = Date.now();

  await ctx.db.patch(incident._id, {
    status,
    updatedAt: now,
    history: [
      ...incident.history,
      historyEntry(
        status,
        now,
        args.by,
        `Petición de repuestos ${args.reference} · a la espera de material`,
      ),
    ],
  });
  await notifyUsers(
    ctx,
    interestedIn(incident),
    `${incident.reference} en espera de repuestos (${args.reference})`,
    incident._id,
  );
  await scheduleReporterEmail(ctx, incident, status);
}

/**
 * ¿Sigue la incidencia esperando material? Es la pregunta que se hace al cerrar
 * una petición: mientras quede una viva que no haya llegado a entregarse, la
 * espera sigue teniendo sentido.
 */
async function requestsAwaitingDelivery(
  ctx: MutationCtx,
  incidentId: Id<"incidents">,
): Promise<Doc<"partRequests">[]> {
  const requests = await ctx.db
    .query("partRequests")
    .withIndex("by_incident", (q) => q.eq("incidentId", incidentId))
    .collect();
  // Lo retirado a la papelera no cuenta: es material que se pidió por error o se
  // duplicó, y no es lo que está esperando el taller.
  return requests.filter((request) => request.deletedAt === undefined);
}

/**
 * El efecto de un cambio en una petición vinculada, mirado desde la incidencia:
 *
 * - mientras alguna petición viva siga pendiente de entrega, la espera continúa
 *   y no hay nada que mover;
 * - cuando ya no queda ninguna y alguna llegó a entregarse, la incidencia deja de
 *   esperar y pasa a **en reparación** (`partsArrived`);
 * - si no queda ninguna entregada —se rechazaron, se cancelaron o se devolvió el
 *   material— y la incidencia estaba en reparación, vuelve a **esperar
 *   repuestos** (`waitParts`): otra vez le falta la pieza;
 * - y si nunca llegó a repararse, vuelve a donde estaba —el taller si su entrada
 *   sigue abierta, la asignación si no— (`partsSettled*`), en vez de quedarse
 *   esperando lo que ya no va a llegar.
 *
 * Se llama después de entregar, rechazar, cancelar o devolver material. Antes de
 * eso, quien llama ya movió la petición.
 */
export async function syncIncidentWithParts(
  ctx: MutationCtx,
  incidentId: Id<"incidents">,
  by: string,
): Promise<void> {
  const incident = await ctx.db.get(incidentId);
  if (!incident) return;

  const live = await requestsAwaitingDelivery(ctx, incidentId);
  if (live.length === 0) return;
  if (live.some((request) => isRequestAwaitingDelivery(request.status))) return;

  const delivered = live.some((request) => isRequestDelivered(request.status));
  const inWorkshop = isIncidentInWorkshop(incident);
  const returnedToWait = !delivered && isIncidentRepairing(incident.status);
  const action: IncidentAction = delivered
    ? "partsArrived"
    : returnedToWait
      ? "waitParts"
      : incidentWithoutPartsStep(inWorkshop);
  if (!canAdvanceIncident(incident.status, action)) return;

  const status = incidentStepStatus(action);
  const now = Date.now();
  const note = delivered
    ? "Repuestos entregados en su totalidad · a reparación"
    : returnedToWait
      ? "Material devuelto · vuelve a la espera de repuestos"
      : inWorkshop
        ? "Peticiones de repuestos cerradas sin material · vuelve al taller"
        : "Peticiones de repuestos cerradas sin material · vuelve al técnico";
  const message = delivered
    ? `${incident.reference} con los repuestos entregados: en reparación`
    : returnedToWait
      ? `${incident.reference} vuelve a esperar repuestos`
      : `${incident.reference} ya no espera repuestos`;

  await ctx.db.patch(incident._id, {
    status,
    updatedAt: now,
    history: [...incident.history, historyEntry(status, now, by, note)],
  });
  await notifyUsers(ctx, interestedIn(incident), message, incident._id);
  await scheduleReporterEmail(ctx, incident, status);
}
