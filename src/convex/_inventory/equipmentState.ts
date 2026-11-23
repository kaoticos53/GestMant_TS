import { isIncidentInProgress } from "../../lib/incidentFlow";
import { resolveOperationalState } from "../../lib/movements";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { INCIDENT_STATUSES } from "../schema";

/**
 * Recalcula y sincroniza `equipment.operationalState` a partir de su baja,
 * préstamo activo e incidencias vivas vinculadas (`by_equipment_and_created`).
 */
export async function syncEquipmentOperationalState(
  ctx: MutationCtx,
  equipmentId: Id<"equipment">,
  now: number = Date.now(),
): Promise<void> {
  const equipment = await ctx.db.get(equipmentId);
  if (!equipment) return;

  let nextState = resolveOperationalState({
    decommissionDate: equipment.decommissionDate,
    currentLoan: equipment.currentLoan,
    operationalState: "operational",
  });

  if (nextState === "operational") {
    const linked = await ctx.db
      .query("incidents")
      .withIndex("by_equipment_and_created", (q) =>
        q.eq("equipmentId", equipmentId),
      )
      .collect();
    const active = linked.filter(
      (inc) =>
        inc.deletedAt === undefined &&
        inc.archivedAt === undefined &&
        isIncidentInProgress(inc.status),
    );
    if (
      active.some((inc) => inc.status === INCIDENT_STATUSES.EXTERNAL_REPAIR)
    ) {
      nextState = "external_repair";
    } else if (
      active.some((inc) => inc.status === INCIDENT_STATUSES.WORKSHOP)
    ) {
      nextState = "in_workshop";
    }
  }

  if (equipment.operationalState !== nextState) {
    await ctx.db.patch(equipmentId, {
      operationalState: nextState,
      updatedAt: now,
    });
  }
}
