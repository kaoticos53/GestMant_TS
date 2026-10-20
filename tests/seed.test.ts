import { backend } from "./backend";
import { ConvexError } from "convex/values";
import { describe, expect, test } from "vitest";
import { api, internal } from "../src/convex/_generated/api";
import { DEFAULT_GRANTS } from "../src/lib/permissions";
import { SAMPLE_PHOTOS, samplePhotoBytes } from "../src/lib/samplePhotos";
import { SAMPLE_MANUALS } from "../src/lib/sampleManuals";
import {
  MANUAL_TYPES,
  manualFileVersions,
  manualsForEquipment,
} from "../src/lib/manuals";
import { PART_CATEGORIES } from "../src/lib/workshop";
import { normalizeCatalogString } from "../src/lib/catalogs";

/** La firma de un PNG: es lo que distingue una foto de un puñado de bytes. */
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

const DAY = 24 * 60 * 60 * 1000;

/** La petición de la muestra que salió en dos tandas, una por semana. */
const PET_EN_DOS_TANDAS = "PET-0005";

/** Test con sesión iniciada y el rol indicado. */
async function authedTest(role: "manager" | "technician") {
  const t = backend();
  const userId = await t.run((ctx) =>
    ctx.db.insert("users", {
      name: "Usuario de prueba",
      email: `${role}@taller.es`,
      role,
    }),
  );
  return t.withIdentity({ subject: `${userId}|session1` });
}

