import { ConvexError } from "convex/values";
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { richDocBlocks, richDocToPlainText } from "../src/lib/richDoc";
import { api } from "../src/convex/_generated/api";
import type { Id } from "../src/convex/_generated/dataModel";
import schema from "../src/convex/schema";

/** Todos los módulos de funciones de la app (convex-test los levanta in-process). */
const modules = import.meta.glob("../src/convex/**/!(*.*.*)*.*s");

type Test = ReturnType<typeof convexTest>;
type Authed = ReturnType<Test["withIdentity"]>;

/** Instancia de test con un usuario autenticado (getAuthUserId lee el subject). */
async function authedTest() {
  const t = convexTest(schema, modules);
  const userId = await t.run((ctx) =>
    ctx.db.insert("users", {
      name: "Responsable de repuestos",
      email: "responsable@taller.es",
      role: "admin",
    }),
  );
  return { t, authed: t.withIdentity({ subject: `${userId}|session1` }) };
}

/** Lanza el error de Convex y comprueba que contiene el texto esperado. */
async function expectConvexError(promise: Promise<unknown>, fragment: string) {
  const error = await promise.then(
    () => null,
    (err: unknown) => err,
  );
  expect(
    error,
    `Se esperaba un error que contuviera: ${fragment}`,
  ).not.toBeNull();
  const message =
    error instanceof ConvexError ? String(error.data) : String(error);
  expect(message).toContain(fragment);
}

async function seedPart(
  t: Test,
  overrides: Partial<{
    code: string;
    name: string;
    category: string;
    unit: string;
    stock: number;
    minStock: number;
    supplier: string;
    partNumber: string;
    compatibleWith: Id<"equipment">[];
  }> = {},
) {
  return await t.run((ctx) =>
    ctx.db.insert("spareParts", {
      code: overrides.code ?? "TRI-60004",
      name: overrides.name ?? "Triac BTA16-600B",
      category: overrides.category ?? "Electrónica",
      unit: overrides.unit ?? "ud",
      stock: overrides.stock ?? 10,
      minStock: overrides.minStock ?? 2,
      ...(overrides.supplier ? { supplier: overrides.supplier } : {}),
      ...(overrides.partNumber ? { partNumber: overrides.partNumber } : {}),
      ...(overrides.compatibleWith
        ? { compatibleWith: overrides.compatibleWith }
        : {}),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }),
  );
}

async function seedEquipment(
  t: Test,
  overrides: { code?: string; name?: string; model?: string } = {},
) {
  return await t.run((ctx) =>
    ctx.db.insert("equipment", {
      code: overrides.code ?? "EQ-001",
      name: overrides.name ?? "Estación de soldadura",
      model: overrides.model ?? "FX-888D",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }),
  );
}

