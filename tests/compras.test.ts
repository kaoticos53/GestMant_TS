import "./precalentarModulos";
import { ConvexError } from "convex/values";
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "../src/convex/_generated/api";
import type { Id } from "../src/convex/_generated/dataModel";
import schema from "../src/convex/schema";
import {
  groupBySupplier,
  groupSummary,
  orderTotals,
  requestsMissingStock,
} from "../src/lib/purchasing";

/** Todos los módulos de funciones de la app (convex-test los levanta in-process). */
const modules = import.meta.glob("../src/convex/**/!(*.*.*)*.*s");

type Test = ReturnType<typeof convexTest>;
type Authed = ReturnType<Test["withIdentity"]>;

/**
 * El taller con su gente: el responsable de repuestos (que compra), un técnico
 * (que pide) y el administrador. Cada uno entra con su propia sesión, que es
 * como se comprueban los permisos de verdad.
 */
async function taller() {
  const t = convexTest(schema, modules);
  const responsable = await t.run((ctx) =>
    ctx.db.insert("users", {
      name: "Rita Repuestos",
      email: "responsable@taller.es",
      role: "manager",
    }),
  );
  const tecnico = await t.run((ctx) =>
    ctx.db.insert("users", {
      name: "Teo Técnico",
      email: "tecnico@taller.es",
      role: "technician",
    }),
  );
  return {
    t,
    responsable,
    tecnico,
    como: (userId: Id<"users">): Authed =>
      t.withIdentity({ subject: `${userId}|sesion` }),
  };
}

/** Lanza el error de Convex y comprueba que el mensaje dice lo esperado. */
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
  overrides: {
    code?: string;
    name?: string;
    supplier?: string;
    stock?: number;
    unit?: string;
  } = {},
) {
  return await t.run((ctx) =>
    ctx.db.insert("spareParts", {
      code: overrides.code ?? "ALI-24015",
      name: overrides.name ?? "Fuente de alimentación",
      category: "Electrónica",
      unit: overrides.unit ?? "ud",
      stock: overrides.stock ?? 0,
      minStock: 1,
      ...(overrides.supplier === undefined
        ? {}
        : { supplier: overrides.supplier }),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }),
  );
}

/** La petición de repuesto del técnico, con sus líneas. */
async function pedir(
  taller: Awaited<ReturnType<typeof taller>>,
  lines: { sparePartId: Id<"spareParts">; quantity: number }[],
) {
  const authed = taller.como(taller.tecnico);
  await authed.mutation(api.partRequests.create, {
    requesterName: "Teo Técnico",
    requesterTeam: "Plató 1",
    priority: "normal",
    lines,
  });
  const [request] = await authed.query(api.partRequests.list, {});
  return request;
}

/** Guarda un albarán de mentira y devuelve su referencia de almacenamiento. */
async function albaran(t: Test, nombre = "albaran-2026-10.pdf") {
  const storageId = await t.run((ctx) =>
    ctx.storage.store(new Blob(["albarán"], { type: "application/pdf" })),
  );
  return { storageId, name: nombre, kind: "document" as const };
}