describe("datos de ejemplo (cadena de televisión)", () => {
  test("el seed crea una muestra larga y coherente", async () => {
    const authed = await authedTest("manager");
    expect(await authed.mutation(api.seed.seedDemoData, {})).toBe(true);

    const equipment = await authed.query(api.equipment.list, {});
    const parts = await authed.query(api.spareParts.list, {});
    const requests = await authed.query(api.partRequests.list, {
      includeArchived: true,
    });
    const maintenance = await authed.query(api.maintenance.list, {});
    const incidents = await authed.query(api.incidents.list, {
      includeArchived: true,
    });

    // Volumen suficiente para probar listados paginados, filtros y archivo
    expect(equipment.length).toBeGreaterThanOrEqual(20);
    expect(parts.length).toBeGreaterThanOrEqual(30);
    expect(requests.length).toBeGreaterThanOrEqual(60);
    expect(maintenance.length).toBeGreaterThanOrEqual(40);
    expect(incidents.length).toBeGreaterThanOrEqual(70);

    // El trazo de cada paso queda en la ficha de la incidencia, en orden
    for (const incident of incidents) {
      expect(incident.history.length).toBeGreaterThanOrEqual(1);
      expect(incident.history[0].status).toBe("reported");
      expect(incident.history.at(-1)!.status).toBe(incident.status);
      expect(incident.createdAt).toBe(incident.reportedAt);
      expect(incident.updatedAt).toBeGreaterThanOrEqual(incident.reportedAt);
    }

    // Alguna nota de la muestra se corrigió: guarda lo que decía antes y
    // cuándo se cambió, que es el historial que enseña la ficha.
    const corregidas = incidents
      .flatMap((incident) => incident.lifecycleNotes ?? [])
      .filter((nota) => (nota.versions ?? []).length > 0);
    expect(corregidas.length).toBeGreaterThan(0);
    for (const nota of corregidas) {
      const anterior = nota.versions?.at(-1);
      expect(nota.editedAt).toBeTypeOf("number");
      expect(anterior?.at).toBe(nota.editedAt);
      expect(anterior?.note).not.toBe(nota.note);
      expect(anterior?.at).toBeGreaterThan(nota.at);
    }

    // Referencias únicas en las dos colas
    expect(new Set(incidents.map((item) => item.reference)).size).toBe(
      incidents.length,
    );
    expect(new Set(requests.map((item) => item.reference)).size).toBe(
      requests.length,
    );
    expect(new Set(parts.map((item) => item.code)).size).toBe(parts.length);
    expect(new Set(equipment.map((item) => item.code)).size).toBe(
      equipment.length,
    );

    // La muestra recorre todos los estados de las dos colas
    const incidentStatuses = new Set(incidents.map((item) => item.status));
    expect([...incidentStatuses].sort()).toEqual([
      "assigned",
      "repairing",
      "reported",
      "resolved",
      "unresolved",
      "waitingParts",
      "workshop",
    ]);
    const requestStatuses = new Set(requests.map((item) => item.status));
    expect([...requestStatuses].sort()).toEqual([
      "approved",
      "issued",
      "pending",
      "rejected",
    ]);

    // Categorías del catálogo dentro de las admitidas por la app
    for (const part of parts) {
      expect(PART_CATEGORIES).toContain(part.category);
      expect(part.stock).toBeGreaterThanOrEqual(0);
      expect(part.minStock).toBeGreaterThanOrEqual(0);
    }

    // La compatibilidad apunta siempre a equipos existentes
    const equipmentIds = new Set(equipment.map((item) => item._id));
    for (const part of parts) {
      for (const id of part.compatibleWith ?? []) {
        expect(equipmentIds.has(id)).toBe(true);
      }
    }

    // Cada petición se enlaza con un equipo existente o lleva texto libre, y
    // sus líneas apuntan a repuestos del catálogo
    const partIds = new Set(parts.map((item) => item._id));
    for (const request of requests) {
      if (request.equipmentId) {
        expect(equipmentIds.has(request.equipmentId)).toBe(true);
      } else {
        expect(request.equipment ?? "").not.toBe("");
      }
      for (const requestLine of request.lines) {
        expect(partIds.has(requestLine.sparePartId)).toBe(true);
      }
      if (request.status === "pending") {
        expect(request.decidedAt).toBeUndefined();
      } else {
        expect(request.decidedAt).toBeTypeOf("number");
        expect(request.decisionNote).toBeTruthy();
      }
      if (request.status === "issued") {
        expect(request.issuedAt).toBeTypeOf("number");
      }
    }

    // Cada equipo lleva su ficha de compra (serie, proveedor y alta)
    for (const item of equipment) {
      expect(item.serialNumber).toBeTruthy();
      expect(item.supplier).toBeTruthy();
      expect(item.purchaseDate).toBeTypeOf("number");
      expect(item.warrantyEndDate).toBeTypeOf("number");
      expect(item.maintenanceIntervalDays).toBeGreaterThan(0);
    }
    // Algún equipo de baja y varias revisiones vencidas para la demo
    expect(
      equipment.filter((item) => item.decommissionDate !== undefined).length,
    ).toBeGreaterThanOrEqual(1);
    expect(
      equipment.filter(
        (item) =>
          item.decommissionDate === undefined &&
          item.warrantyEndDate !== undefined &&
          item.warrantyEndDate < Date.now(),
      ).length,
    ).toBeGreaterThanOrEqual(3);

    // El historial apunta a equipos y peticiones existentes
    const requestIds = new Set(requests.map((request) => request._id));
    const maintenanceById = new Map(
      maintenance.map((record) => [record._id, record]),
    );
    for (const record of maintenance) {
      expect(equipmentIds.has(record.equipmentId)).toBe(true);
      expect(["repair", "preventive"]).toContain(record.kind);
      expect(record.title).toBeTruthy();
      expect(record.performedAt).toBeTypeOf("number");
      expect(record.performedAt).toBeLessThanOrEqual(Date.now());
      if (record.requestId) expect(requestIds.has(record.requestId)).toBe(true);
    }
    // Plan preventivo: casi todos los equipos en servicio tienen revisiones
    const withPreventive = new Set(
      maintenance
        .filter((record) => record.kind === "preventive")
        .map((record) => record.equipmentId),
    );
    expect(withPreventive.size).toBeGreaterThanOrEqual(15);

    // Lo cerrado sale del día a día: cierre, ficha de taller y archivo
    for (const incident of incidents) {
      if (incident.status !== "resolved" && incident.status !== "unresolved") {
        expect(incident.closedAt).toBeUndefined();
        expect(incident.archivedAt).toBeUndefined();
        continue;
      }
      expect(incident.closedAt).toBeTypeOf("number");
      expect(incident.notes).toBeTruthy();
      if (incident.equipmentId) {
        const sheet = incident.maintenanceId
          ? maintenanceById.get(incident.maintenanceId)
          : undefined;
        expect(sheet).toBeDefined();
        expect(sheet!.equipmentId).toBe(incident.equipmentId);
        expect(sheet!.kind).toBe("repair");
      }
      if (incident.archivedAt !== undefined) {
        expect(incident.archivedBy).toBe("Archivado automático");
        expect(incident.closedAt).toBeLessThan(incident.archivedAt);
      }
    }

    // Los documentos adjuntos nacen firmados por quien coordina el taller: se
    // reparten entre los coordinadores —quien carga la muestra y el responsable
    // que la muestra trae—, nunca un técnico.
    const team = await authed.run((ctx) => ctx.db.query("users").collect());
    const coordinatorNames = new Set(
      team
        .filter((user) => user.role === "admin" || user.role === "manager")
        .map((user) => user.name?.trim() ?? ""),
    );
    const attached = incidents.flatMap((item) => item.documents ?? []);
    expect(attached.length).toBeGreaterThan(0);
    for (const document of attached) {
      expect(coordinatorNames.has(document.author)).toBe(true);
      expect(document.name).toBeTruthy();
    }

    // Peticiones archivadas: solo las ya decididas
    const archivedRequests = requests.filter(
      (request) => request.archivedAt !== undefined,
    );
    expect(archivedRequests.length).toBeGreaterThanOrEqual(10);
    for (const request of archivedRequests) {
      expect(request.status).not.toBe("pending");
      expect(request.archivedBy).toBe("Archivado automático");
    }
    // …y queda trabajo a mano para probar el archivado masivo
    expect(
      incidents.filter(
        (item) =>
          item.archivedAt === undefined &&
          (item.status === "resolved" || item.status === "unresolved"),
      ).length,
    ).toBeGreaterThanOrEqual(5);

    // Avisos de ejemplo en la campana de quien carga los datos
    const notifications = await authed.query(api.notifications.list, {});
    expect(notifications.length).toBeGreaterThanOrEqual(5);
    expect(notifications.some((item) => !item.read)).toBe(true);

    // La charla de taller se abre con el equipo que trae la muestra: en cuanto
    // hay alguien más con quien hablar, queda la conversación.
    const messages = await authed.run((ctx) =>
      ctx.db.query("messages").collect(),
    );
    expect(messages.length).toBeGreaterThanOrEqual(5);
    for (const message of messages) {
      expect(message.senderName).not.toBe(message.recipientName);
      expect(message.text).not.toBe("");
    }

    // Idempotente: la segunda carga no vuelve a insertar nada
    expect(await authed.mutation(api.seed.seedDemoData, {})).toBe(false);
    expect(
      (await authed.query(api.incidents.list, { includeArchived: true }))
        .length,
    ).toBe(incidents.length);
    expect(
      (await authed.query(api.partRequests.list, { includeArchived: true }))
        .length,
    ).toBe(requests.length);
  });

  test("la muestra trae una entrega por tandas, con su constancia", async () => {
    // La muestra se lee con las pantallas reales: tiene que traer una petición
    // con parte del material ya entregado y su rastro de quién lo entregó, no
    // solo peticiones intactas o entregadas enteras.
    const authed = await authedTest("manager");
    await authed.mutation(api.seed.seedDemoData, {});
    const requests = await authed.query(api.partRequests.list, {
      includeArchived: true,
    });

    const aMedias = requests.filter(
      (request) =>
        request.status === "approved" &&
        request.lines.some((line) => (line.deliveredQuantity ?? 0) > 0),
    );
    expect(aMedias.length).toBeGreaterThan(0);
    const muestra = aMedias[0];
    // A medias de verdad: queda material por entregar.
    expect(
      muestra.lines.some(
        (line) => (line.deliveredQuantity ?? 0) < line.quantity,
      ),
    ).toBe(true);

    const trail = await authed.query(api.partRequests.decisions, {
      requestId: muestra._id,
    });
    const entrega = trail.find(
      (row) => row.decision?.reason === "materialPartiallyDelivered",
    );
    expect(entrega).toBeDefined();
    // Con quién la entregó, cuándo y qué salió en esa tanda.
    expect(entrega!.by).not.toBe("");
    expect(entrega!.at).toBeTypeOf("number");
    for (const line of muestra.lines) {
      if ((line.deliveredQuantity ?? 0) === 0) continue;
      expect(entrega!.decision?.note).toContain(`${line.code} ${line.name}`);
    }
    // La fecha de la constancia es la de la salida que la línea apunta.
    const salida = Math.max(
      ...muestra.lines.map((line) => line.deliveredAt ?? 0),
    );
    expect(entrega!.at).toBe(salida);

    // Y una petición que salió en dos tandas, una por semana: el rastro las
    // enseña por separado, con lo que salió en cada una.
    const enDosTandas = requests.find(
      (request) => request.reference === PET_EN_DOS_TANDAS,
    );
    expect(enDosTandas).toBeDefined();
    const tandas = await authed.query(api.partRequests.decisions, {
      requestId: enDosTandas!._id,
    });
    expect(tandas).toHaveLength(2);
    // Lo más reciente primero: la segunda tanda es la que cierra el material, y
    // la primera salió una semana antes.
    expect(tandas[0].decision?.reason).toBe("materialDelivered");
    expect(tandas[1].decision?.reason).toBe("materialPartiallyDelivered");
    expect(tandas[0].at - tandas[1].at).toBe(7 * DAY);
    // Cada tanda con lo suyo: la primera llevó también el adaptador.
    expect(tandas[1].decision?.note).toContain("VEN-08012");
    expect(tandas[0].decision?.note).not.toContain("VEN-08012");
    // Y la suma de las tandas es lo que las líneas dan por entregado: el rastro y
    // el estado de la petición no pueden contar cosas distintas.
    for (const line of enDosTandas!.lines) {
      const enTandas = tandas.reduce((sum, row) => {
        const match = new RegExp(`(\\d+) × ${line.code}\\b`).exec(
          row.decision?.note ?? "",
        );
        return sum + Number(match?.[1] ?? 0);
      }, 0);
      expect(enTandas, line.code).toBe(line.deliveredQuantity);
    }

    // Y lo entregado entero deja la suya, como «material entregado».
    const entregadas = requests.filter(
      (request) => request.status === "issued" && request.lines.length > 0,
    );
    expect(entregadas.length).toBeGreaterThan(0);
    for (const request of entregadas.slice(0, 5)) {
      const filas = await authed.query(api.partRequests.decisions, {
        requestId: request._id,
      });
      expect(
        filas.map((row) => row.decision?.reason),
        request.reference,
      ).toContain("materialDelivered");
    }
  });

  test("un técnico no puede cargar los datos de ejemplo", async () => {
    const authed = await authedTest("technician");
    const error = await authed.mutation(api.seed.seedDemoData, {}).then(
      () => null,
      (err: unknown) => err,
    );
    expect(error).toBeInstanceOf(ConvexError);
    const message =
      error instanceof ConvexError ? String(error.data) : String(error);
    expect(message).toContain(
      "No tienes permisos para cargar los datos de ejemplo.",
    );
  });
});