describe("partRequests.create — peticiones con referencia o descripción", () => {
  test("exige referencia, descripción o adjunto", async () => {
    const { authed } = await authedTest();
    await expectConvexError(
      authed.mutation(api.partRequests.create, {
        requesterName: "Sandra Ruiz",
        priority: "normal",
        lines: [],
      }),
      "Añade un repuesto del catálogo o describe lo que necesitas",
    );
  });

  test("acepta una petición libre con descripción y equipo escrito a mano", async () => {
    const { authed } = await authedTest();
    const reference = await authed.mutation(api.partRequests.create, {
      requesterName: "Jorge Luna",
      requesterTeam: "Mantenimiento de planta",
      priority: "urgent",
      description: "Necesito 2 ventiladores axiales de 120 mm a 24 V DC.",
      equipment: "Motor paso a paso NEMA-17",
    });

    expect(reference).toBe("PET-0001");
    const [request] = await authed.query(api.partRequests.list, {});
    expect(request.status).toBe("pending");
    expect(request.lines).toHaveLength(0);
    expect(request.description).toContain("ventiladores");
    expect(request.equipment).toBe("Motor paso a paso NEMA-17");
    expect(request.equipmentId).toBeUndefined();
  });

  test("guarda la descripción con formato como documento y no acepta solo etiquetas", async () => {
    const { authed } = await authedTest();
    const rich =
      "<p>Necesito <strong>2 ventiladores</strong> axiales de 120 mm.</p><ul><li>a 24 V DC</li></ul>";

    await authed.mutation(api.partRequests.create, {
      requesterName: "Jorge Luna",
      priority: "normal",
      description: rich,
    });

    const [request] = await authed.query(api.partRequests.list, {});
    // El formato se guarda como bloques con sus marcas, no como HTML.
    expect(richDocBlocks(request.description)).toEqual([
      {
        type: "paragraph",
        inline: [
          { text: "Necesito " },
          { text: "2 ventiladores", marks: ["bold"] },
          { text: " axiales de 120 mm." },
        ],
      },
      {
        type: "list",
        ordered: false,
        items: [[{ type: "paragraph", inline: [{ text: "a 24 V DC" }] }]],
      },
    ]);
    expect(richDocToPlainText(request.description)).toBe(
      "Necesito 2 ventiladores axiales de 120 mm.\na 24 V DC",
    );

    // El editor vacío deja un párrafo vacío: eso no es una petición.
    await expectConvexError(
      authed.mutation(api.partRequests.create, {
        requesterName: "Jorge Luna",
        priority: "normal",
        description: "<p></p>",
      }),
      "Añade un repuesto del catálogo",
    );
  });

  test("elige el equipo del inventario y deriva el texto del modelo", async () => {
    const { t, authed } = await authedTest();
    const equipmentId = await seedEquipment(t);

    await authed.mutation(api.partRequests.create, {
      requesterName: "Sandra Ruiz",
      priority: "normal",
      equipmentId,
      description: "La estación dispara el térmico.",
    });

    const [request] = await authed.query(api.partRequests.list, {});
    expect(request.equipmentId).toBe(equipmentId);
    expect(request.equipment).toBe("Estación de soldadura FX-888D");
  });

  test("rechaza un equipo del inventario que ya no existe", async () => {
    const { t, authed } = await authedTest();
    const equipmentId = await seedEquipment(t);
    await t.run((ctx) => ctx.db.delete(equipmentId));

    await expectConvexError(
      authed.mutation(api.partRequests.create, {
        requesterName: "Sandra Ruiz",
        priority: "normal",
        equipmentId,
        description: "Cualquier descripción válida.",
      }),
      "ya no existe en el inventario",
    );
  });
});

describe("partRequests.approve / reject — stock y decisiones", () => {
  async function pendingRequest(
    authed: Authed,
    line?: { sparePartId: Id<"spareParts">; quantity: number },
  ) {
    const reference = await authed.mutation(api.partRequests.create, {
      requesterName: "Sandra Ruiz",
      priority: "normal",
      description: "Petición de prueba",
      ...(line ? { lines: [line] } : {}),
    });
    const [request] = await authed.query(api.partRequests.list, {});
    expect(reference).toBe(request.reference);
    return request._id;
  }

  test("no permite aprobar sin referencia asociada", async () => {
    const { authed } = await authedTest();
    const requestId = await pendingRequest(authed);

    await expectConvexError(
      authed.mutation(api.partRequests.approve, { requestId }),
      "no tiene ningún repuesto asociado",
    );
  });

  test("al aprobar descuenta el stock y firma la decisión", async () => {
    const { t, authed } = await authedTest();
    const sparePartId = await seedPart(t, { stock: 10 });
    const requestId = await pendingRequest(authed, {
      sparePartId,
      quantity: 3,
    });

    await authed.mutation(api.partRequests.approve, {
      requestId,
      note: "Material apartado",
    });

    const [request] = await authed.query(api.partRequests.list, {});
    expect(request.status).toBe("approved");
    expect(request.decidedBy).toBe("Responsable de repuestos");
    expect(request.decisionNote).toBe("Material apartado");

    const stock = await t.run((ctx) => ctx.db.get(sparePartId));
    expect(stock?.stock).toBe(7);
  });

  test("no aprueba si falta stock y no modifica nada", async () => {
    const { t, authed } = await authedTest();
    const sparePartId = await seedPart(t, { stock: 1 });
    const requestId = await pendingRequest(authed, {
      sparePartId,
      quantity: 5,
    });

    await expectConvexError(
      authed.mutation(api.partRequests.approve, { requestId }),
      "Stock insuficiente",
    );

    const [request] = await authed.query(api.partRequests.list, {});
    expect(request.status).toBe("pending");
    const stock = await t.run((ctx) => ctx.db.get(sparePartId));
    expect(stock?.stock).toBe(1);
  });

  test("rechazar no toca el stock", async () => {
    const { t, authed } = await authedTest();
    const sparePartId = await seedPart(t, { stock: 10 });
    const requestId = await pendingRequest(authed, {
      sparePartId,
      quantity: 4,
    });

    await authed.mutation(api.partRequests.reject, {
      requestId,
      note: "Pendiente de presupuesto",
    });

    const [request] = await authed.query(api.partRequests.list, {});
    expect(request.status).toBe("rejected");
    expect(request.decisionNote).toBe("Pendiente de presupuesto");
    const stock = await t.run((ctx) => ctx.db.get(sparePartId));
    expect(stock?.stock).toBe(10);
  });
});

