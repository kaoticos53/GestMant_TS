import { A4, PdfDocument } from "./pdf";
import { purchaseOrderStatusAfterReceiving } from "./purchaseFlow";
import type { Priority } from "./workshop";

/**
 * La muestra de compras: lo que se carga para poder mirar el módulo con
 * contenido de verdad —peticiones sin tratar de varios proveedores, una orden
 * a medio recibir y otra ya cerrada— sin inventarse nada al vuelo en la
 * pantalla.
 *
 * Aquí solo hay datos y las cuentas que los dejan cuadrados: cuánto se compra
 * de cada línea, cuánto ha entrado en cada recepción y en qué estado queda la
 * orden. Quién escribe las filas es el seed de Convex (`seedPurchasing`), que
 * es el único sitio que conoce los identificadores del catálogo.
 *
 * Las cantidades se reparten en **tanto por uno de lo comprado** y no en
 * unidades fijas a propósito: lo que se compra es «lo que pide el técnico menos
 * lo que hay en el almacén», y eso cambia cada vez que la muestra se vuelve a
 * cargar. Repartiendo por proporción, la orden sigue estando a medias —y la
 * completada sigue estando completa— aunque el almacén tenga otra cosa.
 */

/** Lo que se pide (la línea de la petición de repuesto) y su código. */
export interface SamplePurchaseLine {
  /** Código del repuesto en el catálogo de la muestra. */
  code: string;
  /** Lo que pide el técnico: siempre más de lo que hay, o no habría compra. */
  requested: number;
  /** Nota del responsable sobre este artículo. */
  note?: string;
}

/**
 * Lo que entra en una recepción: `share` es la parte de lo comprado que trae
 * ese albarán (1 = todo lo que faltaba de esa línea).
 */
export interface SampleReception {
  /** Días antes de hoy. */
  daysAgo: number;
  /** Cuál de `SAMPLE_DELIVERY_NOTES` lo respalda. */
  deliveryNote: number;
  items: readonly { code: string; share: number }[];
  note?: string;
}

/** La orden que se manda al proveedor con lo que espera por él. */
export interface SampleOrder {
  /** Las peticiones que comparten clave acaban en la **misma** orden. */
  key: string;
  /** Días antes de hoy en que salió la orden. */
  daysAgo: number;
  /** Código de la solicitud de compra externa. */
  solicitudeCode?: string;
  note?: string;
  receptions?: readonly SampleReception[];
}

/** Una petición de repuesto de la muestra y lo que hay que comprar para ella. */
export interface SamplePurchaseGroup {
  supplier: string;
  /** Días antes de hoy en que se pidió el material. */
  daysAgo: number;
  /** Índice del técnico que firma: la muestra se reparte entre el equipo. */
  technician: number;
  priority: Priority;
  /** Código del equipo afectado, si lo hay. */
  equipment?: string;
  lines: readonly SamplePurchaseLine[];
  /** La orden que la mandó al proveedor. Sin esto se queda sin tratar. */
  order?: SampleOrder;
  /**
   * La petición se queda sin comprar a propósito: es lo que enseña la cola de
   * «Sin material en el almacén» (falta, pero nadie la ha apartado todavía).
   */
  uncovered?: boolean;
}

/** Los albaranes de ejemplo que se guardan como archivo de cada recepción. */
export const SAMPLE_DELIVERY_NOTES: readonly {
  name: string;
  supplier: string;
  code: string;
}[] = [
  {
    name: "Albarán ALB-2026-0412.pdf",
    supplier: "Belden",
    code: "ALB-2026-0412",
  },
  {
    name: "Albarán ALB-2026-0431.pdf",
    supplier: "Belden",
    code: "ALB-2026-0431",
  },
  {
    name: "Albarán ALB-2026-0388.pdf",
    supplier: "Canare",
    code: "ALB-2026-0388",
  },
];

/**
 * La muestra: cinco proveedores esperando a que alguien monte su orden, una
 * orden a la que le falta la mitad, otra que ya entró entera y dos peticiones
 * que aún no ha apartado nadie.
 */