describe("peticiones de compra: lo que el almacén no cubre", () => {
  test("sin stock no se puede aprobar, y el responsable la aparta para comprarla", async () => {
    const mundo = await taller();
    const part = await seedPart(mundo.t, { supplier: "Electro Suministros" });
    const request = await pedir(mundo, [{ sparePartId: part, quantity: 3 }]);
    const authed = mundo.como(mundo.responsable);

    // El almacén no tiene nada que apartar: aprobar no es una opción.
    await expectConvexError(
      authed.mutation(api.partRequests.approve, { requestId: request._id }),
      "Stock insuficiente",
    );

    const { references, repeated } = await authed.mutation(
      api.purchasing.requestPurchase,
      { requestId: request._id },
    );
    expect(references).toEqual(["PC-0001"]);
    expect(repeated).toBe(0);

    const { requests, groups } = await authed.query(
      api.purchasing.listPurchaseRequests,
      {},
    );
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({
      reference: "PC-0001",
      requestReference: request.reference,
      requestDate: request.createdAt,
      requesterName: "Teo Técnico",
      code: "ALI-24015",
      quantity: 3,
      supplier: "Electro Suministros",
      status: "pending",
      // Nació sin stock: no es que se haya agotado, es que nunca estuvo.
      reason: "newPart",
      requestedBy: "Rita Repuestos",
    });
    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({
      supplier: "Electro Suministros",
      quantity: 3,
      requests: 1,
    });
    expect(groups[0].items.map((row) => row.reference)).toEqual(["PC-0001"]);
  });

  test("el mismo repuesto no se compra dos veces, y lo que ya hay no se pide", async () => {
    const mundo = await taller();
    const part = await seedPart(mundo.t, { stock: 0 });
    const request = await pedir(mundo, [{ sparePartId: part, quantity: 2 }]);
    const authed = mundo.como(mundo.responsable);

    await authed.mutation(api.purchasing.requestPurchase, {
      requestId: request._id,
    });
    await expectConvexError(
      authed.mutation(api.purchasing.requestPurchase, {
        requestId: request._id,
      }),
      "Ya había una petición de compra viva",
    );

    // Con existencias de sobra tampoco hay nada que comprar.
    const enStock = await seedPart(mundo.t, { code: "CON-1", stock: 5 });
    const otra = await pedir(mundo, [{ sparePartId: enStock, quantity: 1 }]);
    await expectConvexError(
      authed.mutation(api.purchasing.requestPurchase, { requestId: otra._id }),
      "no hace falta comprar nada",
    );
  });

  test("se agrupan por proveedor, y solo lo que está sin tratar", async () => {
    const mundo = await taller();
    const uno = await seedPart(mundo.t, {
      code: "A-1",
      supplier: "Electro Suministros",
    });
    const dos = await seedPart(mundo.t, {
      code: "A-2",
      supplier: "Electro Suministros",
    });
    const tres = await seedPart(mundo.t, {
      code: "B-1",
      supplier: "Ferretería Norte",
    });
    const request = await pedir(mundo, [
      { sparePartId: uno, quantity: 2 },
      { sparePartId: dos, quantity: 1 },
      { sparePartId: tres, quantity: 4 },
    ]);
    const authed = mundo.como(mundo.responsable);
    await authed.mutation(api.purchasing.requestPurchase, {
      requestId: request._id,
    });

    const { groups } = await authed.query(
      api.purchasing.listPurchaseRequests,
      {},
    );
    expect(groups.map((group) => group.supplier)).toEqual([
      "Electro Suministros",
      "Ferretería Norte",
    ]);
    expect(groups[0].items).toHaveLength(2);
    expect(groups[0].quantity).toBe(3);
    expect(groups[1].quantity).toBe(4);
    // Un repuesto sin proveedor no desaparece: se agrupa bajo un nombre claro.
    const sinProveedor = await seedPart(mundo.t, { code: "C-1" });
    const otra = await pedir(mundo, [
      { sparePartId: sinProveedor, quantity: 1 },
    ]);
    await authed.mutation(api.purchasing.requestPurchase, {
      requestId: otra._id,
    });
    const { groups: grupos } = await authed.query(
      api.purchasing.listPurchaseRequests,
      {},
    );
    expect(grupos.map((group) => group.supplier)).toContain("Sin proveedor");
  });
});