describe("ampliar la muestra", () => {
  test("la muestra llena los catálogos maestros y los modelos de equipo", async () => {
    const authed = await authedTest("manager");
    await authed.mutation(api.seed.seedDemoData, {});

    const equipment = await authed.query(api.equipment.list, {});
    const parts = await authed.query(api.spareParts.list, {});

    // Los seis catálogos con los que autocompletan los formularios: sin ellos,
    // la app arranca con las listas vacías y hay que teclearlo todo.
    const catalogs = await authed.query(api.catalogs.listAll, {});
    const kinds = new Set(catalogs.map((item) => item.kind));
    for (const kind of [
      "brand",
      "equipmentLocation",
      "partLocation",
      "supplier",
      "position",
      "partCategory",
    ]) {
      expect(kinds.has(kind)).toBe(true);
    }
    // Un valor una sola vez por catálogo, y normalizado como lo compara la app.
    expect(
      new Set(catalogs.map((item) => `${item.kind}|${item.normalized}`)).size,
    ).toBe(catalogs.length);
    for (const item of catalogs) {
      expect(item.normalized).toBe(normalizeCatalogString(item.name));
    }

    // Un modelo por marca y nombre comercial, y ninguna fila repetida.
    const models = await authed.query(api.equipmentModels.list, {});
    expect(models.length).toBeGreaterThanOrEqual(15);
    expect(new Set(models.map((item) => item.model.toLowerCase())).size).toBe(
      models.length,
    );
    for (const model of models) {
      expect(model.name).not.toBe("");
      expect(model.brand).toBeTruthy();
      expect(model.defaultMaintenanceIntervalDays).toBeGreaterThan(0);
    }

    // Cada unidad del inventario cuelga de su modelo, y ese modelo dice lo mismo.
    const modelById = new Map(models.map((item) => [item._id, item]));
    for (const item of equipment) {
      expect(item.modelId).toBeDefined();
      const model = modelById.get(item.modelId!);
      expect(model).toBeDefined();
      expect(model!.model).toBe(item.model);
      if (item.brand) expect(model!.brand).toBe(item.brand);
    }

    // Las palabras que usan los datos están en los catálogos: la marca del
    // equipo, su ubicación y el proveedor del repuesto.
    const names = (kind: string) =>
      new Set(
        catalogs
          .filter((item) => item.kind === kind)
          .map((item) => item.normalized),
      );
    const brands = names("brand");
    const equipmentLocations = names("equipmentLocation");
    const partLocations = names("partLocation");
    const suppliers = names("supplier");
    for (const item of equipment) {
      if (item.brand) expect(brands.has(normalizeCatalogString(item.brand))).toBe(true);
      if (item.location) {
        expect(equipmentLocations.has(normalizeCatalogString(item.location))).toBe(
          true,
        );
      }
      if (item.supplier) {
        expect(suppliers.has(normalizeCatalogString(item.supplier))).toBe(true);
      }
    }
    for (const part of parts) {
      if (part.location) {
        expect(partLocations.has(normalizeCatalogString(part.location))).toBe(
          true,
        );
      }
      if (part.supplier) {
        expect(suppliers.has(normalizeCatalogString(part.supplier))).toBe(true);
      }
      if (part.category) {
        expect(names("partCategory").has(normalizeCatalogString(part.category))).toBe(
          true,
        );
      }
    }

    // Lo compatible se dice por modelo (que es lo que compara el almacén) y ese
    // modelo existe; lo que ya decía equipos concretos sigue diciéndolo.
    expect(parts.some((part) => (part.compatibleModels ?? []).length > 0)).toBe(
      true,
    );
    for (const part of parts) {
      for (const id of part.compatibleModels ?? []) {
        expect(modelById.has(id)).toBe(true);
      }
      if ((part.compatibleWith ?? []).length > 0) {
        expect((part.compatibleModels ?? []).length).toBeGreaterThan(0);
      }
    }
  });

  test("seedMoreDemoData añade tandas nuevas sin repetir referencias", async () => {
    const authed = await authedTest("manager");
    await authed.mutation(api.seed.seedDemoData, {});

    const before = await authed.query(api.incidents.list, {
      includeArchived: true,
    });
    const beforeRequests = await authed.query(api.partRequests.list, {
      includeArchived: true,
    });

    const first = await authed.mutation(api.seed.seedMoreDemoData, {});
    expect(first.incidents).toBeGreaterThanOrEqual(20);
    expect(first.requests).toBeGreaterThanOrEqual(20);
    // La primera carga ya traía el catálogo completo, con sus catálogos
    // maestros y sus modelos: la segunda tanda no duplica nada de eso.
    expect(first.equipment).toBe(0);
    expect(first.parts).toBe(0);
    expect(first.models).toBe(0);
    expect(first.catalogs).toBe(0);

    const second = await authed.mutation(api.seed.seedMoreDemoData, {
      incidents: 5,
      requests: 5,
    });
    expect(second.incidents).toBe(5);
    expect(second.requests).toBe(5);

    const after = await authed.query(api.incidents.list, {
      includeArchived: true,
    });
    const afterRequests = await authed.query(api.partRequests.list, {
      includeArchived: true,
    });
    expect(after.length).toBe(
      before.length + first.incidents + second.incidents,
    );
    expect(afterRequests.length).toBe(
      beforeRequests.length + first.requests + second.requests,
    );

    // Referencias únicas y sin huecos repetidos tras varias tandas
    expect(new Set(after.map((item) => item.reference)).size).toBe(
      after.length,
    );
    expect(new Set(afterRequests.map((item) => item.reference)).size).toBe(
      afterRequests.length,
    );

    // Las tandas nuevas también traen estados y archivo
    const fresh = after.filter(
      (item) => !before.some((old) => old._id === item._id),
    );
    expect(
      new Set(fresh.map((item) => item.status)).size,
    ).toBeGreaterThanOrEqual(2);

    // Los equipos nuevos también reciben su plan de mantenimiento
    const maintenance = await authed.query(api.maintenance.list, {});
    expect(maintenance.length).toBeGreaterThanOrEqual(40);
  });

  test("un técnico no puede ampliar la muestra", async () => {
    const authed = await authedTest("technician");
    const error = await authed.mutation(api.seed.seedMoreDemoData, {}).then(
      () => null,
      (err: unknown) => err,
    );
    expect(error).toBeInstanceOf(ConvexError);
    const message =
      error instanceof ConvexError ? String(error.data) : String(error);
    expect(message).toContain(
      "No tienes permisos para cargar los datos de ejemplo.",
    );
  });

  test("la muestra deja el rastro de auditoría de sus documentos", async () => {
    const authed = await authedTest("manager");
    expect(await authed.mutation(api.seed.seedDemoData, {})).toBe(true);

    const incidents = await authed.query(api.incidents.list, {
      includeArchived: true,
    });

    let attached = 0;
    let edited = 0;
    let removed = 0;
    let withDocuments = 0;
    /** Quiénes firman el rastro: el nombre visible y el usuario. */
    const firmas = new Set<string>();
    const firmantes = new Set<string>();
    for (const incident of incidents) {
      const trail = await authed.query(api.incidents.documentTrail, {
        incidentId: incident._id,
      });
      const altas = trail.filter((entry) => entry.action === "attached");
      const retirados = trail.filter((entry) => entry.action === "removed");
      // Cada documento del expediente tiene su alta anotada, y lo retirado
      // cuenta una sola vez: la traza, porque en la ficha ya no está.
      expect(altas).toHaveLength(
        (incident.documents?.length ?? 0) + retirados.length,
      );
      if ((incident.documents?.length ?? 0) > 0) withDocuments += 1;

      for (const entry of trail) {
        // Ningún cambio es anterior al alta del documento del que habla.
        const alta = altas.find(
          (other) => other.documentId === entry.documentId,
        );
        expect(alta).toBeDefined();
        expect(entry.at).toBeGreaterThanOrEqual(alta!.at);
        firmas.add(entry.by);
        firmantes.add(entry.byId);
      }

      attached += altas.length;
      edited += trail.filter((entry) => entry.action === "edited").length;
      removed += retirados.length;
    }

    expect(withDocuments).toBeGreaterThan(0);
    // El rastro lo firma quien coordina el taller —la muestra trae su
    // responsable, así que hay más de uno—, nunca un técnico: ni el nombre
    // visible ni el usuario. Se comprueba contra los roles de la base y no
    // contra una pareja de nombres escrita a mano.
    const users = await authed.run((ctx) => ctx.db.query("users").collect());
    const coordinators = users.filter(
      (user) => user.role === "admin" || user.role === "manager",
    );
    const coordinatorIds = new Set<string>(
      coordinators.map((user) => user._id),
    );
    const coordinatorNames = new Set(
      coordinators.map((user) => user.name?.trim() ?? ""),
    );
    expect(firmas.size).toBeGreaterThan(0);
    expect(firmantes.size).toBeGreaterThan(0);
    for (const id of firmantes) expect(coordinatorIds.has(id)).toBe(true);
    for (const firma of firmas) expect(coordinatorNames.has(firma)).toBe(true);
    // Y firma también quien carga la muestra, que es el administrador.
    expect(firmas.has("Usuario de prueba")).toBe(true);
    // El expediente de la muestra no es solo altas: también hay correcciones y
    // algún adjunto retirado que únicamente vive en su traza.
    expect(attached).toBeGreaterThan(0);
    expect(edited).toBeGreaterThan(0);
    expect(removed).toBeGreaterThan(0);
  });

  test("la muestra da de alta al equipo del taller y lo deja en Usuarios", async () => {
    const t = backend();
    const adminId = await t.run((ctx) =>
      ctx.db.insert("users", {
        name: "Ada Admin",
        email: "admin@taller.es",
        role: "admin",
        active: true,
      }),
    );
    const admin = t.withIdentity({ subject: `${adminId}|session1` });
    expect(await admin.mutation(api.seed.seedDemoData, {})).toBe(true);

    // La vista de Usuarios se llena con el equipo: personas con su rol, su
    // puesto y su ubicación, no una lista vacía.
    const members = await admin.query(api.members.list, {});
    const team = members.filter((member) => member._id !== adminId);
    expect(team.length).toBeGreaterThanOrEqual(8);
    for (const member of team) {
      expect(member.active).toBe(true);
      expect(member.role).toBeTruthy();
      // Nadie entra como administrador por un dato de ejemplo.
      expect(member.role).not.toBe("admin");
      expect(member.position).toBeTruthy();
      expect(member.location).toBeTruthy();
      // Dominio de ejemplo: no puede ser la dirección real de nadie, así que no
      // bloquea que esa persona se dé de alta más adelante.
      expect(member.email).toMatch(/@ejemplo\.es$/);
    }
    // Uno coordina y el resto está en el día a día.
    expect(team.filter((member) => member.role === "manager")).toHaveLength(1);
    expect(
      team.filter((member) => member.role === "technician").length,
    ).toBeGreaterThanOrEqual(5);

    // Sus puestos y ubicaciones están en los catálogos: al editar su ficha, el
    // autocompletado los reconoce en vez de tratarlos como nuevos.
    const catalogs = await admin.query(api.catalogs.listAll, {});
    const positions = new Set(
      catalogs
        .filter((item) => item.kind === "position")
        .map((item) => item.normalized),
    );
    const locations = new Set(
      catalogs
        .filter((item) => item.kind === "equipmentLocation")
        .map((item) => item.normalized),
    );
    for (const member of team) {
      expect(positions.has(normalizeCatalogString(member.position!))).toBe(true);
      expect(locations.has(normalizeCatalogString(member.location!))).toBe(true);
    }

    // Otra tanda no vuelve a darlos de alta ni pisa lo que haya escrito el
    // taller sobre ellos.
    const more = await admin.mutation(api.seed.seedMoreDemoData, {
      incidents: 1,
      requests: 1,
    });
    expect(more.team).toBe(0);
    expect(await admin.query(api.members.list, {})).toHaveLength(members.length);
  });
});

