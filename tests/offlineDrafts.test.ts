import { describe, expect, test } from "vitest";
import { api } from "../src/convex/_generated/api";
import {
  OFFLINE_DRAFT_SAVED_NOTICE,
  clientDraftId,
  countOfflineDrafts,
  deleteOfflineDraft,
  isOfflineIncidentDraft,
  listOfflineDrafts,
  pendingDraftsNotice,
  saveOfflineDraft,
  sortOfflineDrafts,
  type OfflineIncidentDraft,
} from "../src/lib/offlineDrafts";
import { backend } from "./backend";

/**
 * El aviso que se escribe sin red: las reglas del borrador —la marca para no
 * duplicarlo, qué se considera válido, en qué orden sale— y el freno del
 * backend que hace que reintentarlo no cree dos incidencias.
 */

function draft(id: string, savedAt: number): OfflineIncidentDraft {
  return {
    id,
    savedAt,
    payload: {
      reporterName: "Nuria Cano",
      description: "El foco no mantiene la intensidad.",
      reportedAt: savedAt,
    },
  };
}

describe("borradores sin conexión", () => {
  test("cada aviso lleva una marca propia", () => {
    const one = clientDraftId(1_700_000_000_000, () => 0.5);
    const two = clientDraftId(1_700_000_000_000, () => 0.9);
    expect(one).toMatch(/^draft-[0-9a-z]+-[0-9a-z]+$/);
    expect(one).not.toBe(two);
    // Dos avisos seguidos, en el mismo milisegundo, tampoco coinciden.
    expect(clientDraftId(1_700_000_000_000, () => 0.1)).not.toBe(
      clientDraftId(1_700_000_000_001, () => 0.1),
    );
  });

  test("solo se aceptan borradores con la forma esperada", () => {
    expect(isOfflineIncidentDraft(draft("draft-1", 10))).toBe(true);
    expect(isOfflineIncidentDraft(null)).toBe(false);
    expect(isOfflineIncidentDraft({})).toBe(false);
    // Sin nombre no hay aviso que valga: es lo primero que pide el formulario.
    expect(
      isOfflineIncidentDraft({
        ...draft("draft-1", 10),
        payload: { ...draft("draft-1", 10).payload, reporterName: "  " },
      }),
    ).toBe(false);
    expect(
      isOfflineIncidentDraft({ ...draft("draft-1", 10), savedAt: Number.NaN }),
    ).toBe(false);
  });

  test("la cola sale del más antiguo al más reciente", () => {
    const ordered = sortOfflineDrafts([
      draft("draft-3", 300),
      draft("draft-1", 100),
      draft("draft-2", 200),
    ]);
    expect(ordered.map((item) => item.id)).toEqual([
      "draft-1",
      "draft-2",
      "draft-3",
    ]);
  });

  test("lo que se le dice a quien guarda sin red", () => {
    expect(OFFLINE_DRAFT_SAVED_NOTICE).toContain("Guardado localmente");
    expect(pendingDraftsNotice(0)).toBeNull();
    expect(pendingDraftsNotice(1)).toContain("1 aviso");
    expect(pendingDraftsNotice(4)).toContain("4 avisos");
  });

  test("sin almacenamiento no se promete nada", async () => {
    // En Node no hay IndexedDB: las llamadas se callan en vez de romper el
    // formulario, y guardar contesta que no se ha guardado.
    expect(typeof indexedDB).toBe("undefined");
    expect(await saveOfflineDraft(draft("draft-1", 10))).toBe(false);
    expect(await listOfflineDrafts()).toEqual([]);
    expect(await deleteOfflineDraft("draft-1")).toBe(false);
    expect(await countOfflineDrafts()).toBe(0);
  });
});

describe("reenviar el mismo borrador no duplica la incidencia", () => {
  const aviso = {
    reporterName: "Nuria Cano",
    reporterRole: "Servicios técnicos",
    description: "El foco no mantiene la intensidad y se queda al 50 %.",
    reportedAt: new Date(2026, 9, 8, 12, 0, 0).getTime(),
  };

  test("el segundo envío devuelve el caso del primero", async () => {
    const t = backend();
    const primero = await t.mutation(api.incidents.report, {
      ...aviso,
      clientDraftId: "draft-abc-123",
    });
    const segundo = await t.mutation(api.incidents.report, {
      ...aviso,
      clientDraftId: "draft-abc-123",
    });

    expect(segundo).toEqual(primero);
    const total = await t.run(
      async (ctx) => (await ctx.db.query("incidents").collect()).length,
    );
    expect(total).toBe(1);
  });

  test("dos avisos distintos son dos incidencias", async () => {
    const t = backend();
    await t.mutation(api.incidents.report, {
      ...aviso,
      clientDraftId: "draft-abc-123",
    });
    await t.mutation(api.incidents.report, {
      ...aviso,
      reporterName: "Iván Torres",
      clientDraftId: "draft-def-456",
    });

    const total = await t.run(
      async (ctx) => (await ctx.db.query("incidents").collect()).length,
    );
    expect(total).toBe(2);
  });
});