describe("órdenes de compra", () => {
  test("la orden lleva su número y su fecha, y las peticiones que la generaron", async () => {
    const mundo = await taller();
    const uno = await seedPart(mundo.t, { code: "A-1", supplier: "Electro" });
    const dos = await seedPart(mundo.t, { code: "A-2", supplier: "Electro" });
    const request = await pedir(mundo, [
      { sparePartId: uno, quantity: 1 },
      { sparePartId: dos, quantity: 2 },
    ]);
    const authed = mundo.como(mundo.responsable);
    const { references } = await authed.mutation(
      api.purchasing.requestPurchase,
      {
        requestId: request._id,
      },
    );

    expect(await authed.query(api.purchasing.listOrders, {})).toEqual([]);

    const { requests: lineas } = await authed.query(
      api.purchasing.listPurchaseRequests,
      {},
    );
    expect(lineas).toHaveLength(2);
    const creada = await authed.mutation(api.purchasing.createOrder, {
      purchaseRequestIds: lineas.map((row) => row._id),
      notes: "Pedido urgente",
      lineNotes: {
        [lineas[0]._id]: "El proveedor tiene que confirmar el plazo",
      },
    });
    expect(creada.reference).toBe("OC-0001");

    const despues = await authed.query(api.purchasing.listOrders, {});
    expect(despues).toHaveLength(1);
    const orden = despues[0];
    expect(orden.status).toBe("pending");
    expect(orden.supplier).toBe("Electro");
    expect(orden.notes).toBe("Pedido urgente");
    expect(orden.lines).toHaveLength(2);
    // Cada artículo dice de qué petición de repuesto sale y cuándo se pidió.
    for (const line of orden.lines) {
      expect(line.requestReference).toBe(request.reference);
      expect(line.requestDate).toBe(request.createdAt);
      expect(line.receivedQuantity).toBe(0);
    }
    expect(orden.lines[0].note).toContain("confirmar el plazo");
    // Y la cabecera, con el número y la fecha de la petición que la originó.
    expect(orden.requestRefs).toEqual([
      { reference: request.reference, requestedAt: request.createdAt },
    ]);

    // Las peticiones de compra ya no esperan: están dentro de la orden.
    const { requests } = await authed.query(
      api.purchasing.listPurchaseRequests,
      {
        status: "ordered",
      },
    );
    expect(requests.map((row) => row.reference).sort()).toEqual(
      references.sort(),
    );
    expect(requests[0].orderId).toBe(orden._id);
  });

  test("una orden es de un solo proveedor, y una petición no se compra dos veces", async () => {
    const mundo = await taller();
    const uno = await seedPart(mundo.t, { code: "A-1", supplier: "Electro" });
    const dos = await seedPart(mundo.t, {
      code: "B-1",
      supplier: "Ferretería",
    });
    const request = await pedir(mundo, [
      { sparePartId: uno, quantity: 1 },
      { sparePartId: dos, quantity: 1 },
    ]);
    const authed = mundo.como(mundo.responsable);
    await authed.mutation(api.purchasing.requestPurchase, {
      requestId: request._id,
    });
    const { requests } = await authed.query(
      api.purchasing.listPurchaseRequests,
      {},
    );

    await expectConvexError(
      authed.mutation(api.purchasing.createOrder, {
        purchaseRequestIds: requests.map((row) => row._id),
      }),
      "Una orden es de un solo proveedor",
    );

    const soloElectro = requests.filter((row) => row.supplier === "Electro");
    await authed.mutation(api.purchasing.createOrder, {
      purchaseRequestIds: soloElectro.map((row) => row._id),
    });
    await expectConvexError(
      authed.mutation(api.purchasing.createOrder, {
        purchaseRequestIds: soloElectro.map((row) => row._id),
      }),
      "ya está en una orden",
    );
  });

  test("anular la orden devuelve a la cola lo que aún no ha llegado", async () => {
    const mundo = await taller();
    const uno = await seedPart(mundo.t, { code: "A-1", supplier: "Electro" });
    const dos = await seedPart(mundo.t, { code: "A-2", supplier: "Electro" });
    const request = await pedir(mundo, [
      { sparePartId: uno, quantity: 1 },
      { sparePartId: dos, quantity: 1 },
    ]);
    const authed = mundo.como(mundo.responsable);
    await authed.mutation(api.purchasing.requestPurchase, {
      requestId: request._id,
    });
    const { requests } = await authed.query(
      api.purchasing.listPurchaseRequests,
      {},
    );
    const { orderId } = await authed.mutation(api.purchasing.createOrder, {
      purchaseRequestIds: requests.map((row) => row._id),
    });

    // Llega el primero de los dos: ese ya no vuelve a la cola.
    const nota = await albaran(mundo.t);
    await authed.mutation(api.purchasing.receive, {
      orderId,
      items: [{ purchaseRequestId: requests[0]._id, quantity: 1 }],
      deliveryNote: nota,
    });

    await expectConvexError(
      authed.mutation(api.purchasing.cancelOrder, { orderId, note: "" }),
      "Escribe por qué se anula la orden",
    );

    const { returned } = await authed.mutation(api.purchasing.cancelOrder, {
      orderId,
      note: "El proveedor ya no sirve ese artículo",
    });
    expect(returned).toBe(1);

    const { requests: reabiertas } = await authed.query(
      api.purchasing.listPurchaseRequests,
      {},
    );
    const porReferencia = new Map(
      reabiertas.map((row) => [row._id, row.status] as const),
    );
    expect(porReferencia.get(requests[0]._id)).toBe("received");
    expect(porReferencia.get(requests[1]._id)).toBe("pending");
    expect((await authed.query(api.purchasing.listOrders, {}))[0].status).toBe(
      "cancelled",
    );
  });
});