/** Taller con administrador, responsable y técnico para repartir los roles. */
async function taller() {
  const t = backend();
  const adminId = await t.run((ctx) =>
    ctx.db.insert("users", {
      name: "Ada Admin",
      email: "admin@taller.es",
      role: "admin",
      active: true,
    }),
  );
  const managerId = await t.run((ctx) =>
    ctx.db.insert("users", {
      name: "Elena Vidal",
      email: "coord@taller.es",
      role: "manager",
      active: true,
    }),
  );
  const techId = await t.run((ctx) =>
    ctx.db.insert("users", {
      name: "Iván Torres",
      email: "tecnico@taller.es",
      role: "technician",
      active: true,
    }),
  );
  return {
    t,
    admin: t.withIdentity({ subject: `${adminId}|session1` }),
    manager: t.withIdentity({ subject: `${managerId}|session1` }),
    tech: t.withIdentity({ subject: `${techId}|session1` }),
    adminId,
    managerId,
    techId,
  };
}

/** Lanza la promesa y comprueba que el ConvexError contiene el texto. */
async function expectConvexError(promise: Promise<unknown>, fragment: string) {
  const error = await promise.then(
    () => null,
    (err: unknown) => err,
  );
  expect(error).not.toBeNull();
  const message =
    error instanceof ConvexError ? String(error.data) : String(error);
  expect(message).toContain(fragment);
}