describe("asociación de repuestos — investigación del responsable", () => {
  async function freeRequest(authed: Authed) {
    await authed.mutation(api.partRequests.create, {
      requesterName: "Jorge Luna",
      priority: "normal",
      description: "Buscamos ventilador 120 mm 24 V, proveedor a investigar.",
    });
    const [request] = await authed.query(api.partRequests.list, {});
    return request._id;
  }

  test("asociar existente habilita la aprobación con descuento", async () => {
    const { t, authed } = await authedTest();
    const sparePartId = await seedPart(t, { stock: 8 });
    const requestId = await freeRequest(authed);

    const message = await authed.mutation(api.partRequests.associateExisting, {
      requestId,
      sparePartId,
      quantity: 2,
    });
    expect(message).toContain("TRI-60004 asociado");

    await authed.mutation(api.partRequests.approve, { requestId });

    const [request] = await authed.query(api.partRequests.list, {});
    expect(request.lines).toHaveLength(1);
    expect(request.lines[0].quantity).toBe(2);
    expect(request.status).toBe("approved");
    const stock = await t.run((ctx) => ctx.db.get(sparePartId));
    expect(stock?.stock).toBe(6);
  });

  test("no permite asociar el mismo repuesto dos veces", async () => {
    const { t, authed } = await authedTest();
    const sparePartId = await seedPart(t);
    const requestId = await freeRequest(authed);

    await authed.mutation(api.partRequests.associateExisting, {
      requestId,
      sparePartId,
    });
    await expectConvexError(
      authed.mutation(api.partRequests.associateExisting, {
        requestId,
        sparePartId,
      }),
      "ya está asociado",
    );
  });

  test("crear repuesto investigado lo añade al catálogo con proveedor y part number", async () => {
    const { t, authed } = await authedTest();
    const requestId = await freeRequest(authed);

    const message = await authed.mutation(api.partRequests.associateNew, {
      requestId,
      quantity: 2,
      part: {
        code: "ven-12024",
        name: "Ventilador axial 120 mm 24 V",
        category: "Electrónica",
        unit: "ud",
        stock: 4,
        minStock: 2,
        supplier: "Farnell",
        partNumber: "FAH12024HA-AR",
        unitPrice: 29.9,
        purchaseUrl: "https://example.com/fah12024",
      },
    });
    expect(message).toContain("creado y asociado");

    const part = await t.run((ctx) =>
      ctx.db
        .query("spareParts")
        .withIndex("by_code", (q) => q.eq("code", "VEN-12024"))
        .unique(),
    );
    expect(part).not.toBeNull();
    expect(part?.supplier).toBe("Farnell");
    expect(part?.partNumber).toBe("FAH12024HA-AR");

    const [request] = await authed.query(api.partRequests.list, {});
    expect(request.lines[0].code).toBe("VEN-12024");
    expect(request.lines[0].quantity).toBe(2);
  });

  test("no duplica códigos existentes al crear desde la petición", async () => {
    const { t, authed } = await authedTest();
    await seedPart(t, { code: "TRI-60004" });
    const requestId = await freeRequest(authed);

    await expectConvexError(
      authed.mutation(api.partRequests.associateNew, {
        requestId,
        part: {
          code: "tri-60004",
          name: "Triac alternativo",
          category: "Electrónica",
          unit: "ud",
          stock: 1,
          minStock: 0,
        },
      }),
      "Ya existe un repuesto con el código",
    );
  });
});

