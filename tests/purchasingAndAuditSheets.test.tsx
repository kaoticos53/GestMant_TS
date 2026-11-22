// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { settle } from "./settle";

vi.mock("convex/react", () => ({
  // La tarjeta de la orden monta la sección de correos compartidos: aquí no
  // hay copias ni sesión de Convex que consultar.
  useQuery: () => undefined,
  useMutation: () => async () => undefined,
  useAction: () => async () => undefined,
}));

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

import { AbilityProvider } from "@casl/react";
import { defineAbilityFor } from "@/lib/abilities";
import { DEFAULT_GRANTS } from "@/lib/permissions";
import { SecurityEventDetailSheet } from "@/pages/dashboard/audit/components/SecurityEventDetailSheet";
import { PurchaseOrderCard } from "@/pages/dashboard/purchasing/components/orders/PurchaseOrderCard";
import type { PurchaseOrderDoc } from "@/lib/purchasing";

const SAMPLE_ORDER: PurchaseOrderDoc = {
  _id: "po_1" as never,
  _creationTime: 1,
  reference: "OC-2026-014",
  supplier: "Suministros Norte",
  status: "pending",
  requestRefs: [],
  lines: [
    {
      code: "REP-001",
      name: "Rodamiento 6204",
      quantity: 4,
      received: 0,
      unit: "ud",
    },
  ],
  createdAt: Date.now(),
  updatedAt: Date.now(),
} as PurchaseOrderDoc;

describe("Compras y Auditoría — Paneles laterales (Fase 4)", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("abre OrderSheet al pulsar el código del pedido en PurchaseOrderCard", async () => {
    const onOpenOrder = vi.fn();

    const ability = defineAbilityFor({
      role: "admin",
      grants: DEFAULT_GRANTS.admin,
    });
    await act(async () => {
      root.render(
        <AbilityProvider value={ability}>
          <PurchaseOrderCard
            order={SAMPLE_ORDER}
            onOpenOrder={onOpenOrder}
            onReceiveOrder={vi.fn()}
            onCancelOrder={vi.fn()}
          />
        </AbilityProvider>,
      );
      await settle();
    });

    const titleBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("OC-2026-014"),
    );
    expect(titleBtn).toBeDefined();
    await act(async () => {
      titleBtn?.click();
      await settle();
    });
    expect(onOpenOrder).toHaveBeenCalledWith(SAMPLE_ORDER);
  });

  it("muestra el payload JSON de seguridad en SecurityEventDetailSheet", async () => {
    await act(async () => {
      root.render(
        <SecurityEventDetailSheet
          entry={{
            _id: "sec_1" as never,
            _creationTime: 1,
            action: "role_changed",
            target: "user:u_1",
            actorEmail: "admin@taller.es",
            at: Date.now(),
            metadata: JSON.stringify({
              from: "technician",
              to: "manager",
            }),
          }}
          onClose={vi.fn()}
        />,
      );
      await settle();
    });

    const text = document.body.textContent ?? "";
    expect(text).toContain("admin@taller.es");
    expect(text).toContain("user:u_1");
    expect(text).toContain('"to": "manager"');
  });
});