describe("datos de ejemplo — manda la capacidad, no el rol", () => {
  test("un rol personalizado con «modificar repuestos» puede cargarlos", async () => {
    const { admin, tech, techId } = await taller();
    const key = await admin.mutation(api.permissions.createRole, {
      label: "Auxiliar de almacén",
      templateKey: "technician",
    });
    await admin.mutation(api.permissions.setRolePermissions, {
      role: key,
      grants: { ...DEFAULT_GRANTS.technician, manageInventory: true },
    });
    await admin.mutation(api.members.setRole, { userId: techId, role: key });

    expect(await tech.mutation(api.seed.seedDemoData, {})).toBe(true);
    const parts = await tech.query(api.spareParts.list, {});
    expect(parts.length).toBeGreaterThanOrEqual(30);
  });

  test("retirada la capacidad, el responsable ya no puede cargarlos", async () => {
    const { admin, manager } = await taller();
    await admin.mutation(api.permissions.setRolePermissions, {
      role: "manager",
      grants: { ...DEFAULT_GRANTS.manager, manageInventory: false },
    });

    await expectConvexError(
      manager.mutation(api.seed.seedDemoData, {}),
      "No tienes permisos para cargar los datos de ejemplo",
    );
    // El administrador siempre conserva la capacidad
    expect(await admin.mutation(api.seed.seedDemoData, {})).toBe(true);
  });
});