describe("recepciones: el albarán y el estado", () => {
  test("sin albarán no hay entrada", async () => {
    const mundo = await taller();
    const part = await seedPart(mundo.t, { supplier: "Electro" });
    const request = await pedir(mundo, [{ sparePartId: part, quantity: 1 }]);
    const authed = mundo.como(mundo.responsable);
    await authed.mutation(api.purchasing.requestPurchase, {
      requestId: request._id,
    });
    const { requests } = await authed.query(
      api.purchasing.listPurchaseRequests,
      {},
    );
    const { orderId } = await authed.mutation(api.purchasing.createOrder, {
      purchaseRequestIds: requests.map((row) => row._id),
    });

    await expectConvexError(
      authed.mutation(api.purchasing.receive, {
        orderId,
        items: [{ purchaseRequestId: requests[0]._id, quantity: 1 }],
        deliveryNote: { ...(await albaran(mundo.t)), name: "  " },
      }),
      "El albarán necesita un nombre",
    );

    // Más de lo pedido tampoco: nadie recibe lo que no se pidió.
    await expectConvexError(
      authed.mutation(api.purchasing.receive, {
        orderId,
        items: [{ purchaseRequestId: requests[0]._id, quantity: 2 }],
        deliveryNote: await albaran(mundo.t),
      }),
      "solo faltan 1 ud por recibir",
    );

    // Y una orden sin recepciones no tiene movimientos.
    expect(await authed.query(api.purchasing.listReceptions, {})).toEqual([]);
  });

  test("lo que llega entra en el almacén, deja su movimiento y cierra la orden", async () => {
    const mundo = await taller();
    const part = await seedPart(mundo.t, { supplier: "Electro" });
    const request = await pedir(mundo, [{ sparePartId: part, quantity: 4 }]);
    const authed = mundo.como(mundo.responsable);
    await authed.mutation(api.purchasing.requestPurchase, {
      requestId: request._id,
    });
    const { requests } = await authed.query(
      api.purchasing.listPurchaseRequests,
      {},
    );
    const { orderId, reference } = await authed.mutation(
      api.purchasing.createOrder,
      {
        purchaseRequestIds: requests.map((row) => row._id),
      },
    );

    // Llega la mitad: la orden queda parcial y la petición sigue esperando.
    const parcial = await authed.mutation(api.purchasing.receive, {
      orderId,
      items: [{ purchaseRequestId: requests[0]._id, quantity: 2 }],
      deliveryNote: await albaran(mundo.t, "albaran-parcial.pdf"),
      note: "El resto, la semana que viene",
    });
    expect(parcial.status).toBe("partial");
    expect(parcial.received).toEqual([
      {
        sparePartId: part,
        code: "ALI-24015",
        name: "Fuente de alimentación",
        quantity: 2,
      },
    ]);
    expect(parcial.materialReceived).toEqual([]);
    expect((await authed.query(api.purchasing.listOrders, {}))[0].status).toBe(
      "partial",
    );
    let pieza = await mundo.t.run((ctx) => ctx.db.get(part));
    expect(pieza?.stock).toBe(2);
    let peticion = await mundo.t.run((ctx) => ctx.db.get(request._id));
    expect(peticion?.status).toBe("pending");

    // Y llega el resto: la orden se cierra sola y la petición pasa a material
    // recibido, que es lo que la desatasca.
    const completa = await authed.mutation(api.purchasing.receive, {
      orderId,
      items: [{ purchaseRequestId: requests[0]._id, quantity: 2 }],
      deliveryNote: await albaran(mundo.t, "albaran-resto.pdf"),
    });
    expect(completa.status).toBe("completed");
    expect(completa.materialReceived).toEqual([request.reference]);
    expect(
      (await authed.query(api.purchasing.listOrders, {}))[0],
    ).toMatchObject({
      status: "completed",
    });
    pieza = await mundo.t.run((ctx) => ctx.db.get(part));
    expect(pieza?.stock).toBe(4);
    peticion = await mundo.t.run((ctx) => ctx.db.get(request._id));
    expect(peticion?.status).toBe("materialReceived");

    // Los movimientos, con su albarán a mano y lo que entró en cada uno.
    const movimientos = await authed.query(api.purchasing.listReceptions, {});
    expect(movimientos).toHaveLength(2);
    expect(movimientos[0]).toMatchObject({
      orderId,
      orderReference: reference,
      supplier: "Electro",
      receivedBy: "Rita Repuestos",
    });
    expect(movimientos[0].deliveryNote.name).toBe("albaran-resto.pdf");
    expect(movimientos[0].deliveryNoteUrl).toContain("http");
    expect(movimientos[1].note).toBe("El resto, la semana que viene");
    expect(movimientos[1].lines).toEqual([
      {
        sparePartId: part,
        code: "ALI-24015",
        name: "Fuente de alimentación",
        quantity: 2,
      },
    ]);

    // No queda nada por recibir: la orden ya está cerrada.
    await expectConvexError(
      authed.mutation(api.purchasing.receive, {
        orderId,
        items: [{ purchaseRequestId: requests[0]._id, quantity: 1 }],
        deliveryNote: await albaran(mundo.t),
      }),
      "ya está completada",
    );
  });

  test("con el material dentro, la petición se aprueba y se entrega", async () => {
    const mundo = await taller();
    const part = await seedPart(mundo.t, { supplier: "Electro" });
    const request = await pedir(mundo, [{ sparePartId: part, quantity: 2 }]);
    const authed = mundo.como(mundo.responsable);
    await authed.mutation(api.purchasing.requestPurchase, {
      requestId: request._id,
    });
    const { requests } = await authed.query(
      api.purchasing.listPurchaseRequests,
      {},
    );
    const { orderId } = await authed.mutation(api.purchasing.createOrder, {
      purchaseRequestIds: requests.map((row) => row._id),
    });
    await authed.mutation(api.purchasing.receive, {
      orderId,
      items: [{ purchaseRequestId: requests[0]._id, quantity: 2 }],
      deliveryNote: await albaran(mundo.t),
    });

    // El almacén tiene 2 y la petición pide 2: ahora sí se puede resolver.
    const ficha = await authed.query(api.purchasing.byRequest, {
      requestId: request._id,
    });
    expect(ficha.requests).toHaveLength(1);
    expect(ficha.orders).toHaveLength(1);
    expect(ficha.receptions).toHaveLength(1);

    await authed.mutation(api.partRequests.approve, { requestId: request._id });
    let peticion = await mundo.t.run((ctx) => ctx.db.get(request._id));
    expect(peticion?.status).toBe("approved");
    expect((await mundo.t.run((ctx) => ctx.db.get(part)))?.stock).toBe(0);

    await authed.mutation(api.partRequests.markIssued, {
      requestId: request._id,
    });
    peticion = await mundo.t.run((ctx) => ctx.db.get(request._id));
    expect(peticion?.status).toBe("issued");
  });
});

