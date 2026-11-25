// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import type { Id } from "@/convex/_generated/dataModel";
import { requestDelivery } from "@/lib/requestFlow";

const { STATE } = vi.hoisted(() => ({
  STATE: {
    decisions: [] as unknown[],
    purchasing: { requests: [], orders: [], receptions: [] } as unknown,
  },
}));

vi.mock("@/convex/_generated/api", () => ({
  api: {
    partRequests: { decisions: { name: "partRequests.decisions" } },
    purchasing: { byRequest: { name: "purchasing.byRequest" } },
  },
}));

vi.mock("convex/react", async () => {
  const { api } = await import("@/convex/_generated/api");
  return {
    useQuery: (query: unknown) => {
      if (query === api.partRequests.decisions) return STATE.decisions;
      if (query === api.purchasing.byRequest) return STATE.purchasing;
      return undefined;
    },
  };
});

import { DeliveryTrail } from "@/pages/dashboard/requests/components/DeliveryTrail";
import { RequestInfoCard } from "@/pages/dashboard/requests/components/detail/RequestInfoCard";
import { RequestLinesCard } from "@/pages/dashboard/requests/components/detail/RequestLinesCard";

describe("Constancia de devoluciones en la ficha de petición", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeAll(() => {
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
  });

  beforeEach(() => {
    STATE.decisions = [];
    STATE.purchasing = { requests: [], orders: [], receptions: [] };
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("muestra devolución parcial en cabecera, desglose por línea y cronología con destino y motivo", () => {
    const now = Date.parse("2026-11-25T12:00:00.000Z");
    const lines = [
      {
        sparePartId: "part-1" as Id<"spareParts">,
        code: "SEN-01",
        name: "Sensor inductivo",
        quantity: 4,
        deliveredQuantity: 1,
        returnedQuantity: 2,
        deliveredAt: now - 3600_000,
        returnedAt: now,
      },
      {
        sparePartId: "part-2" as Id<"spareParts">,
        code: "REL-02",
        name: "Relé 24V",
        quantity: 1,
        deliveredQuantity: 0,
        returnedQuantity: 1,
        deliveredAt: now - 3600_000,
        returnedAt: now,
      },
    ];
    const delivery = requestDelivery(lines, "approved");

    STATE.decisions = [
      {
        _id: "dec-1",
        _creationTime: now - 3600_000,
        at: now - 3600_000,
        by: "Ana Almacén",
        decision: {
          reason: "materialPartiallyDelivered",
          note: "3 × SEN-01 Sensor inductivo · 1 × REL-02 Relé 24V",
        },
      },
      {
        _id: "dec-2",
        _creationTime: now,
        at: now,
        by: "Ana Almacén",
        decision: {
          reason: "materialPartiallyReturned",
          note: "2 × SEN-01 Sensor inductivo (almacén) · 1 × REL-02 Relé 24V (merma/dañada) — Motivo: Sobrante y relé dañado",
        },
      },
    ];

    act(() => {
      root.render(
        <div>
          <RequestInfoCard
            requesterName="Luis"
            createdAt={now - 7200_000}
            status="approved"
            returnedAt={now}
            delivery={delivery}
            lastDeliveredAt={now - 3600_000}
          />
          <RequestLinesCard
            enrichedLines={lines.map((l) => ({
              ...l,
              remainingQuantity: l.quantity - (l.deliveredQuantity ?? 0),
              hasShortage: false,
            }))}
            noReference={false}
            canManage={true}
            canEdit={false}
            showStock={false}
          />
          <DeliveryTrail requestId={"req-1" as Id<"partRequests">} />
        </div>,
      );
    });

    const text = container.textContent ?? "";
    expect(text).toContain("Devolución");
    expect(text).toContain("Parcial (3 de 5 ud)");
    expect(text).toContain("devuelto ×2");
    expect(text).toContain("devuelto ×1");
    expect(text).toContain("Entregas y devoluciones");
    expect(text).toContain("Material devuelto en parte");
    expect(text).toContain("Sobrante y relé dañado");
    expect(text).toContain("merma/dañada");
  });

  it("muestra devolución total en RequestInfoCard y DeliveryTrail", () => {
    const now = Date.parse("2026-11-25T15:00:00.000Z");
    const lines = [
      {
        sparePartId: "part-1" as Id<"spareParts">,
        code: "SEN-01",
        name: "Sensor inductivo",
        quantity: 2,
        deliveredQuantity: 0,
        returnedQuantity: 2,
        returnedAt: now,
      },
    ];
    const delivery = requestDelivery(lines, "returned");

    STATE.decisions = [
      {
        _id: "dec-ret",
        _creationTime: now,
        at: now,
        by: "Ana Almacén",
        decision: {
          reason: "materialReturned",
          note: "2 × SEN-01 Sensor inductivo (almacén) — Motivo: Avería cancelada",
        },
      },
    ];

    act(() => {
      root.render(
        <div>
          <RequestInfoCard
            requesterName="Luis"
            createdAt={now - 7200_000}
            status="returned"
            returnedAt={now}
            delivery={delivery}
            lastDeliveredAt={null}
          />
          <DeliveryTrail requestId={"req-2" as Id<"partRequests">} />
        </div>,
      );
    });

    const text = container.textContent ?? "";
    expect(text).toContain("Total (2 ud)");
    expect(text).toContain("Devoluciones del material");
    expect(text).toContain("Material devuelto");
    expect(text).toContain("Avería cancelada");
  });
});