describe("datos de ejemplo con miembros reales", () => {
  test("asigna incidencias a los miembros y abre una conversación de taller", async () => {
    const { admin, t } = await taller();
    expect(await admin.mutation(api.seed.seedDemoData, {})).toBe(true);

    const incidents = await admin.query(api.incidents.list, {
      includeArchived: true,
    });
    // El reparto es entre las personas que tiene el taller: las de la prueba y
    // las que trae la propia muestra, que también son miembros de verdad.
    const users = await t.run((ctx) => ctx.db.query("users").collect());
    const members = new Set(
      users.map((user) => user.name?.trim() ?? ""),
    );
    // La muestra curada (INC-0001 a INC-0003) firma con sus propios nombres;
    // lo generado se reparte entre los miembros que ya tiene el taller.
    const assigned = incidents.filter(
      (item) => item.assigneeName !== undefined && item.reference > "INC-0003",
    );
    expect(assigned.length).toBeGreaterThan(10);
    for (const incident of assigned) {
      expect(members.has(incident.assigneeName!)).toBe(true);
    }

    const messages = await t.run((ctx) => ctx.db.query("messages").collect());
    expect(messages.length).toBeGreaterThanOrEqual(5);
    for (const message of messages) {
      expect(message.text).not.toBe("");
      expect(message.senderName).not.toBe("");
      expect(message.recipientName).not.toBe("");
      expect(message.read).toBe(true);
    }
  });

  test("el rastro de los documentos lo firma quien coordina el taller", async () => {
    const { admin, t, adminId, managerId } = await taller();
    expect(await admin.mutation(api.seed.seedDemoData, {})).toBe(true);

    const incidents = await admin.query(api.incidents.list, {
      includeArchived: true,
    });
    const firmas = new Map<string, number>();
    for (const incident of incidents) {
      const trail = await admin.query(api.incidents.documentTrail, {
        incidentId: incident._id,
      });
      for (const entry of trail) {
        firmas.set(entry.by, (firmas.get(entry.by) ?? 0) + 1);
      }
    }

    // El expediente lo mueven solo los coordinadores: quien carga la muestra
    // (administrador) y la responsable, nunca un técnico.
    expect(firmas.get("Ada Admin") ?? 0).toBeGreaterThan(0);
    expect(firmas.get("Elena Vidal") ?? 0).toBeGreaterThan(0);
    expect(firmas.has("Iván Torres")).toBe(false);

    // La auditoría enseña ese mismo reparto, que es entre quién se elige al
    // filtrar por persona.
    const audit = await admin.query(api.incidents.documentAudit, {});
    // Solo firma quien coordina —administrador o responsable—, contando a los
    // coordinadores que trae la muestra además de los del taller de la prueba.
    const users = await t.run((ctx) => ctx.db.query("users").collect());
    const coordinatorIds = new Set<string>(
      users
        .filter((user) => user.role === "admin" || user.role === "manager")
        .map((user) => user._id),
    );
    expect(audit.authors.length).toBeGreaterThan(0);
    for (const author of audit.authors) {
      expect(coordinatorIds.has(author.id)).toBe(true);
    }
    expect(audit.authors.map((item) => item.id)).toEqual(
      expect.arrayContaining([adminId, managerId]),
    );
    expect(audit.summary.total).toBe(audit.unfilteredTotal);
    expect(audit.summary.people).toBe(audit.authors.length);
    expect(audit.summary.incidents).toBeGreaterThan(10);
  });
});

describe("las fotos abandonadas del formulario en la muestra", () => {
  test("la acción guarda las fotos en el almacén y las apunta con su vale", async () => {
    const { t, manager } = await taller();

    // La mutación no puede escribir en el almacén, así que la muestra se guarda
    // en dos pasos: la acción guarda los archivos y apunta las filas.
    expect(await manager.action(api.seed.seedDemoUploads, {})).toEqual({
      uploaded: SAMPLE_PHOTOS.length,
      total: SAMPLE_PHOTOS.length,
    });

    const rows = await t.run((ctx) => ctx.db.query("reportUploads").collect());
    expect(rows).toHaveLength(SAMPLE_PHOTOS.length);
    for (const row of rows) {
      const photo = SAMPLE_PHOTOS.find((item) => item.ticket === row.ticket);
      expect(photo).toBeDefined();
      expect(row.storageId).toBeDefined();
      // Acreditada, y aun así sin citar en ninguna incidencia: es justo el
      // abandono que la limpieza del formulario viene a barrer.
      expect(row.claimedAt).toBeTypeOf("number");
      expect(row.claimedAt).toBeGreaterThan(row.createdAt);
      // Ya pasó su ventana de cortesía de un día.
      expect(row.createdAt).toBeLessThan(Date.now() - DAY);
    }

    // Y detrás de cada fila está la foto entera, byte a byte: lo que se guardó
    // es el PNG de la muestra, no una fila apuntando a la nada.
    for (const row of rows) {
      const storageId = row.storageId;
      if (!storageId) throw new Error("La fila apunta a la nada.");
      const photo = SAMPLE_PHOTOS.find((item) => item.ticket === row.ticket)!;
      const expected = samplePhotoBytes(photo);
      // El archivo guardado es la foto entera: mismo tamaño y misma firma. Del
      // tipo y del resumen no se dice nada porque el almacén de mentira de las
      // pruebas no los calcula; el de verdad sí, y el tipo es lo que hace que la
      // papelera lo llame imagen.
      const stored = await t.run(async (ctx) => {
        const file = await ctx.storage.get(storageId);
        if (!file) return null;
        const bytes = new Uint8Array(await file.arrayBuffer());
        return { size: bytes.length, head: [...bytes.slice(0, 8)] };
      });
      expect(stored).toEqual({ size: expected.length, head: PNG_SIGNATURE });
    }
  });

  test("pulsarla de nuevo no multiplica ni fotos ni filas", async () => {
    const { t, manager } = await taller();

    await manager.action(api.seed.seedDemoUploads, {});
    expect(await manager.action(api.seed.seedDemoUploads, {})).toEqual({
      uploaded: 0,
      total: SAMPLE_PHOTOS.length,
    });

    expect(
      await t.run((ctx) => ctx.db.query("reportUploads").collect()),
    ).toHaveLength(SAMPLE_PHOTOS.length);
    // Tampoco quedan copias sueltas en el almacén: lo que no se apunta no se
    // guarda, así que la limpieza no tiene aquí nada que barrer por duplicado.
    const files = await t.run((ctx) =>
      ctx.db.system.query("_storage").collect(),
    );
    expect(files).toHaveLength(SAMPLE_PHOTOS.length);
  });

  test("quedan como lo que la limpieza de la noche se lleva", async () => {
    const { t, manager } = await taller();
    await manager.action(api.seed.seedDemoUploads, {});

    // La tarjeta de Ajustes del taller las enseña con su miniatura y su tamaño.
    const panel = await manager.query(api.reportUploads.unusedImages, {});
    expect(panel.images).toHaveLength(SAMPLE_PHOTOS.length);
    expect(panel.tickets).toBe(0);
    expect(panel.totalBytes).toBeGreaterThan(0);
    for (const image of panel.images) {
      expect(image.url).toContain("/api/storage/");
      expect(image.size).toBeGreaterThan(0);
    }

    // Y el aviso que antecede a la pasada las cuenta para quien coordina el
    // taller: el administrador y el responsable de repuestos.
    expect(await t.mutation(internal.reportUploads.warnUnused, {})).toBe(2);
    const avisos = await t.run((ctx) =>
      ctx.db.query("notifications").collect(),
    );
    expect(avisos).toHaveLength(2);
    for (const aviso of avisos) {
      expect(aviso.text).toContain(`${SAMPLE_PHOTOS.length} imágenes sin usar`);
    }

    // Y cuando la pasada pasa de verdad, lo retirado queda en la papelera con su
    // vale: es lo que permite devolverlo a su sitio, y lo que hace que la muestra
    // sirva para recorrer el ciclo entero, no solo para ver la tarjeta.
    expect(await t.mutation(internal.reportUploads.sweepUnused, {})).toBe(
      SAMPLE_PHOTOS.length,
    );
    const trashed = await t.run((ctx) => ctx.db.query("trashFiles").collect());
    expect(trashed).toHaveLength(SAMPLE_PHOTOS.length);
    for (const item of trashed) {
      expect(item.ticket).toMatch(/^[0-9a-f]{32}$/);
      expect(item.pass).toBe("reportUploads");
    }
    // La tarjeta se queda sin nada que enseñar: ya no hay fotos sin usar.
    const after = await manager.query(api.reportUploads.unusedImages, {});
    expect(after.images).toHaveLength(0);
    expect(after.tickets).toBe(0);
  });

  test("sin la capacidad no se guarda nada, y sin sesión tampoco", async () => {
    const { t, tech } = await taller();

    await expectConvexError(
      tech.action(api.seed.seedDemoUploads, {}),
      "No tienes permisos para cargar los datos de ejemplo",
    );
    await expectConvexError(
      t.action(api.seed.seedDemoUploads, {}),
      "Debes iniciar sesión para cargar los datos de ejemplo",
    );

    // La comprobación va antes de guardar: no queda nada a medias en el almacén.
    expect(
      await t.run((ctx) => ctx.db.query("reportUploads").collect()),
    ).toHaveLength(0);
    expect(
      await t.run((ctx) => ctx.db.system.query("_storage").collect()),
    ).toHaveLength(0);
  });
});

