// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest";

const { RECEIVED_CALLS, REMOVED_CALLS, UPLOAD_URL_CALLS } = vi.hoisted(() => ({
  RECEIVED_CALLS: [] as unknown[],
  REMOVED_CALLS: [] as unknown[],
  UPLOAD_URL_CALLS: [] as number[],
}));

vi.mock("@/convex/_generated/api", () => ({
  api: {
    purchasing: {
      receive: { nombre: "purchasing.receive" },
      generateUploadUrl: { nombre: "purchasing.generateUploadUrl" },
      reverseReception: { nombre: "purchasing.reverseReception" },
      removeReceptionDeliveryNote: {
        nombre: "purchasing.removeReceptionDeliveryNote",
      },
    },
  },
}));

vi.mock("convex/react", async () => {
  const { api } = await import("@/convex/_generated/api");
  return {
    useMutation: (mutation: unknown) => async (args: unknown) => {
      if (mutation === api.purchasing.receive) {
        RECEIVED_CALLS.push(args);
        return {
          status: "completed",
          received: [],
          materialReceived: [],
        };
      }
      if (mutation === api.purchasing.generateUploadUrl) {
        UPLOAD_URL_CALLS.push(1);
        return "https://upload.example/signed";
      }
      if (mutation === api.purchasing.removeReceptionDeliveryNote) {
        REMOVED_CALLS.push(args);
        return { removed: true };
      }
      return undefined;
    },
  };
});

import type { Id } from "@/convex/_generated/dataModel";
import type { PurchaseOrderDoc } from "@/lib/purchasing";
import type { ReceptionDoc } from "@/pages/dashboard/purchasing/types";
import { ReceiveDialog } from "@/pages/dashboard/purchasing/dialogs/ReceiveDialog";
import { OrderReceptionsList } from "@/pages/dashboard/purchasing/dialogs/orderSheet/components/OrderReceptionsList";
import { MovementsSection } from "@/pages/dashboard/purchasing/components/MovementsSection";

