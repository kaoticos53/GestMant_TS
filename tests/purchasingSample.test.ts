import { backend } from "./backend";
import { ConvexError } from "convex/values";
import { describe, expect, test } from "vitest";
import { internal } from "../src/convex/_generated/api";
import type { Id } from "../src/convex/_generated/dataModel";
import {
  SAMPLE_DELIVERY_NOTES,
  SAMPLE_PURCHASES,
  planPurchasingSample,
  sampleDeliveryNotePdf,
} from "../src/lib/samplePurchasing";

/** Todos los códigos de repuesto que la muestra toca. */
const CODES = [
  ...new Set(
    SAMPLE_PURCHASES.flatMap((group) => group.lines.map((line) => line.code)),
  ),
];

describe("la muestra de compras: las cuentas", () => {
  const stock = Object.fromEntries(CODES.map((code) => [code, 4]));

  test("se compra lo que el almacén no cubre, y siempre algo", () => {
    const plan = planPurchasingSample(stock);
    const linea = (code: string) =>
      plan.requests
        .flatMap((row) => row.lines)
        .find((row) => row.code === code);

    // 10 pedidas y 4 en el almacén: se compran 6.
    expect(linea("ALI-24015")).toMatchObject({
      quantity: 6,
      reason: "noStock",
    });
    // Sin existencias: el motivo es «repuesto nuevo», no «agotado».
    expect(linea("VID-CAR04")?.reason).toBe("noStock");
    // Ni las líneas imposibles se quedan sin compra.
    const vacio = planPurchasingSample({ ...stock, "VID-CAR04": 0 });
    expect(
      vacio.requests
        .flatMap((row) => row.lines)
        .find((row) => row.code === "VID-CAR04"),
    ).toMatchObject({ quantity: 2, reason: "newPart" });

    const conTodo = planPurchasingSample({ ...stock, "VID-SDI15": 99 });
    expect(
      conTodo.requests
        .flatMap((row) => row.lines)
        .find((row) => row.code === "VID-SDI15")?.quantity,
    ).toBe(1);
  });

  test("cinco proveedores esperan orden y dos peticiones no se han apartado", () => {
    const plan = planPurchasingSample(stock);
    const sinTratar = plan.requests.filter(
      (row) => !row.orderKey && !row.uncovered,
    );
    expect(
      new Set(sinTratar.map((row) => row.supplier)).size,
    ).toBeGreaterThanOrEqual(5);
    expect(plan.requests.filter((row) => row.uncovered)).toHaveLength(2);
  });

  test("la orden a medias sigue a medias y la completada está entera", () => {
    const plan = planPurchasingSample(stock);
    const parcial = plan.orders.find((row) => row.key === "oc-belden");
    const completa = plan.orders.find((row) => row.key === "oc-canare");
    const pendiente = plan.orders.find((row) => row.key === "oc-sennheiser");

    expect(parcial?.status).toBe("partial");
    expect(parcial?.receptions).toHaveLength(2);
    // Una de sus líneas ya entró entera; la otra, solo un trozo.
    const sdi15 = parcial?.lines.find((row) => row.code === "VID-SDI15");
    expect(sdi15?.received).toBe(sdi15?.quantity);
    const sdi30 = parcial?.lines.find((row) => row.code === "VID-SDI30");
    expect(sdi30?.received).toBeGreaterThan(0);
    expect(sdi30?.received).toBeLessThan(sdi30?.quantity ?? 0);

    expect(completa?.status).toBe("completed");
    for (const line of completa?.lines ?? []) {
      expect(line.received).toBe(line.quantity);
    }

    expect(pendiente?.status).toBe("pending");
    expect(pendiente?.receptions).toHaveLength(0);
  });

  test("lo recibido nunca pasa de lo comprado, aunque el almacén cambie", () => {
    for (const stockInicial of [0, 1, 7, 40]) {
      const plan = planPurchasingSample(
        Object.fromEntries(CODES.map((code) => [code, stockInicial])),
      );
      for (const order of plan.orders) {
        for (const line of order.lines) {
          expect(line.received).toBeGreaterThanOrEqual(0);
          expect(line.received).toBeLessThanOrEqual(line.quantity);
        }
        const entrada = order.receptions.reduce(
          (sum, reception) =>
            sum + reception.items.reduce((n, item) => n + item.quantity, 0),
          0,
        );
        expect(entrada).toBe(
          order.lines.reduce((sum, line) => sum + line.received, 0),
        );
      }
    }
  });

  test("una orden es de un solo proveedor", () => {
    const plan = planPurchasingSample(stock);
    for (const order of plan.orders) {
      const proveedores = new Set(
        plan.requests
          .filter((row) => row.orderKey === order.key)
          .map((row) => row.supplier),
      );
      expect(proveedores).toEqual(new Set([order.supplier]));
    }
  });

  test("el albarán de ejemplo es un PDF de verdad", () => {
    const bytes = sampleDeliveryNotePdf(SAMPLE_DELIVERY_NOTES[0]);
    const cabecera = String.fromCharCode(...bytes.slice(0, 5));
    expect(cabecera).toBe("%PDF-");
    // Dos albaranes distintos no pueden ser el mismo archivo.
    const otro = sampleDeliveryNotePdf(SAMPLE_DELIVERY_NOTES[1]);
    expect([...bytes]).not.toEqual([...otro]);
  });
});