export const SAMPLE_PURCHASES: readonly SamplePurchaseGroup[] = [
  // Sin tratar: lo que espera a que el responsable junte la orden.
  {
    supplier: "Mean Well",
    daysAgo: 9,
    technician: 0,
    priority: "urgent",
    equipment: "EQ-004",
    lines: [
      {
        code: "ALI-24015",
        requested: 10,
        note: "Las dos fuentes del rack de realización van con la tensión alta.",
      },
    ],
  },
  {
    supplier: "ARRI",
    daysAgo: 7,
    technician: 1,
    priority: "normal",
    equipment: "EQ-005",
    lines: [{ code: "ILU-LED60", requested: 6 }],
  },
  {
    supplier: "ebm-papst",
    daysAgo: 5,
    technician: 2,
    priority: "normal",
    equipment: "EQ-006",
    lines: [
      {
        code: "VEN-08012",
        requested: 18,
        note: "El armario del control de cámaras se calienta en los directos.",
      },
    ],
  },
  {
    supplier: "Ross Video",
    daysAgo: 3,
    technician: 0,
    priority: "urgent",
    equipment: "EQ-003",
    lines: [
      {
        code: "VID-CAR04",
        requested: 2,
        note: "Sin repuesto de salida el conmutador se queda en 3G.",
      },
    ],
  },
  {
    supplier: "Neutrik",
    daysAgo: 2,
    technician: 3,
    priority: "low",
    lines: [{ code: "AUD-JACK01", requested: 12 }],
  },
  {
    supplier: "Klotz",
    daysAgo: 11,
    technician: 2,
    priority: "low",
    equipment: "EQ-002",
    lines: [
      {
        code: "AUD-XLR10",
        requested: 34,
        note: "Se gastan en cada montaje de plató: conviene tener fondo.",
      },
    ],
  },
  {
    supplier: "Panduit",
    daysAgo: 4,
    technician: 1,
    priority: "normal",
    equipment: "EQ-013",
    lines: [{ code: "RED-PATCH", requested: 8 }],
  },

  // La orden que va a medias: dos peticiones de cable, una servida a trozos.
  {
    supplier: "Belden",
    daysAgo: 21,
    technician: 1,
    priority: "normal",
    equipment: "EQ-003",
    lines: [{ code: "VID-SDI30", requested: 16 }],
    order: {
      key: "oc-belden",
      daysAgo: 15,
      solicitudeCode: "SC-2026-0184",
      note: "Reparto en dos entregas: el coax de 30 m va por bobina.",
      receptions: [
        {
          daysAgo: 9,
          deliveryNote: 0,
          items: [{ code: "VID-SDI30", share: 1 / 3 }],
          note: "Llega una bobina; el resto, la semana que viene.",
        },
      ],
    },
  },
  {
    supplier: "Belden",
    daysAgo: 19,
    technician: 2,
    priority: "normal",
    equipment: "EQ-006",
    lines: [{ code: "VID-SDI15", requested: 13 }],
    order: {
      key: "oc-belden",
      daysAgo: 15,
      receptions: [
        {
          daysAgo: 3,
          deliveryNote: 1,
          items: [{ code: "VID-SDI15", share: 1 }],
        },
      ],
    },
  },

  // La que ya entró entera.
  {
    supplier: "Canare",
    daysAgo: 34,
    technician: 3,
    priority: "normal",
    equipment: "EQ-004",
    lines: [{ code: "VID-BNC01", requested: 100 }],
    order: {
      key: "oc-canare",
      daysAgo: 26,
      solicitudeCode: "SC-2026-0166",
      receptions: [
        {
          daysAgo: 12,
          deliveryNote: 2,
          items: [{ code: "VID-BNC01", share: 1 }],
          note: "Caja completa, con el precinto del fabricante.",
        },
      ],
    },
  },

  // Pedida al proveedor y todavía sin nada en el muelle.
  {
    supplier: "Sennheiser",
    daysAgo: 6,
    technician: 0,
    priority: "urgent",
    equipment: "EQ-001",
    lines: [{ code: "AUD-CAP02", requested: 12 }],
    order: { key: "oc-sennheiser", daysAgo: 2 },
  },

  // Sin apartar: el almacén no llega y nadie lo ha pedido todavía.
  {
    supplier: "Sony",
    daysAgo: 2,
    technician: 1,
    priority: "urgent",
    equipment: "EQ-001",
    lines: [{ code: "CAM-VF01", requested: 4 }],
    uncovered: true,
  },
  {
    supplier: "Blackmagic",
    daysAgo: 1,
    technician: 2,
    priority: "normal",
    equipment: "EQ-004",
    lines: [{ code: "VID-SPL02", requested: 3 }],
    uncovered: true,
  },
];

/* ------------------------------------------------------------------ */
/* Las cuentas de la muestra                                           */
/* ------------------------------------------------------------------ */