function installDomApis() {
  if (!("ResizeObserver" in window)) {
    (window as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
  const proto = Element.prototype as unknown as Record<string, unknown>;
  proto.hasPointerCapture ??= () => false;
  proto.setPointerCapture ??= () => {};
  proto.releasePointerCapture ??= () => {};
  proto.scrollIntoView ??= () => {};
}

let container: HTMLDivElement;
let root: Root;

beforeAll(() => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
});

beforeEach(() => {
  installDomApis();
  RECEIVED_CALLS.length = 0;
  REMOVED_CALLS.length = 0;
  UPLOAD_URL_CALLS.length = 0;
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  document.body.innerHTML = "";
});

function findButton(label: string): HTMLButtonElement {
  const match = Array.from(document.querySelectorAll("button")).find((btn) =>
    btn.textContent?.includes(label),
  );
  if (!match) {
    throw new Error(`No se encontró el botón "${label}"`);
  }
  return match;
}

const sampleOrder: PurchaseOrderDoc = {
  _id: "order-1" as Id<"purchaseOrders">,
  _creationTime: 1,
  reference: "OC-0001",
  supplier: "Electro Suministros",
  status: "ordered",
  orderedAt: Date.parse("2026-10-03T09:00:00.000Z"),
  orderedBy: "Rita Repuestos",
  lines: [
    {
      purchaseRequestId: "pc-0001" as Id<"purchaseRequests">,
      requestId: "req-1" as Id<"partRequests">,
      requestReference: "PET-0007",
      requestDate: 1,
      sparePartId: "part-1" as Id<"spareParts">,
      code: "ALI-24015",
      name: "Fuente de alimentación",
      unit: "ud",
      quantity: 3,
      receivedQuantity: 0,
    },
  ],
  createdAt: 1,
  updatedAt: 1,
};

const sampleReceptions: ReceptionDoc[] = [
  {
    _id: "rec-con-albaran" as Id<"receptions">,
    _creationTime: 2,
    orderId: "order-1" as Id<"purchaseOrders">,
    orderReference: "OC-0001",
    supplier: "Electro Suministros",
    lines: [
      {
        sparePartId: "part-1" as Id<"spareParts">,
        code: "ALI-24015",
        name: "Fuente de alimentación",
        quantity: 2,
      },
    ],
    deliveryNote: {
      storageId: "st-1" as Id<"_storage">,
      name: "albaran-erroneo.pdf",
      kind: "document",
    },
    deliveryNoteUrl: "https://ejemplo.test/albaran-erroneo.pdf",
    receivedBy: "Rita Repuestos",
    receivedAt: Date.parse("2026-10-04T09:00:00.000Z"),
  },
  {
    _id: "rec-sin-albaran" as Id<"receptions">,
    _creationTime: 1,
    orderId: "order-1" as Id<"purchaseOrders">,
    orderReference: "OC-0001",
    supplier: "Electro Suministros",
    lines: [
      {
        sparePartId: "part-1" as Id<"spareParts">,
        code: "ALI-24015",
        name: "Fuente de alimentación",
        quantity: 1,
      },
    ],
    deliveryNoteUrl: null,
    receivedBy: "Rita Repuestos",
    receivedAt: Date.parse("2026-10-03T12:00:00.000Z"),
  },
];

describe("albarán opcional y eliminación de adjunto en compras", () => {
  test("ReceiveDialog permite recepcionar sin adjuntar albarán y quitar un archivo seleccionado", async () => {
    const onOpenChange = vi.fn();
    act(() => {
      root.render(
        <ReceiveDialog
          open
          onOpenChange={onOpenChange}
          order={sampleOrder}
        />,
      );
    });

    expect(document.body.textContent).toContain("Albarán de entrega (opcional)");
    const submitBtn = findButton("Dar entrada");
    expect(submitBtn.disabled).toBe(false);

    // Seleccionar archivo y luego quitarlo antes de enviar.
    const fileInput = document.querySelector("#albaran") as HTMLInputElement;
    const file = new File(["pdf"], "mi-albaran.pdf", {
      type: "application/pdf",
    });
    const fakeFileList = {
      0: file,
      length: 1,
      item: (index: number) => (index === 0 ? file : null),
    } as unknown as FileList;
    Object.defineProperty(fileInput, "files", {
      value: fakeFileList,
      configurable: true,
    });
    act(() => {
      fileInput.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(document.body.textContent).toContain("mi-albaran.pdf");

    const clearBtn = document.querySelector(
      'button[aria-label="Quitar albarán adjunto"]',
    ) as HTMLButtonElement;
    expect(clearBtn).not.toBeNull();
    act(() => {
      clearBtn.click();
    });
    expect(document.body.textContent).not.toContain("mi-albaran.pdf");

    await act(async () => {
      findButton("Dar entrada").click();
    });

    expect(UPLOAD_URL_CALLS).toHaveLength(0);
    expect(RECEIVED_CALLS).toHaveLength(1);
    expect(RECEIVED_CALLS[0]).toEqual({
      orderId: "order-1",
      items: [{ purchaseRequestId: "pc-0001", quantity: 3 }],
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  test("OrderReceptionsList muestra estado sin albarán y permite eliminar un adjunto", async () => {
    act(() => {
      root.render(
        <OrderReceptionsList receptions={sampleReceptions} canManage />,
      );
    });

    expect(document.body.textContent).toContain("albaran-erroneo.pdf");
    expect(document.body.textContent).toContain("Sin albarán adjunto");

    const removeBtn = document.querySelector(
      'button[aria-label="Eliminar albarán albaran-erroneo.pdf"]',
    ) as HTMLButtonElement;
    expect(removeBtn).not.toBeNull();
    act(() => {
      removeBtn.click();
    });

    expect(document.body.textContent).toContain(
      "¿Eliminar el albarán «albaran-erroneo.pdf»?",
    );
    await act(async () => {
      findButton("Eliminar adjunto").click();
    });
    // El diálogo de confirmación también tiene un botón "Eliminar adjunto" en AlertDialogAction.
    const allConfirmButtons = Array.from(
      document.querySelectorAll("button"),
    ).filter((btn) => btn.textContent?.trim() === "Eliminar adjunto");
    if (REMOVED_CALLS.length === 0 && allConfirmButtons.length > 0) {
      await act(async () => {
        allConfirmButtons[allConfirmButtons.length - 1]?.click();
      });
    }

    expect(REMOVED_CALLS).toEqual([{ receptionId: "rec-con-albaran" }]);
  });

  test("OrderReceptionsList oculta el botón de eliminar cuando canManage es false", () => {
    act(() => {
      root.render(
        <OrderReceptionsList
          receptions={[sampleReceptions[0]]}
          canManage={false}
        />,
      );
    });

    expect(
      document.querySelector(
        'button[aria-label="Eliminar albarán albaran-erroneo.pdf"]',
      ),
    ).toBeNull();
  });

  test("MovementsSection tolera recepciones sin albarán y permite eliminar adjuntos", async () => {
    act(() => {
      root.render(
        <MovementsSection receptions={sampleReceptions} canManage />,
      );
    });

    expect(document.body.textContent).toContain("albaran-erroneo.pdf");
    expect(document.body.textContent).toContain("Sin albarán adjunto");

    // Filtrar por texto cuando hay recepciones sin deliveryNote no lanza error.
    const searchInput = document.querySelector(
      'input[aria-label="Buscar movimientos"]',
    ) as HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )?.set;
    act(() => {
      setter?.call(searchInput, "erroneo");
      searchInput.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(document.body.textContent).toContain("albaran-erroneo.pdf");
    expect(document.body.textContent).not.toContain("Sin albarán adjunto");

    const removeBtn = document.querySelector(
      'button[aria-label="Eliminar albarán albaran-erroneo.pdf"]',
    ) as HTMLButtonElement;
    act(() => {
      removeBtn.click();
    });

    const confirmBtns = Array.from(
      document.querySelectorAll("button"),
    ).filter((btn) => btn.textContent?.trim() === "Eliminar adjunto");
    await act(async () => {
      confirmBtns[confirmBtns.length - 1]?.click();
    });

    expect(REMOVED_CALLS).toEqual([{ receptionId: "rec-con-albaran" }]);
  });
});