describe("inventario de equipos", () => {
  test("alta y listado", async () => {
    const { authed } = await authedTest();
    await authed.mutation(api.equipment.create, {
      code: "eq-007",
      brand: "Hakko",
      name: "Estación de soldadura",
      model: "FX-888D",
      location: "Taller SMD",
    });

    const equipment = await authed.query(api.equipment.list, {});
    expect(equipment).toHaveLength(1);
    expect(equipment[0].code).toBe("EQ-007");
    expect(equipment[0].model).toBe("FX-888D");
  });

  test("no se borra un equipo con repuestos compatibles", async () => {
    const { t, authed } = await authedTest();
    const equipmentId = await seedEquipment(t);
    await seedPart(t, { compatibleWith: [equipmentId] });

    await expectConvexError(
      authed.mutation(api.equipment.remove, { id: equipmentId }),
      "repuesto del catálogo es compatible",
    );
  });

  test("al eliminar se desvinculan las peticiones y conservan el texto", async () => {
    const { t, authed } = await authedTest();
    const equipmentId = await seedEquipment(t);
    await authed.mutation(api.partRequests.create, {
      requesterName: "Sandra Ruiz",
      priority: "normal",
      equipmentId,
      description: "Petición vinculada al equipo.",
    });

    await authed.mutation(api.equipment.remove, { id: equipmentId });

    const [request] = await authed.query(api.partRequests.list, {});
    expect(request.equipmentId).toBeUndefined();
    expect(request.equipment).toBe("Estación de soldadura FX-888D");
    const equipment = await authed.query(api.equipment.list, {});
    expect(equipment).toHaveLength(0);
  });
});

describe("compatibilidad repuesto ↔ modelo", () => {
  test("no acepta equipos inexistentes al guardar la compatibilidad", async () => {
    const { t, authed } = await authedTest();
    const equipmentId = await seedEquipment(t);
    const sparePartId = await seedPart(t);
    await t.run((ctx) => ctx.db.delete(equipmentId));

    await expectConvexError(
      authed.mutation(api.spareParts.update, {
        id: sparePartId,
        compatibleWith: [equipmentId],
      }),
      "ya no existe en el inventario",
    );
  });
});

describe("seed de datos de ejemplo", () => {
  test("carga los datos una sola vez", async () => {
    const { authed } = await authedTest();

    expect(await authed.mutation(api.seed.seedDemoData, {})).toBe(true);
    expect(await authed.mutation(api.seed.seedDemoData, {})).toBe(false);

    const parts = await authed.query(api.spareParts.list, {});
    const requests = await authed.query(api.partRequests.list, {});
    const equipment = await authed.query(api.equipment.list, {});
    expect(parts.length).toBeGreaterThan(0);
    expect(equipment.length).toBeGreaterThan(0);
    expect(requests.length).toBeGreaterThan(0);

    // La petición de ejemplo sin referencia exige asociación antes de aprobar.
    const free = requests.find(
      (r) => r.lines.length === 0 && r.status === "pending",
    );
    expect(free).toBeDefined();
    await expectConvexError(
      authed.mutation(api.partRequests.approve, { requestId: free!._id }),
      "no tiene ningún repuesto asociado",
    );
  });
});