export interface PlannedPurchaseLine {
  code: string;
  /** Lo que pide el técnico en su petición de repuesto. */
  requested: number;
  /** Lo que hay que comprar: lo que el almacén no cubre. */
  quantity: number;
  /** Lo que ya ha entrado de lo comprado. */
  received: number;
  reason: "noStock" | "newPart";
  note?: string;
}

export interface PlannedReception {
  daysAgo: number;
  deliveryNote: number;
  items: { code: string; quantity: number }[];
  note?: string;
}

export interface PlannedOrder {
  key: string;
  supplier: string;
  daysAgo: number;
  solicitudeCode?: string;
  note?: string;
  status: "pending" | "partial" | "completed";
  receptions: PlannedReception[];
  /** Lo que la orden lleva dentro, por código de repuesto. */
  lines: { code: string; quantity: number; received: number }[];
}

export interface PlannedRequest {
  supplier: string;
  daysAgo: number;
  technician: number;
  priority: Priority;
  equipment?: string;
  uncovered: boolean;
  /** Clave de la orden en la que entra, si entra en alguna. */
  orderKey?: string;
  lines: PlannedPurchaseLine[];
}

export interface PlannedSample {
  requests: PlannedRequest[];
  orders: PlannedOrder[];
}

/** Cuántas unidades son `share` de `quantity`, sin salirse de lo comprado. */
function unitsFor(quantity: number, share: number): number {
  if (share <= 0 || quantity <= 0) return 0;
  if (share >= 1) return quantity;
  // Un trozo de una línea nunca la da por completa (si no, no sería parcial) ni
  // deja de ser una entrada real.
  return Math.min(quantity - 1, Math.max(1, Math.round(quantity * share)));
}

/**
 * Deja la muestra cuadrada contra el almacén que hay ahora mismo: lo que se
 * compra de cada línea es lo que pide el técnico menos lo que hay, y lo que ha
 * llegado sale de repartir las recepciones de su orden.
 *
 * `stock` es el almacén por código de repuesto. Se pasa desde fuera porque es
 * el único dato que cambia entre una carga y la siguiente.
 */
export function planPurchasingSample(
  stock: Readonly<Record<string, number>>,
  sample: readonly SamplePurchaseGroup[] = SAMPLE_PURCHASES,
): PlannedSample {
  const requests: PlannedRequest[] = sample.map((group) => ({
    supplier: group.supplier,
    daysAgo: group.daysAgo,
    technician: group.technician,
    priority: group.priority,
    ...(group.equipment ? { equipment: group.equipment } : {}),
    uncovered: group.uncovered === true,
    ...(group.order && group.uncovered !== true
      ? { orderKey: group.order.key }
      : {}),
    lines: group.lines.map((line) => {
      const available = stock[line.code] ?? 0;
      return {
        code: line.code,
        requested: line.requested,
        // Lo que no llega a una unidad no es una compra: siempre queda algo.
        quantity: Math.max(1, line.requested - available),
        received: 0,
        reason: available === 0 ? "newPart" : "noStock",
        ...(line.note ? { note: line.note } : {}),
      };
    }),
  }));

  // Las órdenes se montan con las peticiones que comparten clave, en el orden
  // en que aparecen (lo más antiguo primero).
  const orders: PlannedOrder[] = [];
  const quantityByOrderAndCode = new Map<string, number>();

  for (const [index, group] of sample.entries()) {
    const order = group.order;
    if (!order || group.uncovered === true) continue;
    let planned = orders.find((row) => row.key === order.key);
    if (!planned) {
      planned = {
        key: order.key,
        supplier: group.supplier,
        daysAgo: order.daysAgo,
        ...(order.solicitudeCode
          ? { solicitudeCode: order.solicitudeCode }
          : {}),
        ...(order.note ? { note: order.note } : {}),
        status: "pending",
        receptions: [],
        lines: [],
      };
      orders.push(planned);
    }
    if (planned.supplier !== group.supplier) {
      throw new Error(
        `La muestra de compras mezcla proveedores en la orden ${order.key}: ${planned.supplier} y ${group.supplier}.`,
      );
    }
    for (const line of requests[index].lines) {
      planned.lines.push({
        code: line.code,
        quantity: line.quantity,
        received: 0,
      });
      quantityByOrderAndCode.set(`${order.key}:${line.code}`, line.quantity);
    }
  }

  for (const order of orders) {
    // Las recepciones se reparten entre las peticiones de la orden y se
    // ordenan por fecha: la primera entrada es la más antigua.
    const receptions = sample
      .filter((group) => group.order?.key === order.key)
      .flatMap((group) => group.order?.receptions ?? [])
      .sort((a, b) => b.daysAgo - a.daysAgo);
    // Cuánto se ha repartido ya de cada línea, en tanto por uno.
    const handedOut = new Map<string, number>();
    for (const reception of receptions) {
      const items: { code: string; quantity: number }[] = [];
      for (const item of reception.items) {
        const quantity = quantityByOrderAndCode.get(
          `${order.key}:${item.code}`,
        );
        if (quantity === undefined) {
          throw new Error(
            `La muestra recepciona ${item.code} en la orden ${order.key}, donde no se pidió.`,
          );
        }
        const before = handedOut.get(item.code) ?? 0;
        const after = Math.min(1, before + item.share);
        const units = unitsFor(quantity, after) - unitsFor(quantity, before);
        handedOut.set(item.code, after);
        if (units > 0) items.push({ code: item.code, quantity: units });
      }
      if (items.length === 0) continue;
      order.receptions.push({
        daysAgo: reception.daysAgo,
        deliveryNote: reception.deliveryNote,
        items,
        ...(reception.note ? { note: reception.note } : {}),
      });
      for (const item of items) {
        const line = order.lines.find((row) => row.code === item.code);
        if (line) line.received += item.quantity;
      }
    }

    // El estado sale de la máquina de la orden, la misma que consulta el
    // servidor al recepcionar: aquí no hay una segunda forma de contarlo.
    order.status =
      order.receptions.length === 0
        ? "pending"
        : purchaseOrderStatusAfterReceiving(
              order.lines.map((line) => ({
                quantity: line.quantity,
                receivedQuantity: line.received,
              })),
            ) === "completed"
          ? "completed"
          : "partial";
  }

  // Y cada línea sabe lo que ha llegado por su orden, para que el estado de la
  // petición de compra salga de lo mismo que enseña la orden.
  for (const request of requests) {
    if (!request.orderKey) continue;
    const order = orders.find((row) => row.key === request.orderKey);
    if (!order) continue;
    for (const line of request.lines) {
      const ordered = order.lines.find((row) => row.code === line.code);
      if (ordered) line.received = ordered.received;
    }
  }

  return { requests, orders };
}

