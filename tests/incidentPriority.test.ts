import { backend } from "./backend";
import { describe, expect, test } from "vitest";
import { api, internal } from "../src/convex/_generated/api";
import { readIncidentIntake } from "../src/lib/incidentIntake";
import {
  DEFAULT_INCIDENT_PRIORITY,
  INCIDENT_PRIORITY_META,
  incidentPriorityRank,
  normalizeIncidentPriority,
} from "../src/lib/workshop";

describe("Prioridad de incidencias y notas públicas (lógica + backend)", () => {
  test("prioridad por defecto es media y el ranking ordena urgente > alta > media > baja", () => {
    expect(DEFAULT_INCIDENT_PRIORITY).toBe("medium");
    expect(normalizeIncidentPriority(undefined)).toBe("medium");
    expect(normalizeIncidentPriority("urgent")).toBe("urgent");
    expect(INCIDENT_PRIORITY_META.medium.label).toBe("Media");

    expect(incidentPriorityRank("urgent")).toBeGreaterThan(
      incidentPriorityRank("high"),
    );
    expect(incidentPriorityRank("high")).toBeGreaterThan(
      incidentPriorityRank("medium"),
    );
    expect(incidentPriorityRank("medium")).toBeGreaterThan(
      incidentPriorityRank("low"),
    );

    const parsed = readIncidentIntake({
      reporterName: "Laura",
      description: "La cámara no enciende al conectarla a corriente.",
      reportedAt: Date.now(),
    });
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.intake.priority).toBe("medium");
    }
  });

  test("alta, changePriority, userNote al resolver y exposición en seguimiento público (byCode)", async () => {
    const t = backend();
    const coordId = await t.run((ctx) =>
      ctx.db.insert("users", {
        name: "Coordinador",
        email: "coord@taller.es",
        role: "admin",
      }),
    );
    const coord = t.withIdentity({ subject: `${coordId}|s1` });

    const created = await t.mutation(internal.incidents.commitReport, {
      reporterName: "Marta",
      description: "Fallo de señal SDI en salida principal del estudio.",
      reportedAt: Date.now(),
      priority: "low",
      isAuthenticatedMember: true,
    });

    const [incident] = await coord.query(api.incidents.list, {});
    expect(incident.priority).toBe("low");

    await coord.mutation(api.incidents.changePriority, {
      incidentId: incident._id,
      priority: "urgent",
      note: "Afecta al directo de las 14:00",
    });

    await coord.mutation(api.incidents.assign, {
      incidentId: incident._id,
      assigneeId: coordId,
    });

    await coord.mutation(api.incidents.verify, {
      incidentId: incident._id,
      outcome: "onsite",
      notes: "Nota interna: conector BNC flojo en patch",
      userNote: "Se ha reajustado el conector y ya vuelve a haber señal.",
    });

    const tracking = await t.mutation(api.incidents.byCode, {
      code: created.code,
    });
    expect(tracking).not.toBeNull();
    expect(tracking?.priority).toBe("urgent");
    expect(tracking?.priorityNote).toBe("Afecta al directo de las 14:00");
    expect(tracking?.priorityChangedAt).toBeDefined();
    expect(tracking?.userNote).toBe(
      "Se ha reajustado el conector y ya vuelve a haber señal.",
    );
    // La nota interna del taller nunca viaja en trackingOf
    expect(JSON.stringify(tracking)).not.toContain("conector BNC flojo");
  });
});