describe("motivos de decisión con formato", () => {
  /** Una petición con referencia, lista para aprobar, entregar, esperar o cancelar. */
  async function pendingRequest(
    authed: Authed,
    line: { sparePartId: Id<"spareParts">; quantity: number },
  ) {
    const reference = await authed.mutation(api.partRequests.create, {
      requesterName: "Sandra Ruiz",
      priority: "normal",
      description: "Petición de prueba",
      lines: [line],
    });
    const requests = await authed.query(api.partRequests.list, {});
    const request = requests.find((item) => item.reference === reference);
    expect(request).toBeDefined();
    return request!._id;
  }

  test("la aprobación guarda el motivo como documento y se lee como texto", async () => {
    const { t, authed } = await authedTest();
    const sparePartId = await seedPart(t, { stock: 5 });
    const requestId = await pendingRequest(authed, {
      sparePartId,
      quantity: 1,
    });

    await authed.mutation(api.partRequests.approve, {
      requestId,
      note: "<p>Material <strong>apartado</strong> en el mostrador 1.</p><ul><li>Con su caja</li></ul>",
    });

    const [request] = await authed.query(api.partRequests.list, {});
    expect(request.status).toBe("approved");
    // El formato se guarda como bloques con sus marcas, no como HTML.
    expect(richDocBlocks(request.decisionNote)).toEqual([
      {
        type: "paragraph",
        inline: [
          { text: "Material " },
          { text: "apartado", marks: ["bold"] },
          { text: " en el mostrador 1." },
        ],
      },
      {
        type: "list",
        ordered: false,
        items: [[{ type: "paragraph", inline: [{ text: "Con su caja" }] }]],
      },
    ]);
    expect(request.decisionNote).not.toContain("<p>");
    // Y lo que leen la cola, el archivo y el CSV es su texto, en una línea.
    expect(richDocToPlainText(request.decisionNote)).toBe(
      "Material apartado en el mostrador 1.\nCon su caja",
    );
  });

  test("la entrega guarda su motivo; sin motivo no deja nota", async () => {
    const { t, authed } = await authedTest();
    const sparePartId = await seedPart(t, { stock: 5 });
    const withNote = await pendingRequest(authed, { sparePartId, quantity: 1 });
    const withoutNote = await pendingRequest(authed, {
      sparePartId,
      quantity: 1,
    });

    await authed.mutation(api.partRequests.approve, { requestId: withNote });
    await authed.mutation(api.partRequests.markIssued, {
      requestId: withNote,
      note: "<p>Entregado a <em>Marcos Vega</em> en mano.</p>",
    });
    await authed.mutation(api.partRequests.approve, { requestId: withoutNote });
    await authed.mutation(api.partRequests.markIssued, {
      requestId: withoutNote,
    });

    const requests = await authed.query(api.partRequests.list, {});
    const delivered = requests.find((item) => item._id === withNote)!;
    expect(delivered.status).toBe("issued");
    expect(delivered.issuedAt).toBeTypeOf("number");
    expect(richDocToPlainText(delivered.issueNote)).toBe(
      "Entregado a Marcos Vega en mano.",
    );
    expect(delivered.issueNote).not.toContain("<p>");
    // El motivo es opcional: sin él la entrega se firma igual, sin nota.
    expect(
      requests.find((item) => item._id === withoutNote)?.issueNote,
    ).toBeUndefined();
  });

  test("la espera y la cancelación guardan su motivo y dejan la traza en una línea", async () => {
    const { t, authed } = await authedTest();
    const sparePartId = await seedPart(t, { stock: 5 });
    const requestId = await pendingRequest(authed, {
      sparePartId,
      quantity: 1,
    });

    await authed.mutation(api.partRequests.onHold, {
      requestId,
      note: "<p>Esperando <strong>presupuesto</strong> del proveedor.</p>",
    });

    let [request] = await authed.query(api.partRequests.list, {});
    expect(request.status).toBe("onHold");
    expect(richDocToPlainText(request.holdNote)).toBe(
      "Esperando presupuesto del proveedor.",
    );
    // La traza del historial no admite formato: guarda el motivo en una línea.
    const held = await t.run((ctx) =>
      ctx.db.query("requestDecisions").collect(),
    );
    expect(held).toHaveLength(1);
    expect(held[0].decision?.reason).toBe("other");
    expect(held[0].decision?.note).toBe("Esperando presupuesto del proveedor.");

    await authed.mutation(api.partRequests.cancel, {
      requestId,
      note: "<p>Ya no hace falta: <em>lo compran fuera</em>.</p>",
    });

    [request] = await authed.query(api.partRequests.list, {});
    expect(request.status).toBe("cancelled");
    expect(richDocToPlainText(request.cancelNote)).toBe(
      "Ya no hace falta: lo compran fuera.",
    );
    const cancelled = await t.run((ctx) =>
      ctx.db.query("requestDecisions").collect(),
    );
    expect(cancelled).toHaveLength(2);
    expect(cancelled[1].decision?.reason).toBe("requestCancelled");
    expect(cancelled[1].decision?.note).toBe(
      "Ya no hace falta: lo compran fuera.",
    );
  });

  test("una nota de texto de siempre se guarda tal cual, sin envolverla", async () => {
    const { t, authed } = await authedTest();
    const sparePartId = await seedPart(t, { stock: 5 });
    const requestId = await pendingRequest(authed, {
      sparePartId,
      quantity: 1,
    });

    await authed.mutation(api.partRequests.reject, {
      requestId,
      note: "  Pendiente de presupuesto.  ",
    });

    const [request] = await authed.query(api.partRequests.list, {});
    expect(request.decisionNote).toBe("Pendiente de presupuesto.");
    // El editor vacío deja un párrafo vacío: eso no es un motivo.
    const otherId = await pendingRequest(authed, { sparePartId, quantity: 1 });
    await authed.mutation(api.partRequests.reject, {
      requestId: otherId,
      note: "<p></p>",
    });
    const requests = await authed.query(api.partRequests.list, {});
    expect(
      requests.find((item) => item._id === otherId)?.decisionNote,
    ).toBeUndefined();
  });
});