describe("permisos y avisos de las compras", () => {
  test("el técnico no compra ni mira las compras", async () => {
    const mundo = await taller();
    const part = await seedPart(mundo.t, { supplier: "Electro" });
    const request = await pedir(mundo, [{ sparePartId: part, quantity: 1 }]);
    const tecnico = mundo.como(mundo.tecnico);

    await expectConvexError(
      tecnico.query(api.purchasing.listPurchaseRequests, {}),
      "No tienes permisos para ver las compras",
    );
    await expectConvexError(
      tecnico.mutation(api.purchasing.requestPurchase, {
        requestId: request._id,
      }),
      "No tienes permisos para generar peticiones de compra",
    );
  });

  test("quien pidió el repuesto recibe el aviso de que ya está", async () => {
    const mundo = await taller();
    const part = await seedPart(mundo.t, { supplier: "Electro" });
    const request = await pedir(mundo, [{ sparePartId: part, quantity: 1 }]);
    const authed = mundo.como(mundo.responsable);
    await authed.mutation(api.purchasing.requestPurchase, {
      requestId: request._id,
    });
    const { requests } = await authed.query(
      api.purchasing.listPurchaseRequests,
      {},
    );
    const { orderId } = await authed.mutation(api.purchasing.createOrder, {
      purchaseRequestIds: requests.map((row) => row._id),
    });
    await authed.mutation(api.purchasing.receive, {
      orderId,
      items: [{ purchaseRequestId: requests[0]._id, quantity: 1 }],
      deliveryNote: await albaran(mundo.t),
    });

    const avisos = await mundo.t.run((ctx) =>
      ctx.db.query("notifications").collect(),
    );
    expect(avisos).toHaveLength(1);
    expect(avisos[0].userId).toBe(mundo.tecnico);
    expect(avisos[0].text).toContain("Material recibido");
    expect(avisos[0].text).toContain(request.reference);
  });
});