describe("los manuales de la muestra", () => {
  /** Cualquier PDF empieza igual: con su firma. */
  const PDF_SIGNATURE = [0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34];

  /** Cuántos archivos deja la muestra en el almacén: un PDF por manual de
   * archivo, más la versión anterior del que llegó sustituido. */
  const SAMPLE_FILES =
    SAMPLE_MANUALS.filter((manual) => manual.file).length +
    SAMPLE_MANUALS.filter((manual) => manual.previousFileName).length;

  test("la acción carga los manuales y sus PDF en el almacén", async () => {
    const { t, manager, managerId } = await taller();
    // Como en el panel: primero la muestra —que es la que deja el inventario— y
    // después los manuales, que se asignan a esos equipos.
    await manager.mutation(api.seed.seedDemoData, {});
    expect(await manager.action(api.seed.seedDemoManuals, {})).toEqual({
      inserted: SAMPLE_MANUALS.length,
      total: SAMPLE_MANUALS.length,
    });

    const manuals = await manager.query(api.manuals.list, {});
    expect(manuals).toHaveLength(SAMPLE_MANUALS.length);

    for (const manual of manuals) {
      const sample = SAMPLE_MANUALS.find((item) => item.title === manual.title);
      expect(sample).toBeDefined();
      expect(manual.type).toBe(sample!.type);
      // La muestra se queda dentro del catálogo de tipos del módulo: si no,
      // los filtros del módulo no la encontrarían.
      expect(MANUAL_TYPES).toContain(manual.type);
      // La firma quien carga la muestra, con su usuario detrás: es lo que deja
      // corregir la propia nota sin ser responsable del módulo.
      expect(manual.author).toBe("Elena Vidal");
      expect(manual.authorId).toBe(managerId);
      expect(manual.history[0].action).toBe("created");

      if (sample!.file) {
        expect(manual.kind).toBe("file");
        expect(manual.fileName).toBe(sample!.file.fileName);
        expect(manual.url).toContain("/api/storage/");
        const storageId = manual.storageId;
        if (!storageId) throw new Error("El manual no apunta a su archivo.");
        expect(manual.size).toBeGreaterThan(0);
        // Y detrás de la ficha está el PDF entero, byte a byte: lo que se
        // guardó es un documento, no una fila apuntando a la nada.
        const stored = await t.run(async (ctx) => {
          const file = await ctx.storage.get(storageId);
          if (!file) return null;
          const bytes = new Uint8Array(await file.arrayBuffer());
          return { size: bytes.length, head: [...bytes.slice(0, 8)] };
        });
        expect(stored).toEqual({ size: manual.size, head: PDF_SIGNATURE });
      } else {
        expect(manual.kind).toBe("note");
        expect(manual.notes ?? "").not.toBe("");
        expect(manual.storageId).toBeUndefined();
      }
    }

    // Hay manuales de un equipo del inventario y manuales sueltos: los dos
    // casos que el módulo tiene que saber distinguir.
    expect(
      manuals.filter((manual) => manual.equipmentId).length,
    ).toBeGreaterThan(0);
    expect(manuals.some((manual) => !manual.equipmentId)).toBe(true);

    // Y el manual de la cámara aparece en la ficha de su equipo.
    const equipment = await manager.query(api.equipment.list, {});
    const camera = equipment.find((item) => item.code === "EQ-001");
    if (!camera) throw new Error("Falta la cámara de la muestra.");
    const { assigned } = manualsForEquipment(manuals, camera);
    expect(assigned.map((manual) => manual.title)).toContain(
      "Manual de servicio HDC-3500",
    );
  });

  test("todos los equipos de la muestra tienen su expediente", async () => {
    const { manager } = await taller();
    await manager.mutation(api.seed.seedDemoData, {});
    await manager.action(api.seed.seedDemoManuals, {});

    const manuals = await manager.query(api.manuals.list, {});
    const equipment = await manager.query(api.equipment.list, {});
    expect(equipment.length).toBeGreaterThan(0);

    // Ningún equipo del inventario se abre sin documentación: cada ficha tiene
    // al menos un manual asignado a él, que es lo que el expediente completo de
    // la demo tiene que enseñar.
    expect(
      equipment
        .filter(
          (item) => manualsForEquipment(manuals, item).assigned.length === 0,
        )
        .map((item) => item.code),
    ).toEqual([]);

    // Todos cuelgan de su modelo: es lo que los comparte entre las unidades de
    // ese mismo modelo, y lo que el filtro de la ficha usa.
    const models = await manager.query(api.equipmentModels.list, {});
    const modelIds = new Set(models.map((model) => model._id));
    for (const manual of manuals) {
      expect(manual.modelId).toBeDefined();
      expect(modelIds.has(manual.modelId!)).toBe(true);
    }

    // Y junto a los expedientes sigue el otro caso del módulo: el manual del
    // modelo, que cuelga de una ficha sin estar asignado a su equipo.
    expect(
      equipment.some(
        (item) => manualsForEquipment(manuals, item).byModel.length > 0,
      ),
    ).toBe(true);
    expect(manuals.some((manual) => !manual.equipmentId)).toBe(true);
  });

  test("ningún manual de la muestra se queda sin colgar de una ficha", async () => {
    const { manager } = await taller();
    await manager.mutation(api.seed.seedDemoData, {});
    await manager.action(api.seed.seedDemoManuals, {});

    const manuals = await manager.query(api.manuals.list, {});
    const equipment = await manager.query(api.equipment.list, {});
    expect(manuals).toHaveLength(SAMPLE_MANUALS.length);

    // La regla del módulo: un manual sin modelo no es «del modelo» de nada y un
    // modelo que el inventario no tenga no coincide con ningún equipo. La
    // muestra no puede traer ninguno así —sería un manual que no aparece al
    // abrir ninguna ficha del taller—, ni de un modelo que no esté en el
    // inventario ni suelto sin marca y sin modelo.
    expect(
      manuals
        .filter(
          (manual) =>
            !equipment.some(
              (item) =>
                item._id === manual.equipmentId ||
                manualsForEquipment([manual], item).byModel.length > 0,
            ),
        )
        .map((manual) => manual.title),
    ).toEqual([]);

    // Y los que están asignados llevan la clasificación de su equipo —la marca
    // y el modelo del equipo—, que es lo que el formulario guarda al elegir
    // equipo: con otra marca o modelo, los filtros del módulo no los
    // encontrarían por lo que la ficha dice que son.
    const desclasificados = manuals.filter((manual) => {
      if (!manual.equipmentId) return false;
      const unit = equipment.find((item) => item._id === manual.equipmentId);
      return (
        !unit ||
        (manual.brand ?? "") !== (unit.brand ?? "") ||
        (manual.model ?? "") !== (unit.model ?? "")
      );
    });
    expect(desclasificados.map((manual) => manual.title)).toEqual([]);
  });

  test("pulsarla de nuevo no multiplica ni manuales ni archivos", async () => {
    const { t, manager } = await taller();
    await manager.action(api.seed.seedDemoManuals, {});
    expect(await manager.action(api.seed.seedDemoManuals, {})).toEqual({
      inserted: 0,
      total: SAMPLE_MANUALS.length,
    });

    expect(await manager.query(api.manuals.list, {})).toHaveLength(
      SAMPLE_MANUALS.length,
    );
    // Tampoco quedan copias sueltas en el almacén: lo que no se apunta no se
    // guarda, así que la limpieza no tiene aquí nada que barrer por duplicado.
    expect(
      await t.run((ctx) => ctx.db.system.query("_storage").collect()),
    ).toHaveLength(SAMPLE_FILES);
  });

  test("el que llegó sustituido trae su versión anterior descargable", async () => {
    const { manager } = await taller();
    await manager.action(api.seed.seedDemoManuals, {});

    const manuals = await manager.query(api.manuals.list, {});
    const manual = manuals.find(
      (item) => item.title === "Manual de servicio HDC-3500",
    );
    if (!manual) throw new Error("Falta el manual de la cámara.");
    expect(manual.kind).toBe("file");

    // La ficha nace con el historial puesto: el alta y el reemplazo que dejó
    // fuera la primera versión, que se sigue pudiendo descargar.
    const versiones = manualFileVersions(manual);
    expect(versiones).toHaveLength(1);
    expect(versiones[0].action).toBe("fileReplaced");
    expect(versiones[0].file?.fileName).toBe(
      "Manual-de-servicio-HDC-3500-v1.pdf",
    );
    expect(versiones[0].url).toContain("/api/storage/");
    // Dos documentos distintos, no el mismo guardado dos veces.
    expect(versiones[0].file?.storageId).not.toBe(manual.storageId);
    expect(versiones[0].at).toBeGreaterThan(manual.createdAt);
  });

  test("un técnico no carga los manuales, y sin sesión tampoco", async () => {
    const { t, tech } = await taller();

    await expectConvexError(
      tech.action(api.seed.seedDemoManuals, {}),
      "No tienes permisos para cargar los datos de ejemplo",
    );
    await expectConvexError(
      t.action(api.seed.seedDemoManuals, {}),
      "Debes iniciar sesión para cargar los datos de ejemplo",
    );

    // La comprobación va antes de guardar: no queda nada a medias.
    expect(
      await t.run((ctx) => ctx.db.query("manuals").collect()),
    ).toHaveLength(0);
    expect(
      await t.run((ctx) => ctx.db.system.query("_storage").collect()),
    ).toHaveLength(0);
  });
});
