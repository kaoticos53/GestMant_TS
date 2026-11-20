import { computeStockDelta, type EquipmentMovementKind, type StockMovementKind } from "../../lib/movements";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

export async function recordStockMovement(
  ctx: MutationCtx,
  args: {
    sparePartId: Id<"spareParts">;
    partCode: string;
    partName: string;
    kind: StockMovementKind;
    previousStock: number;
    nextStock: number;
    reason?: string;
    reference?: string;
    actorId?: Id<"users">;
    actorName: string;
    createdAt?: number;
  },
): Promise<void> {
  const change = computeStockDelta(args.previousStock, args.nextStock);
  if (change === null && args.kind !== "initial") {
    return;
  }
  if (args.kind === "initial" && args.nextStock === 0) {
    return;
  }

  const delta = change ? change.delta : args.nextStock - args.previousStock;
  await ctx.db.insert("stockMovements", {
    sparePartId: args.sparePartId,
    partCode: args.partCode,
    partName: args.partName,
    kind: args.kind,
    previousStock: args.previousStock,
    delta,
    nextStock: args.nextStock,
    ...(args.reason?.trim() ? { reason: args.reason.trim() } : {}),
    ...(args.reference?.trim() ? { reference: args.reference.trim() } : {}),
    ...(args.actorId ? { actorId: args.actorId } : {}),
    actorName: args.actorName.trim() || "Sistema",
    createdAt: args.createdAt ?? Date.now(),
  });
}

export async function recordEquipmentMovement(
  ctx: MutationCtx,
  args: {
    equipmentId: Id<"equipment">;
    equipmentCode?: string;
    equipmentName: string;
    kind: EquipmentMovementKind;
    fromLocation?: string;
    toLocation?: string;
    note?: string;
    actorId?: Id<"users">;
    actorName: string;
    createdAt?: number;
  },
): Promise<void> {
  await ctx.db.insert("equipmentMovements", {
    equipmentId: args.equipmentId,
    ...(args.equipmentCode ? { equipmentCode: args.equipmentCode } : {}),
    equipmentName: args.equipmentName,
    kind: args.kind,
    ...(args.fromLocation ? { fromLocation: args.fromLocation } : {}),
    ...(args.toLocation ? { toLocation: args.toLocation } : {}),
    ...(args.note?.trim() ? { note: args.note.trim() } : {}),
    ...(args.actorId ? { actorId: args.actorId } : {}),
    actorName: args.actorName.trim() || "Sistema",
    createdAt: args.createdAt ?? Date.now(),
  });
}
