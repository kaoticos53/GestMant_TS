import { backend } from "./backend";
import { ConvexError } from "convex/values";
import { convexTest } from "convex-test";
import { describe, expect, test, vi } from "vitest";
import { richDocBlocks, richDocToPlainText } from "../src/lib/richDoc";
import { api } from "../src/convex/_generated/api";
import type { Id } from "../src/convex/_generated/dataModel";

type Test = ReturnType<typeof convexTest>;
type Authed = ReturnType<Test["withIdentity"]>;

/** Instancia de test con un usuario autenticado (getAuthUserId lee el subject). */
async function authedTest() {
  const t = backend();
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
    compatibleModels: Id<"equipmentModels">[];
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
      ...(overrides.compatibleModels
        ? { compatibleModels: overrides.compatibleModels }
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

  test("no reutiliza una referencia gastada cuando la papelera borra la petición", async () => {
    const { t, authed } = await authedTest();
    const createRequest = (name: string) =>
      authed.mutation(api.partRequests.create, {
        requesterName: name,
        priority: "normal",
        description: `Petición de ${name}`,
      });

    expect(await createRequest("Sandra Ruiz")).toBe("PET-0001");
    expect(await createRequest("Marcos Vega")).toBe("PET-0002");
    expect(await createRequest("Jorge Luna")).toBe("PET-0003");

    // Se retira la primera y la papelera la borra de verdad: en la tabla quedan
    // dos filas, pero el número 1 ya se gastó —y sigue citado en las órdenes de
    // compra que salieron de ella—, así que no puede volver a repartirse.
    const [first] = await t.run((ctx) =>
      ctx.db
        .query("partRequests")
        .withIndex("by_reference", (q) => q.eq("reference", "PET-0001"))
        .collect(),
    );
    expect(first?.reference).toBe("PET-0001");
    await authed.mutation(api.partRequests.withdraw, {
      requestId: first._id,
      reason: "Pedida dos veces",
    });
    await authed.mutation(api.partRequests.deleteNow, {
      requestId: first._id,
    });

    // La siguiente continúa la numeración en vez de heredar el hueco.
    expect(await createRequest("Iván Torres")).toBe("PET-0004");

    const references = (
      await t.run((ctx) => ctx.db.query("partRequests").collect())
    ).map((row) => row.reference);
    expect([...references].sort()).toEqual([
      "PET-0002",
      "PET-0003",
      "PET-0004",
    ]);
  });

  test("una serie vaciada entera sigue la numeración: la referencia gastada no vuelve", async () => {
    const { t, authed } = await authedTest();
    const createRequest = (name: string) =>
      authed.mutation(api.partRequests.create, {
        requesterName: name,
        priority: "normal",
        description: `Petición de ${name}`,
      });

    expect(await createRequest("Sandra Ruiz")).toBe("PET-0001");
    expect(await createRequest("Marcos Vega")).toBe("PET-0002");
    expect(await createRequest("Jorge Luna")).toBe("PET-0003");

    // La papelera borra las tres: de la serie no queda ni una fila, y lo único que
    // recuerda que el 1, el 2 y el 3 ya se gastaron es el contador.
    for (const row of await t.run((ctx) =>
      ctx.db.query("partRequests").collect(),
    )) {
      await authed.mutation(api.partRequests.withdraw, { requestId: row._id });
      await authed.mutation(api.partRequests.deleteNow, { requestId: row._id });
    }
    expect(
      await t.run((ctx) => ctx.db.query("partRequests").collect()),
    ).toEqual([]);

    // Los números gastados no se reciclan ni con la tabla vacía.
    expect(await createRequest("Iván Torres")).toBe("PET-0004");

    const counter = await t.run((ctx) =>
      ctx.db
        .query("referenceCounters")
        .withIndex("by_kind", (q) => q.eq("kind", "partRequest"))
        .unique(),
    );
    expect(counter?.last).toBe(4);
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

describe("partRequests.onHold / resume — suspender es un paréntesis", () => {
  /** Una petición nueva con una línea de repuesto, devuelta ya guardada. */
  async function requestWithStock(t: Test, authed: Authed, quantity: number) {
    const sparePartId = await seedPart(t, { stock: 10 });
    await authed.mutation(api.partRequests.create, {
      requesterName: "Sandra Ruiz",
      priority: "normal",
      lines: [{ sparePartId, quantity }],
    });
    const [request] = await authed.query(api.partRequests.list, {});
    return { sparePartId, requestId: request._id };
  }

  test("una aprobada que se suspende vuelve a aprobada: el material no se descuenta dos veces", async () => {
    const { t, authed } = await authedTest();
    const { sparePartId, requestId } = await requestWithStock(t, authed, 3);

    await authed.mutation(api.partRequests.approve, {
      requestId,
      note: "Material apartado",
    });
    const stock = async () =>
      (await t.run((ctx) => ctx.db.get(sparePartId)))?.stock;
    expect(await stock()).toBe(7);

    await authed.mutation(api.partRequests.onHold, {
      requestId,
      note: "El técnico está fuera",
    });
    expect((await authed.query(api.partRequests.list, {}))[0].status).toBe(
      "onHold",
    );

    await authed.mutation(api.partRequests.resume, { requestId });

    // Vuelve a «aprobada» —el material sigue apartado— y no a «pendiente».
    const [request] = await authed.query(api.partRequests.list, {});
    expect(request.status).toBe("approved");
    expect(await stock()).toBe(7);

    // Y aprobarla otra vez ya no es un paso: antes sí lo era, y descontaba el
    // material por segunda vez (de 7 a 4).
    await expectConvexError(
      authed.mutation(api.partRequests.approve, { requestId }),
      "ya fue resuelta y no puede aprobarse",
    );
    expect(await stock()).toBe(7);
  });

  test("una petición que espera presupuesto no lo olvida al reanudarse", async () => {
    const { t, authed } = await authedTest();
    const { requestId } = await requestWithStock(t, authed, 1);

    await authed.mutation(api.partRequests.requestQuote, {
      requestId,
      note: "Pedido precio al proveedor",
    });
    await authed.mutation(api.partRequests.onHold, { requestId });
    await authed.mutation(api.partRequests.resume, { requestId });

    const [request] = await authed.query(api.partRequests.list, {});
    expect(request.status).toBe("pendingSupplierQuote");
    expect(request.quoteRequestedAt).toBeDefined();
  });

  test("no se suspende una petición ya entregada: primero se devuelve", async () => {
    const { t, authed } = await authedTest();
    const { requestId } = await requestWithStock(t, authed, 1);

    await authed.mutation(api.partRequests.approve, { requestId });
    await authed.mutation(api.partRequests.markIssued, { requestId });

    await expectConvexError(
      authed.mutation(api.partRequests.onHold, { requestId }),
      "Solo se pueden poner en espera",
    );
    const [request] = await authed.query(api.partRequests.list, {});
    expect(request.status).toBe("issued");
  });

  test("una petición suspendida antes de que se apuntara de dónde salía vuelve a pendiente", async () => {
    const { t, authed } = await authedTest();
    const { requestId } = await requestWithStock(t, authed, 1);

    // Como quedaron las que se suspendieron con la versión anterior: en espera y
    // sin memoria del estado del que salieron.
    await t.run((ctx) =>
      ctx.db.patch(requestId, { status: "onHold", holdSinceAt: Date.now() }),
    );

    await authed.mutation(api.partRequests.resume, { requestId });
    const [request] = await authed.query(api.partRequests.list, {});
    expect(request.status).toBe("pending");
  });
});

describe("partRequests.issueLines — el material sale de una en una", () => {
  /** Una petición aprobada con dos líneas, devuelta ya guardada. */
  async function approvedWithTwoLines(t: Test, authed: Authed) {
    const fuente = await seedPart(t, {
      code: "ALI-12024",
      name: "Fuente de alimentación 12 V",
      stock: 10,
    });
    const filtro = await seedPart(t, {
      code: "FIL-00042",
      name: "Filtro de aire",
      stock: 10,
    });
    await authed.mutation(api.partRequests.create, {
      requesterName: "Sandra Ruiz",
      priority: "normal",
      lines: [
        { sparePartId: fuente, quantity: 5 },
        { sparePartId: filtro, quantity: 2 },
      ],
    });
    const [created] = await authed.query(api.partRequests.list, {});
    await authed.mutation(api.partRequests.approve, { requestId: created._id });
    return { requestId: created._id, fuente, filtro };
  }

  /** La petición guardada, con sus líneas ya entregadas. */
  async function saved(authed: Authed) {
    const [request] = await authed.query(api.partRequests.list, {});
    return request;
  }

  test("entregar una línea no cierra la petición: sigue aprobada, con lo entregado apuntado", async () => {
    const { t, authed } = await authedTest();
    const { requestId, fuente } = await approvedWithTwoLines(t, authed);

    await authed.mutation(api.partRequests.issueLines, {
      requestId,
      lines: [{ sparePartId: fuente, quantity: 2 }],
    });

    const request = await saved(authed);
    // Lo que salió, apuntado en su línea; lo demás, intacto.
    expect(request.lines[0].deliveredQuantity).toBe(2);
    expect(request.lines[0].deliveredAt).toBeTypeOf("number");
    expect(request.lines[1].deliveredQuantity).toBeUndefined();
    // Y la petición no se da por entregada: falta material.
    expect(request.status).toBe("approved");
    expect(request.issuedAt).toBeUndefined();
    // El stock sigue como quedó al aprobar: apartar el material no es entregarlo.
    expect((await t.run((ctx) => ctx.db.get(fuente)))?.stock).toBe(5);

    // La segunda tanda entrega el resto de una línea, y sigue sin cerrarse.
    await authed.mutation(api.partRequests.issueLines, {
      requestId,
      lines: [{ sparePartId: fuente, quantity: 3 }],
    });
    const aMedias = await saved(authed);
    expect(aMedias.lines[0].deliveredQuantity).toBe(5);
    expect(aMedias.status).toBe("approved");
  });

  test("la última unidad que sale cierra la petición, con su fecha de entrega", async () => {
    const { t, authed } = await authedTest();
    const { requestId, fuente, filtro } = await approvedWithTwoLines(t, authed);

    await authed.mutation(api.partRequests.issueLines, {
      requestId,
      lines: [{ sparePartId: fuente, quantity: 5 }],
    });
    await authed.mutation(api.partRequests.issueLines, {
      requestId,
      lines: [{ sparePartId: filtro, quantity: 2 }],
      note: "Las dos piezas que quedaban",
    });

    const request = await saved(authed);
    expect(request.status).toBe("issued");
    expect(request.issuedAt).toBeTypeOf("number");
    expect(request.issueNote).toBe("Las dos piezas que quedaban");
    expect(request.lines.map((line) => line.deliveredQuantity)).toEqual([5, 2]);

    // Y una petición ya entregada no admite más tandas.
    await expectConvexError(
      authed.mutation(api.partRequests.issueLines, {
        requestId,
        lines: [{ sparePartId: fuente, quantity: 1 }],
      }),
      "Solo se pueden entregar peticiones aprobadas",
    );
  });

  test("no se entrega lo que no hay: ni de más, ni repetido, ni de otra petición", async () => {
    const { t, authed } = await authedTest();
    const { requestId, fuente } = await approvedWithTwoLines(t, authed);
    const ajeno = await seedPart(t, { code: "OTR-00001", stock: 5 });

    await expectConvexError(
      authed.mutation(api.partRequests.issueLines, {
        requestId,
        lines: [{ sparePartId: fuente, quantity: 6 }],
      }),
      "quedan 5 por entregar",
    );
    await expectConvexError(
      authed.mutation(api.partRequests.issueLines, {
        requestId,
        lines: [{ sparePartId: ajeno, quantity: 1 }],
      }),
      "no forma parte de esta petición",
    );
    await expectConvexError(
      authed.mutation(api.partRequests.issueLines, {
        requestId,
        lines: [{ sparePartId: fuente, quantity: 0 }],
      }),
      "una o más",
    );
    await expectConvexError(
      authed.mutation(api.partRequests.issueLines, { requestId, lines: [] }),
      "Indica qué repuestos se entregan",
    );

    // Dos entradas de la misma línea se suman antes de comparar: pedir 3 y 3 de
    // una línea con 5 no puede colarse por venir repartido.
    await expectConvexError(
      authed.mutation(api.partRequests.issueLines, {
        requestId,
        lines: [
          { sparePartId: fuente, quantity: 3 },
          { sparePartId: fuente, quantity: 3 },
        ],
      }),
      "quedan 5 por entregar",
    );

    // Y nada de lo rechazado dejó rastro: la petición sigue aprobada y sin tandas.
    const request = await saved(authed);
    expect(request.status).toBe("approved");
    expect(request.lines[0].deliveredQuantity).toBeUndefined();
    expect(request.lines[1].deliveredQuantity).toBeUndefined();
  });

  test("una línea ya entregada entera no admite más tandas", async () => {
    const { t, authed } = await authedTest();
    const { requestId, filtro } = await approvedWithTwoLines(t, authed);

    await authed.mutation(api.partRequests.issueLines, {
      requestId,
      lines: [{ sparePartId: filtro, quantity: 2 }],
    });

    await expectConvexError(
      authed.mutation(api.partRequests.issueLines, {
        requestId,
        lines: [{ sparePartId: filtro, quantity: 1 }],
      }),
      "ya está entregado todo",
    );
  });

  test("entregar todo de una vez sigue siendo un solo paso, y apunta lo entregado en cada línea", async () => {
    const { t, authed } = await authedTest();
    const { requestId } = await approvedWithTwoLines(t, authed);

    await authed.mutation(api.partRequests.markIssued, { requestId });

    const request = await saved(authed);
    expect(request.status).toBe("issued");
    expect(request.lines.map((line) => line.deliveredQuantity)).toEqual([5, 2]);

    // Y deja la misma constancia que una entrega por tandas, con lo que salió.
    const trail = await authed.query(api.partRequests.decisions, { requestId });
    expect(trail.map((row) => row.decision?.reason)).toEqual([
      "materialDelivered",
    ]);
    expect(trail[0].decision?.note).toBe(
      "5 × ALI-12024 Fuente de alimentación 12 V · 2 × FIL-00042 Filtro de aire",
    );
  });

  test("cada tanda deja constancia: quién la entregó, cuándo y qué salió", async () => {
    const { t, authed } = await authedTest();
    const { requestId, fuente, filtro } = await approvedWithTwoLines(t, authed);

    await authed.mutation(api.partRequests.issueLines, {
      requestId,
      lines: [{ sparePartId: fuente, quantity: 2 }],
    });
    await authed.mutation(api.partRequests.issueLines, {
      requestId,
      lines: [
        { sparePartId: fuente, quantity: 3 },
        { sparePartId: filtro, quantity: 2 },
      ],
    });

    const trail = await authed.query(api.partRequests.decisions, { requestId });
    // Lo más reciente primero, y cada tanda con lo que salió en ella —no con el
    // acumulado—: es lo que no se puede reconstruir desde las líneas.
    expect(trail.map((row) => row.decision?.reason)).toEqual([
      "materialDelivered",
      "materialPartiallyDelivered",
    ]);
    expect(trail[0].by).toBe("Responsable de repuestos");
    expect(trail[0].decision?.note).toBe(
      "3 × ALI-12024 Fuente de alimentación 12 V · 2 × FIL-00042 Filtro de aire",
    );
    expect(trail[1].decision?.note).toBe(
      "2 × ALI-12024 Fuente de alimentación 12 V",
    );
    // Y cada constancia con su hora, que es la otra mitad de la pregunta.
    expect(trail[0].at).toBeTypeOf("number");
    expect(trail[1].at).toBeTypeOf("number");
    expect(trail[0].at).toBeGreaterThanOrEqual(trail[1].at);
  });

  test("dos tandas en el mismo milisegundo conservan el orden en que pasaron", async () => {
    // El reloj congelado: las dos entregas caen en la misma hora, que es lo que
    // pasaba de verdad con dos mutations seguidas —y lo que dejaba el rastro
    // empatado, en el orden que quisiera la consulta—.
    const reloj = vi.spyOn(Date, "now").mockReturnValue(1_700_000_000_000);
    try {
      const { t, authed } = await authedTest();
      const { requestId, fuente, filtro } = await approvedWithTwoLines(
        t,
        authed,
      );

      await authed.mutation(api.partRequests.issueLines, {
        requestId,
        lines: [{ sparePartId: fuente, quantity: 2 }],
      });
      await authed.mutation(api.partRequests.issueLines, {
        requestId,
        lines: [
          { sparePartId: fuente, quantity: 3 },
          { sparePartId: filtro, quantity: 2 },
        ],
      });

      const trail = await authed.query(api.partRequests.decisions, {
        requestId,
      });
      // La última tanda es la que completa el material, y va primero.
      expect(trail.map((row) => row.decision?.reason)).toEqual([
        "materialDelivered",
        "materialPartiallyDelivered",
      ]);
      // La hora escrita se apunta siempre por delante de la anterior: no empatan.
      expect(trail[0].at).toBeGreaterThan(trail[1].at);
    } finally {
      reloj.mockRestore();
    }
  });

  test("el rastro de una petición no lo lee quien no es del taller", async () => {
    const { t, authed } = await authedTest();
    const { requestId } = await approvedWithTwoLines(t, authed);
    await authed.mutation(api.partRequests.markIssued, { requestId });

    // Con una sesión de invitado —sin ser del taller— no hay constancia que leer.
    const guestId = await t.run((ctx) =>
      ctx.db.insert("users", {
        name: "Invitado",
        role: "guest",
        isAnonymous: true,
      }),
    );
    const guest = t.withIdentity({ subject: `${guestId}|session1` });
    expect(
      await guest.query(api.partRequests.decisions, { requestId }),
    ).toEqual([]);
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

  test("al borrar un equipo físico los repuestos compatibles con su modelo no se alteran ni se pierden", async () => {
    const { t, authed } = await authedTest();
    // 1. Crear modelo técnico independiente
    const modelId = await authed.mutation(api.equipmentModels.create, {
      model: "FX-888D",
      name: "Estación de soldadura digital",
      brand: "Hakko",
      category: "Soldadura",
    });

    // 2. Crear dos unidades físicas del mismo modelo
    const eq1 = await authed.mutation(api.equipment.create, {
      code: "EQ-001",
      name: "Estación de soldadura 1",
      model: "FX-888D",
      modelId,
    });
    const eq2 = await authed.mutation(api.equipment.create, {
      code: "EQ-002",
      name: "Estación de soldadura 2",
      model: "FX-888D",
      modelId,
    });

    // 3. Crear repuesto compatible con el modelo técnico
    const partId = await authed.mutation(api.spareParts.create, {
      code: "PUN-001",
      name: "Punta soldador T18-D16",
      category: "Soldadura",
      unit: "ud",
      stock: 10,
      minStock: 2,
      compatibleModels: [modelId],
    });

    // 4. Borrar la primera unidad física
    await authed.mutation(api.equipment.remove, { id: eq1 });
    expect(await t.run((ctx) => ctx.db.get(eq1))).toBeNull();

    // El repuesto conserva intacta su compatibilidad con el modelo
    let part = await t.run((ctx) => ctx.db.get(partId));
    expect(part?.compatibleModels).toEqual([modelId]);

    // 5. Borrar la segunda unidad física (ya no queda ningún equipo físico en el inventario)
    await authed.mutation(api.equipment.remove, { id: eq2 });
    expect(await t.run((ctx) => ctx.db.get(eq2))).toBeNull();

    // El repuesto NO queda huérfano: sigue perteneciendo al modelo técnico
    part = await t.run((ctx) => ctx.db.get(partId));
    expect(part?.compatibleModels).toEqual([modelId]);

    // 6. Si se compra y da de alta un nuevo equipo de ese modelo, hereda el modelId y la compatibilidad
    const eq3 = await authed.mutation(api.equipment.create, {
      code: "EQ-003",
      name: "Estación de soldadura 3",
      model: "FX-888D",
    });
    const savedEq3 = await t.run((ctx) => ctx.db.get(eq3));
    expect(savedEq3?.modelId).toBe(modelId);
  });

  test("los repuestos pueden ligarse a modelos de equipo y se desvinculan solo al borrar el modelo técnico", async () => {
    const { t, authed } = await authedTest();
    const modelId = await authed.mutation(api.equipmentModels.create, {
      model: "FX-888D",
      name: "Estación de soldadura digital",
      brand: "Hakko",
      category: "Soldadura",
    });

    const partId = await authed.mutation(api.spareParts.create, {
      code: "PUN-002",
      name: "Punta soldador T18-B",
      category: "Soldadura",
      unit: "ud",
      stock: 5,
      minStock: 1,
      compatibleModels: [modelId],
    });

    const part = await t.run((ctx) => ctx.db.get(partId));
    expect(part?.compatibleModels).toEqual([modelId]);

    // Al eliminar el modelo de equipo de catálogo, se desvincula del repuesto
    await authed.mutation(api.equipmentModels.remove, { id: modelId });
    const updatedPart = await t.run((ctx) => ctx.db.get(partId));
    expect(updatedPart?.compatibleModels).toEqual([]);
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

describe("partRequests.detail — abrir una petición concreta, sin cargar la cola", () => {
  /** Una petición insertada tal cual, para ponerle el estado que pide la prueba. */
  async function peticionInsertada(
    extra: Record<string, unknown> = {},
  ): Promise<{ t: Test; authed: Authed; id: Id<"partRequests"> }> {
    const { t, authed } = await authedTest();
    const id = await t.run((ctx) =>
      ctx.db.insert("partRequests", {
        reference: "PET-0001",
        requesterName: "Sandra Ruiz",
        priority: "normal",
        status: "issued",
        lines: [],
        attachments: [],
        createdAt: Date.now(),
        ...extra,
      }),
    );
    return { t, authed, id };
  }

  test("la archivada se abre por su id aunque la cola no la traiga", async () => {
    // Es el caso de la ficha de una incidencia: enlaza con su material, y ese
    // material puede estar ya en el archivo. La cola no lo carga —sus adjuntos no
    // se firman si no se piden—, así que la ficha se abre por esta puerta.
    const { authed, id } = await peticionInsertada({
      archivedAt: Date.now(),
      archivedBy: "Elena Vidal",
    });

    const detalle = await authed.query(api.partRequests.detail, {
      requestId: id,
    });
    expect(detalle?.reference).toBe("PET-0001");
    expect(detalle?.archivedAt).toBeTypeOf("number");

    // Y no ha vuelto a la cola: abrir no recupera.
    expect(await authed.query(api.partRequests.list, {})).toEqual([]);
  });

  test("lo retirado no se abre: eso vive en la papelera", async () => {
    const { authed, id } = await peticionInsertada({
      deletedAt: Date.now(),
      deletedBy: "Elena Vidal",
    });
    expect(
      await authed.query(api.partRequests.detail, { requestId: id }),
    ).toBeNull();
  });

  test("una petición que ya no existe contesta sin reventar", async () => {
    // La ficha de la incidencia puede llegar con un id que la papelera ya borró
    // de verdad: tiene que decir que no hay nada, no tumbar la pantalla.
    const { t, authed, id } = await peticionInsertada();
    await t.run((ctx) => ctx.db.delete(id));

    expect(
      await authed.query(api.partRequests.detail, { requestId: id }),
    ).toBeNull();
  });

  test("sin sesión no hay nada que leer", async () => {
    const { t, id } = await peticionInsertada({ archivedAt: Date.now() });

    // La misma puerta que la cola: fuera del taller no se enseña ni una ficha.
    expect(
      await t.query(api.partRequests.detail, { requestId: id }),
    ).toBeNull();
  });
});