/* ------------------------------------------------------------------ */
/* El albarán de ejemplo                                               */
/* ------------------------------------------------------------------ */

/**
 * El PDF de un albarán de la muestra: una hoja con el proveedor, el número y el
 * aviso de que es un documento de ejemplo. Se compone con el maquetador del
 * taller (`lib/pdf`), que no toca el navegador, así que vale igual para el seed
 * que para cualquier otra parte del código.
 */
export function sampleDeliveryNotePdf(
  note: (typeof SAMPLE_DELIVERY_NOTES)[number],
): Uint8Array<ArrayBuffer> {
  const doc = new PdfDocument(A4);
  const page = doc.addPage();
  const margin = 56;

  page.rect(0, 0, A4.width, 6, { color: [0.09, 0.4, 0.62] });
  page.text("Albarán de entrega · ejemplo", margin, 58, {
    font: "bold",
    size: 9,
    color: [0.35, 0.4, 0.45],
  });
  page.text(note.code, margin, 92, { font: "bold", size: 19 });
  page.line(margin, 112, A4.width - margin, 112, { color: [0.8, 0.82, 0.85] });

  const rows: [string, string][] = [
    ["Proveedor", note.supplier],
    ["Albarán", note.code],
    ["Archivo", note.name],
    ["Documento", "Copia de ejemplo para la recepción de compras"],
  ];
  let y = 144;
  for (const [label, value] of rows) {
    page.text(label, margin, y, { font: "bold", size: 10 });
    page.text(value, margin + 118, y, { size: 10 });
    y += 22;
  }

  page.text(
    "Este albarán acompaña a una recepción de la muestra: el material que",
    margin,
    y + 30,
    { size: 10, color: [0.3, 0.33, 0.36] },
  );
  page.text(
    "entra en el almacén, no una entrega real al taller.",
    margin,
    y + 46,
    { size: 10, color: [0.3, 0.33, 0.36] },
  );

  // `slice()` deja los bytes en memoria propia: es lo que el `Blob` que los
  // guarda admite, y de paso el archivo no comparte memoria con el maquetador.
  return doc.toBytes().slice();
}