/* ------------------------------------------------------------------ */
/* La carga en el backend                                              */
/* ------------------------------------------------------------------ */

async function tallerVacio() {
  const t = backend();
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
  const parts: Record<string, Id<"spareParts">> = {};
  for (const code of CODES) {
    parts[code] = await t.run((ctx) =>
      ctx.db.insert("spareParts", {
        code,
        name: `Repuesto ${code}`,
        category: "Electrónica",
        unit: "ud",
        stock: 4,
        minStock: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }),
    );
  }
  const albaranes = await t.run(async (ctx) => {
    const rows = [];
    for (const note of SAMPLE_DELIVERY_NOTES) {
      const storageId = await ctx.storage.store(
        new Blob([sampleDeliveryNotePdf(note)], { type: "application/pdf" }),
      );
      rows.push({ storageId, name: note.name, kind: "document" as const });
    }
    return rows;
  });
  return { t, responsable, tecnico, parts, albaranes };
}

describe("la muestra de compras: lo que se escribe", () => {
  test("deja peticiones sin tratar, una orden parcial y otra completa", async () => {
    const { t, responsable, albaranes, parts } = await tallerVacio();
    const result = await t.mutation(internal.seedPurchasing.recordSample, {
      userId: responsable,
      albaranes,
    });
    expect(result.purchases).toBeGreaterThan(10);
    expect(result.orders).toBe(3);
    expect(result.receptions).toBe(3);

    const compras = await t.run((ctx) =>
      ctx.db.query("purchaseRequests").collect(),
    );
    const sinTratar = compras.filter((row) => row.status === "pending");
    expect(
      new Set(sinTratar.map((row) => row.supplier)).size,
    ).toBeGreaterThanOrEqual(5);
    expect(compras.some((row) => row.status === "received")).toBe(true);
    expect(compras.some((row) => row.status === "ordered")).toBe(true);

    const ordenes = await t.run((ctx) =>
      ctx.db.query("purchaseOrders").collect(),
    );
    const porProveedor = (supplier: string) =>
      ordenes.find((row) => row.supplier === supplier);
    expect(porProveedor("Belden")?.status).toBe("partial");
    expect(porProveedor("Canare")?.status).toBe("completed");
    expect(porProveedor("Canare")?.completedAt).toBeTypeOf("number");
    expect(porProveedor("Sennheiser")?.status).toBe("pending");
    for (const order of ordenes) {
      expect(order.status).not.toBe("cancelled");
      // La orden lleva dentro sus peticiones de compra, con el número de la
      // petición de repuesto de la que salieron.
      for (const line of order.lines) {
        const row = compras.find((item) => item._id === line.purchaseRequestId);
        expect(row?.orderId).toBe(order._id);
        expect(line.requestReference).toBe(row?.requestReference);
      }
    }

    const recepciones = await t.run((ctx) =>
      ctx.db.query("receptions").collect(),
    );
    expect(recepciones).toHaveLength(3);
    for (const reception of recepciones) {
      expect(reception.deliveryNote.name).toMatch(/^Albarán ALB-/);
      expect(reception.receivedBy).toBe("Rita Repuestos");
      expect(reception.lines.length).toBeGreaterThan(0);
    }

    // El material que entra suma en el almacén: la caja de BNC del albarán de
    // Canare está dentro.
    const bnc = await t.run((ctx) => ctx.db.get(parts["VID-BNC01"]));
    expect(bnc?.stock).toBeGreaterThan(4);

    // Y las peticiones de repuesto cuyo material llegó entero ya se pueden
    // entregar; las demás siguen esperando.
    const peticiones = await t.run((ctx) =>
      ctx.db.query("partRequests").collect(),
    );
    expect(
      peticiones.filter((row) => row.status === "materialReceived").length,
    ).toBeGreaterThanOrEqual(2);
    expect(peticiones.some((row) => row.status === "pending")).toBe(true);
  });

  test("se puede cargar dos veces sin que las cuentas se crucen", async () => {
    const { t, responsable, albaranes } = await tallerVacio();
    await t.mutation(internal.seedPurchasing.recordSample, {
      userId: responsable,
      albaranes,
    });
    const segunda = await t.mutation(internal.seedPurchasing.recordSample, {
      userId: responsable,
      albaranes,
    });
    expect(segunda.purchases).toBeGreaterThan(10);

    const ordenes = await t.run((ctx) =>
      ctx.db.query("purchaseOrders").collect(),
    );
    // Las órdenes de la primera carga siguen siendo válidas: ninguna acumula
    // más material del que se pidió.
    for (const order of ordenes) {
      for (const line of order.lines) {
        expect(line.receivedQuantity).toBeLessThanOrEqual(line.quantity);
      }
    }
    // Y las nuevas siguen dejando una a medias.
    expect(ordenes.filter((row) => row.status === "partial").length).toBe(2);
    expect(ordenes.filter((row) => row.status === "completed").length).toBe(2);
  });

  test("sin el catálogo de la muestra se dice qué falta", async () => {
    const t = backend();
    const responsable = await t.run((ctx) =>
      ctx.db.insert("users", {
        name: "Rita Repuestos",
        email: "responsable@taller.es",
        role: "manager",
      }),
    );
    const albaranes = await t.run(async (ctx) => [
      {
        storageId: await ctx.storage.store(new Blob(["albarán"])),
        name: "Albarán.pdf",
        kind: "document" as const,
      },
    ]);
    const error = await t
      .mutation(internal.seedPurchasing.recordSample, {
        userId: responsable,
        albaranes,
      })
      .then(
        () => null,
        (err: unknown) => err,
      );
    expect(error).not.toBeNull();
    expect(String(error instanceof ConvexError ? error.data : error)).toContain(
      "Faltan repuestos de la muestra",
    );
  });

  test("sin permiso de compras no se carga nada", async () => {
    const { t, tecnico, albaranes } = await tallerVacio();
    const error = await t
      .mutation(internal.seedPurchasing.recordSample, {
        userId: tecnico,
        albaranes,
      })
      .then(
        () => null,
        (err: unknown) => err,
      );
    expect(error).not.toBeNull();
    expect(String(error instanceof ConvexError ? error.data : error)).toContain(
      "permisos",
    );
    const compras = await t.run((ctx) =>
      ctx.db.query("purchaseRequests").collect(),
    );
    expect(compras).toHaveLength(0);
  });
});
