import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { query } from "./_generated/server";
import { grantsForRoles, memberStatus } from "./permissions";
import { effectiveUserRoles } from "../lib/roles";
import {
  MAX_GLOBAL_SEARCH_PER_GROUP,
  includesSearchQuery,
  normalizeSearchText,
} from "../lib/globalSearch";
import { richDocToPlainText } from "../lib/richDoc";
import {
  INCIDENT_STATUS_META,
  STATUS_META,
  equipmentLabel,
  looksLikeIncidentReference,
  normalizeIncidentReference,
} from "../lib/workshop";

export interface GlobalSearchResponse {
  incidents: Array<{
    kind: "incident";
    id: Id<"incidents">;
    title: string;
    subtitle: string;
    archived: boolean;
  }>;
  requests: Array<{
    kind: "request";
    id: Id<"partRequests">;
    title: string;
    subtitle: string;
    archived: boolean;
  }>;
  archived: Array<
    | {
        kind: "incident";
        id: Id<"incidents">;
        title: string;
        subtitle: string;
        archived: true;
      }
    | {
        kind: "request";
        id: Id<"partRequests">;
        title: string;
        subtitle: string;
        archived: true;
      }
  >;
  parts: Array<{
    kind: "part";
    id: Id<"spareParts">;
    term: string;
    title: string;
    subtitle: string;
  }>;
  equipment: Array<{
    kind: "equipment";
    id: Id<"equipment">;
    term: string;
    title: string;
    subtitle: string;
  }>;
}

const EMPTY_RESPONSE: GlobalSearchResponse = {
  incidents: [],
  requests: [],
  archived: [],
  parts: [],
  equipment: [],
};

/**
 * Búsqueda global del taller ejecutada en el backend:
 * evita descargar 4 tablas completas al navegador y respeta las capacidades del rol.
 */
export const global = query({
  args: {
    query: v.string(),
    limitPerGroup: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<GlobalSearchResponse> => {
    const trimmed = args.query.trim();
    const q = normalizeSearchText(trimmed);
    if (!q) return EMPTY_RESPONSE;

    const { user, issue } = await memberStatus(ctx);
    if (issue || !user) return EMPTY_RESPONSE;

    const grants = await grantsForRoles(ctx, effectiveUserRoles(user));
    const canIncidents = Boolean(
      grants.viewIncidents || grants.manageIncidents,
    );
    const canRequests = Boolean(
      grants.viewRequests || grants.createRequests || grants.decideRequests,
    );
    const canParts = Boolean(
      grants.viewInventory || grants.manageInventory,
    );
    const canEquipment = Boolean(
      grants.viewEquipment || grants.manageEquipment,
    );

    const limit = Math.min(
      10,
      Math.max(1, args.limitPerGroup ?? MAX_GLOBAL_SEARCH_PER_GROUP),
    );

    const incidentHits: GlobalSearchResponse["incidents"] = [];
    if (canIncidents) {
      const ref = looksLikeIncidentReference(trimmed)
        ? normalizeIncidentReference(trimmed)
        : null;
      const byExactRef =
        ref !== null
          ? await ctx.db
              .query("incidents")
              .withIndex("by_reference", (idx) => idx.eq("reference", ref))
              .first()
          : null;
      const incidents =
        byExactRef && byExactRef.deletedAt === undefined
          ? [byExactRef]
          : await ctx.db
              .query("incidents")
              .withIndex("by_createdAt")
              .order("desc")
              .collect();

      for (const incident of incidents) {
        if (incident.deletedAt !== undefined) continue;
        const matched =
          (ref !== null && incident.reference === ref) ||
          [
            incident.reference,
            incident.equipmentKind ?? "",
            incident.model ?? "",
            incident.serialNumber ?? "",
            incident.location ?? "",
            incident.reporterName,
            richDocToPlainText(incident.description),
          ].some((value) => includesSearchQuery(value, q));

        if (!matched) continue;
        incidentHits.push({
          kind: "incident",
          id: incident._id,
          title: incident.reference,
          subtitle: [
            INCIDENT_STATUS_META[incident.status]?.label,
            [incident.equipmentKind, incident.model].filter(Boolean).join(" "),
            incident.location,
          ]
            .filter(Boolean)
            .join(" · "),
          archived: incident.archivedAt !== undefined,
        });
        if (incidentHits.length >= limit * 2) break;
      }
    }

    const requestHits: GlobalSearchResponse["requests"] = [];
    if (canRequests) {
      const requests = await ctx.db
        .query("partRequests")
        .order("desc")
        .collect();

      for (const request of requests) {
        if (request.deletedAt !== undefined) continue;
        const matched = [
          request.reference,
          request.requesterName,
          request.requesterTeam ?? "",
          request.equipment ?? "",
          richDocToPlainText(request.description),
          (request.lines ?? [])
            .map((line) => `${line.code} ${line.name}`)
            .join(" "),
        ].some((value) => includesSearchQuery(value, q));

        if (!matched) continue;
        requestHits.push({
          kind: "request",
          id: request._id,
          title: request.reference,
          subtitle: `${STATUS_META[request.status]?.label ?? STATUS_META.pending.label} · ${request.requesterName}${
            request.equipment ? ` · ${request.equipment}` : ""
          }`,
          archived: request.archivedAt !== undefined,
        });
        if (requestHits.length >= limit * 2) break;
      }
    }

    const archived: GlobalSearchResponse["archived"] = [
      ...incidentHits.filter(
        (h): h is Extract<typeof h, { archived: boolean }> & { archived: true } =>
          h.archived,
      ),
      ...requestHits.filter(
        (h): h is Extract<typeof h, { archived: boolean }> & { archived: true } =>
          h.archived,
      ),
    ].slice(0, limit);

    const partHits: GlobalSearchResponse["parts"] = [];
    if (canParts) {
      const parts = await ctx.db.query("spareParts").collect();
      for (const part of parts) {
        const matched = [
          part.code,
          part.name,
          richDocToPlainText(part.description),
          part.category,
          part.partNumber ?? "",
          part.supplier ?? "",
          part.location ?? "",
        ].some((value) => includesSearchQuery(value, q));

        if (!matched) continue;
        partHits.push({
          kind: "part",
          id: part._id,
          term: part.code,
          title: `${part.code} · ${part.name}`,
          subtitle: `${part.category} · stock ${part.stock}${
            part.location ? ` · ${part.location}` : ""
          }`,
        });
        if (partHits.length >= limit) break;
      }
    }

    const equipmentHits: GlobalSearchResponse["equipment"] = [];
    if (canEquipment) {
      const items = await ctx.db.query("equipment").collect();
      for (const item of items) {
        const matched = [
          item.code ?? "",
          item.brand ?? "",
          item.name,
          item.model,
          item.location ?? "",
          item.serialNumber ?? "",
          item.supplier ?? "",
        ].some((value) => includesSearchQuery(value, q));

        if (!matched) continue;
        equipmentHits.push({
          kind: "equipment",
          id: item._id,
          term: item.code ?? item.model,
          title: equipmentLabel(item),
          subtitle: [item.code, item.serialNumber, item.location]
            .filter(Boolean)
            .join(" · "),
        });
        if (equipmentHits.length >= limit) break;
      }
    }

    return {
      incidents: incidentHits.filter((h) => !h.archived).slice(0, limit),
      requests: requestHits.filter((h) => !h.archived).slice(0, limit),
      archived,
      parts: partHits,
      equipment: equipmentHits,
    };
  },
});