describe("descripciones y notas con formato", () => {
  test("el catálogo guarda la descripción del repuesto como documento", async () => {
    const { authed } = await authedTest();
    await authed.mutation(api.spareParts.create, {
      code: "con-1206",
      name: "Condensador cerámico 1206",
      category: "Electrónica",
      unit: "ud",
      stock: 10,
      minStock: 2,
      description:
        "<p>Cerámico de <strong>50 V</strong>.</p><ul><li>Tolerancia 5 %</li></ul>",
    });

    const [part] = await authed.query(api.spareParts.list, {});
    expect(part.code).toBe("CON-1206");
    // El formato va como bloques con sus marcas, no como HTML.
    expect(richDocBlocks(part.description)).toEqual([
      {
        type: "paragraph",
        inline: [
          { text: "Cerámico de " },
          { text: "50 V", marks: ["bold"] },
          { text: "." },
        ],
      },
      {
        type: "list",
        ordered: false,
        items: [[{ type: "paragraph", inline: [{ text: "Tolerancia 5 %" }] }]],
      },
    ]);
    expect(part.description).not.toContain("<p>");
    // Lo que buscan el buscador y el CSV es el texto, sin formato.
    expect(richDocToPlainText(part.description)).toBe(
      "Cerámico de 50 V.\nTolerancia 5 %",
    );

    // Una descripción de siempre se edita desde el campo de texto plano y se
    // guarda tal cual estaba.
    await authed.mutation(api.spareParts.update, {
      id: part._id,
      description: "  Repuesto de paso, sin más.  ",
    });
    const [plain] = await authed.query(api.spareParts.list, {});
    expect(plain.description).toBe("Repuesto de paso, sin más.");

    // Vaciarla deja la ficha en blanco, como hasta ahora.
    await authed.mutation(api.spareParts.update, {
      id: part._id,
      description: "<p></p>",
    });
    const [cleared] = await authed.query(api.spareParts.list, {});
    expect(cleared.description).toBe("");
  });

  test("la nota del solicitante se guarda con formato y se lee como texto", async () => {
    const { authed } = await authedTest();
    await authed.mutation(api.partRequests.create, {
      requesterName: "Sandra Ruiz",
      priority: "normal",
      description: "Un cable HDMI de 3 m.",
      notes: "<p>Se ha roto el <em>conector</em>.</p>",
    });

    const [request] = await authed.query(api.partRequests.list, {});
    expect(richDocBlocks(request.notes)).toEqual([
      {
        type: "paragraph",
        inline: [
          { text: "Se ha roto el " },
          { text: "conector", marks: ["italic"] },
          { text: "." },
        ],
      },
    ]);
    expect(request.notes).not.toContain("<p>");
    expect(richDocToPlainText(request.notes)).toBe("Se ha roto el conector.");

    // Una nota de antes sigue guardándose tal cual.
    await authed.mutation(api.partRequests.create, {
      requesterName: "Jorge Luna",
      priority: "normal",
      description: "Otra petición de repuestos.",
      notes: "  Lo necesito para el lunes.  ",
    });
    const plain = (await authed.query(api.partRequests.list, {})).find(
      (item) => item.requesterName === "Jorge Luna",
    )!;
    expect(plain.notes).toBe("Lo necesito para el lunes.");

    // El editor vacío deja un párrafo vacío: eso no deja nota.
    await authed.mutation(api.partRequests.create, {
      requesterName: "Sandra Ruiz",
      priority: "normal",
      description: "Una tercera petición.",
      notes: "<p></p>",
    });
    const third = (await authed.query(api.partRequests.list, {})).find(
      (item) => item.description === "Una tercera petición.",
    )!;
    expect(third.notes).toBeUndefined();
  });
});