/* ------------------------------------------------------------------ */
/* Las cuentas de la pantalla (sin navegador)                          */
/* ------------------------------------------------------------------ */

describe("los pasos que no son legales: la misma máquina en la pantalla y en el servidor", () => {
  /**
   * Una compra pedida y metida en su orden, que es el punto de partida de casi
   * todo lo que sigue. Devuelve las piezas para poder recepcionar o anular.
   */
  async function conOrden(cantidad = 2) {
    const mundo = await taller();
    const part = await seedPart(mundo.t, { supplier: "Electro" });
    const request = await pedir(mundo, [
      { sparePartId: part, quantity: cantidad },
    ]);
    const authed = mundo.como(mundo.responsable);
    await authed.mutation(api.purchasing.requestPurchase, {
      requestId: request._id,
    });
    const { requests } = await authed.query(
      api.purchasing.listPurchaseRequests,
      {},
    );
    const compra = requests[0];
    const { orderId } = await authed.mutation(api.purchasing.createOrder, {
      purchaseRequestIds: [compra._id],
    });
    return { mundo, authed, part, request, compra, orderId };
  }

  test("lo que ya está en una orden no cambia de proveedor ni se retira", async () => {
    const { mundo, authed, compra } = await conOrden();

    // Dejó de estar sin tratar al entrar en la orden: el proveedor es la clave de
    // la orden y la compra ya está en marcha.
    await expectConvexError(
      authed.mutation(api.purchasing.setSupplier, {
        id: compra._id,
        supplier: "Ferretería Norte",
      }),
      "ya está en una orden",
    );
    await expectConvexError(
      authed.mutation(api.purchasing.cancelPurchaseRequest, {
        id: compra._id,
        note: "Ya no hace falta",
      }),
      "ya no está sin tratar",
    );
    // La nota sí: mientras no esté cerrada, la ficha la deja anotar.
    await authed.mutation(api.purchasing.setNote, {
      id: compra._id,
      notes: "Preguntar el plazo",
    });
    expect((await mundo.t.run((ctx) => ctx.db.get(compra._id)))?.notes).toBe(
      "Preguntar el plazo",
    );
  });

  test("de una orden completada no se recepciona, no se anula y no se anotan sus artículos", async () => {
    const { mundo, authed, compra, orderId } = await conOrden();
    await authed.mutation(api.purchasing.receive, {
      orderId,
      items: [{ purchaseRequestId: compra._id, quantity: 2 }],
      deliveryNote: await albaran(mundo.t, "albaran-entero.pdf"),
    });

    await expectConvexError(
      authed.mutation(api.purchasing.receive, {
        orderId,
        items: [{ purchaseRequestId: compra._id, quantity: 1 }],
        deliveryNote: await albaran(mundo.t),
      }),
      "ya está completada",
    );
    await expectConvexError(
      authed.mutation(api.purchasing.cancelOrder, {
        orderId,
        note: "Me he equivocado",
      }),
      "ya está completada",
    );
    await expectConvexError(
      authed.mutation(api.purchasing.setLineNote, {
        orderId,
        purchaseRequestId: compra._id,
        note: "Otra cosa",
      }),
      "está cerrada",
    );
    // Y la petición de compra se cerró sola al llegar su material.
    expect((await mundo.t.run((ctx) => ctx.db.get(compra._id)))?.status).toBe(
      "received",
    );
  });

  test("de una orden anulada no se recepciona nada, y anularla otra vez no es un error", async () => {
    const { mundo, authed, compra, orderId } = await conOrden();
    await authed.mutation(api.purchasing.cancelOrder, {
      orderId,
      note: "El proveedor ya no sirve",
    });

    await expectConvexError(
      authed.mutation(api.purchasing.receive, {
        orderId,
        items: [{ purchaseRequestId: compra._id, quantity: 1 }],
        deliveryNote: await albaran(mundo.t),
      }),
      "está anulada",
    );
    // Volver a anularla devuelve cero: no es un error, ya está anulada.
    const otra = await authed.mutation(api.purchasing.cancelOrder, {
      orderId,
      note: "Otra vez",
    });
    expect(otra.returned).toBe(0);
    // Y la compra volvió a la cola, sin orden: es lo que espera a que se monte
    // otra (o se retire).
    const vuelta = await mundo.t.run((ctx) => ctx.db.get(compra._id));
    expect(vuelta?.status).toBe("pending");
    expect(vuelta?.orderId).toBeUndefined();
  });

  test("de una petición de repuesto ya resuelta no se compra nada", async () => {
    const mundo = await taller();
    const part = await seedPart(mundo.t, { stock: 5 });
    const request = await pedir(mundo, [{ sparePartId: part, quantity: 2 }]);
    const authed = mundo.como(mundo.responsable);

    // Con material en el almacén, la petición se aprueba: ya no espera nada.
    await authed.mutation(api.partRequests.approve, { requestId: request._id });
    await expectConvexError(
      authed.mutation(api.purchasing.requestPurchase, {
        requestId: request._id,
      }),
      "ya está resuelta",
    );
  });
});

describe("las cuentas del módulo de compras", () => {
  const compra = (
    overrides: Partial<{
      _id: string;
      supplier: string;
      status: "pending" | "ordered" | "received" | "cancelled";
      quantity: number;
      createdAt: number;
      requestReference: string;
    }>,
  ) =>
    ({
      _id: overrides._id ?? "pc",
      supplier: overrides.supplier ?? "Proveedor",
      status: overrides.status ?? "pending",
      quantity: overrides.quantity ?? 1,
      createdAt: overrides.createdAt ?? 1,
      requestReference: overrides.requestReference ?? "PET-0001",
      reason: "noStock",
      receivedAt: undefined,
    }) as never;

  test("se agrupa solo lo que está sin tratar, por proveedor y lo más antiguo primero", () => {
    const groups = groupBySupplier([
      compra({ _id: "a", supplier: "Zeta", createdAt: 3 }),
      compra({ _id: "b", supplier: "Alfa", createdAt: 2, quantity: 4 }),
      compra({ _id: "c", supplier: "Alfa", createdAt: 1, quantity: 2 }),
      compra({ _id: "d", supplier: "Alfa", status: "ordered" }),
      compra({ _id: "e", supplier: "Alfa", status: "received" }),
      compra({ _id: "f", supplier: "Alfa", status: "cancelled" }),
    ]);

    expect(groups.map((group) => group.supplier)).toEqual(["Alfa", "Zeta"]);
    expect(groups[0].items.map((item) => item._id)).toEqual(["c", "b"]);
    expect(groups[0].quantity).toBe(6);
    expect(groups[0].requests).toBe(1);
    expect(groupSummary(groups[0])).toBe("1 petición · 2 artículos · 6 ud");
  });

  test("el total de una orden cuenta lo que ha llegado, sin pasarse de lo pedido", () => {
    const order = {
      lines: [
        { quantity: 3, receivedQuantity: 3 },
        { quantity: 2, receivedQuantity: 0 },
      ],
    } as never;
    expect(orderTotals(order)).toMatchObject({
      quantity: 5,
      received: 3,
      pending: 2,
      ratio: 0.6,
    });
    expect(
      orderTotals({ lines: [{ quantity: 1, receivedQuantity: 99 }] } as never),
    ).toMatchObject({ received: 1, pending: 0, ratio: 1 });
    expect(orderTotals({ lines: [] } as never).ratio).toBe(0);
  });

  test("lo que falta se cuenta sin repetir lo que ya está pedido ni lo archivado", () => {
    const part = "part-1" as never;
    const requests = [
      {
        _id: "req-1",
        archivedAt: undefined,
        status: "pending",
        createdAt: 1,
        lines: [{ sparePartId: part, code: "A-1", name: "Uno", quantity: 5 }],
      },
      {
        _id: "req-2",
        archivedAt: undefined,
        status: "pending",
        createdAt: 2,
        lines: [{ sparePartId: part, code: "A-1", name: "Uno", quantity: 5 }],
      },
      {
        _id: "req-3",
        archivedAt: 10,
        status: "pending",
        createdAt: 3,
        lines: [{ sparePartId: part, code: "A-1", name: "Uno", quantity: 1 }],
      },
      {
        _id: "req-4",
        archivedAt: undefined,
        status: "approved",
        createdAt: 4,
        lines: [{ sparePartId: part, code: "A-1", name: "Uno", quantity: 1 }],
      },
    ] as never[];

    // Con stock 0, todas las líneas faltan; solo la que ya tiene una petición de
    // compra viva queda fuera de la lista.
    const sinStock = requestsMissingStock(
      requests,
      [{ _id: part, stock: 0 }] as never[],
      [{ requestId: "req-1", sparePartId: part, status: "ordered" }] as never[],
    );
    expect(sinStock.map((row) => row.request._id)).toEqual(["req-2"]);

    // Y con existencias de sobra no hay nada que comprar.
    expect(
      requestsMissingStock(requests, [{ _id: part, stock: 99 }] as never[], []),
    ).toEqual([]);
  });
});
