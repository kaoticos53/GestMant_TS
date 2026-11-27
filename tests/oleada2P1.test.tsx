// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router";
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
import { settle } from "./settle";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const { MOCK_QUERY, MOCK_MUTATION, MOCK_ACTION } = vi.hoisted(() => ({
  MOCK_QUERY: vi.fn(),
  MOCK_MUTATION: vi.fn(() => vi.fn()),
  MOCK_ACTION: vi.fn(() => vi.fn()),
}));

vi.mock("convex/react", () => ({
  useQuery: MOCK_QUERY,
  useMutation: MOCK_MUTATION,
  useAction: MOCK_ACTION,
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

vi.mock("@/lib/export", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/export")>();
  return {
    ...actual,
    downloadCsv: vi.fn(),
  };
});

import {
  ANALYTICS_LENS_STORAGE_KEY,
  readStoredAnalyticsLens,
  writeStoredAnalyticsLens,
} from "@/lib/analytics";
import { downloadCsv } from "@/lib/export";
import { exportEquipmentCsv } from "@/pages/dashboard/equipment/hooks/useEquipmentListState";
import { IncidentsHeaderBar } from "@/pages/dashboard/incidents/components/IncidentsHeaderBar";
import { PartMovementsSection } from "@/pages/dashboard/inventory/components/PartMovementsSection";
import { filterInventoryParts } from "@/pages/dashboard/inventory/helpers";
import { ManualDetailSheet } from "@/pages/dashboard/ManualDetailSheet";
import { ManualFormDialog } from "@/pages/dashboard/ManualFormDialog";
import { SECTIONS } from "@/pages/dashboard/purchasing/components/PurchasingSectionTabs";
import { buildZeroQuantities } from "@/pages/dashboard/purchasing/dialogs/receive/helpers";
import { ReceiveLinesInputs } from "@/pages/dashboard/purchasing/dialogs/receive/components/ReceiveLinesInputs";
import { RequestsHeaderBar } from "@/pages/dashboard/requests/components/RequestsHeaderBar";
import { buildSearchGroupsFromResponse } from "@/pages/dashboard/search/helpers";
import type { PurchaseOrderLine } from "@/lib/purchasing";
import type { PartDoc } from "@/pages/dashboard/inventory/types";

describe("Oleada 2 — Productividad diaria (P1)", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeAll(() => {
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
  });

  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    MOCK_QUERY.mockReturnValue(undefined);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("readStoredAnalyticsLens y writeStoredAnalyticsLens validan y persisten la lente", () => {
    expect(readStoredAnalyticsLens()).toBeNull();
    writeStoredAnalyticsLens("inventory_purchasing");
    expect(readStoredAnalyticsLens()).toBe("inventory_purchasing");
    window.localStorage.setItem(ANALYTICS_LENS_STORAGE_KEY, "desconocida");
    expect(readStoredAnalyticsLens()).toBeNull();
  });

  it("filterInventoryParts busca también por partNumber", () => {
    const parts = [
      {
        _id: "p1" as Id<"spareParts">,
        code: "COD-01",
        partNumber: "SONY-XYZ-99",
        name: "Ventilador axial",
        category: "Refrigeración",
        stock: 3,
        minStock: 2,
        unit: "ud",
      },
    ] as PartDoc[];

    const res = filterInventoryParts({
      parts,
      equipment: [],
      catalogModels: [],
      category: "all",
      equipmentFilter: "all",
      lowStockOnly: false,
      search: "xyz-99",
    });
    expect(res).toHaveLength(1);
    expect(res[0]?.code).toBe("COD-01");
  });

  it("PartMovementsSection muestra la referencia del movimiento", () => {
    const html = renderToStaticMarkup(
      <PartMovementsSection
        unit="ud"
        movements={[
          {
            _id: "m1" as Id<"stockMovements">,
            _creationTime: 1000,
            sparePartId: "p1" as Id<"spareParts">,
            kind: "purchase_reception",
            delta: 4,
            previousStock: 1,
            nextStock: 5,
            actorName: "Laura",
            reference: "OC-0008",
            createdAt: 1000,
          } as never,
        ]}
      />,
    );
    expect(html).toContain("OC-0008");
  });

  it("ReceiveLinesInputs ofrece botones rápidos Todo pendiente y Todo a 0", async () => {
    const lines: PurchaseOrderLine[] = [
      {
        purchaseRequestId: "pr1" as Id<"purchaseRequests">,
        requestId: "req1" as Id<"partRequests">,
        requestReference: "PET-0001",
        purchaseReference: "PC-0001",
        sparePartId: "p1" as Id<"spareParts">,
        code: "REP-1",
        name: "Cable SDI",
        unit: "ud",
        quantity: 5,
        receivedQuantity: 2,
      } as PurchaseOrderLine,
    ];
    expect(buildZeroQuantities(lines)).toEqual({ pr1: "0" });

    const onFill = vi.fn();
    const onClear = vi.fn();
    await act(async () => {
      root.render(
        <ReceiveLinesInputs
          lines={lines}
          cantidades={{ pr1: "3" }}
          onChangeCantidad={vi.fn()}
          onFillAllPending={onFill}
          onClearAllQuantities={onClear}
        />,
      );
      await settle();
    });

    const buttons = Array.from(container.querySelectorAll("button"));
    const fillBtn = buttons.find((b) => b.textContent?.includes("Todo pendiente"));
    const zeroBtn = buttons.find((b) => b.textContent?.includes("Todo a 0"));
    expect(fillBtn).toBeDefined();
    expect(zeroBtn).toBeDefined();
    await act(async () => {
      fillBtn?.click();
      zeroBtn?.click();
    });
    expect(onFill).toHaveBeenCalledTimes(1);
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it("PurchasingSectionTabs nombra la pestaña histórico como «Histórico de líneas»", () => {
    const historyTab = SECTIONS.find((s) => s.id === "history");
    expect(historyTab?.label).toBe("Histórico de líneas");
  });

  it("ManualFormDialog muestra título y botón de nota para notas del taller y ManualDetailSheet expone Editar/Eliminar", async () => {
    await act(async () => {
      root.render(
        <ManualFormDialog
          manual={null}
          equipment={[]}
          canManage={false}
          onClose={vi.fn()}
        />,
      );
      await settle();
    });

    expect(document.body.textContent).toContain("Nueva nota del taller");
    expect(document.body.textContent).toContain("Añadir nota");

    const onEdit = vi.fn();
    const onDelete = vi.fn();
    const manual = {
      _id: "man1" as Id<"manuals">,
      _creationTime: 1000,
      kind: "note" as const,
      title: "Ajuste de ganancia",
      type: "Ajuste",
      notes: "Subir +3dB",
      history: [],
      createdAt: 1000,
      updatedAt: 1000,
    };

    await act(async () => {
      root.render(
        <ManualDetailSheet
          manual={manual as never}
          equipment={[]}
          canEdit={true}
          canDelete={true}
          onEdit={onEdit}
          onDelete={onDelete}
          onClose={vi.fn()}
        />,
      );
      await settle();
    });

    const editBtn = Array.from(document.body.querySelectorAll("button")).find(
      (b) => b.textContent?.trim() === "Editar",
    );
    const deleteBtn = Array.from(document.body.querySelectorAll("button")).find(
      (b) => b.textContent?.trim() === "Eliminar",
    );
    expect(editBtn).toBeDefined();
    expect(deleteBtn).toBeDefined();
  });

  it("buildSearchGroupsFromResponse incluye el grupo Manuales cuando hay resultados", () => {
    const groups = buildSearchGroupsFromResponse({
      incidents: [],
      requests: [],
      archived: [],
      parts: [],
      equipment: [],
      manuals: [
        {
          kind: "manual",
          id: "man1" as Id<"manuals">,
          title: "Esquema HDC-3500",
          subtitle: "Manual PDF · Sony · HDC-3500",
        },
      ],
    });
    expect(groups.some((g) => g.kind === "manual" && g.label === "Manuales")).toBe(
      true,
    );
  });

  it("exportEquipmentCsv genera descarga CSV con el estado operativo", () => {
    const count = exportEquipmentCsv(
      [
        {
          _id: "eq1" as Id<"equipment">,
          _creationTime: 1000,
          name: "Cámara plató",
          model: "HDC-3500",
          brand: "Sony",
          location: "Plató 1",
          operationalState: "operational",
          createdAt: 1000,
          updatedAt: 1000,
        } as never,
      ],
      () => true,
    );
    expect(count).toBe(1);
    expect(downloadCsv).toHaveBeenCalledTimes(1);
  });

  it("RequestsHeaderBar oculta Nueva petición sin createRequests y permite Mis peticiones", () => {
    const html = renderToStaticMarkup(
      <RequestsHeaderBar
        filter="all"
        onFilterChange={vi.fn()}
        counts={{
          all: 2,
          pending: 1,
          quoteRequested: 0,
          approved: 1,
          onHold: 0,
          materialReceived: 0,
          issued: 0,
          returned: 0,
          rejected: 0,
          cancelled: 0,
        }}
        canFilterMine={true}
        mineOnly={true}
        onMineOnlyChange={vi.fn()}
        mineCount={1}
        canCreate={false}
        equipmentFilter="all"
        onEquipmentFilterChange={vi.fn()}
        equipment={[]}
        filteredCount={1}
        onExport={vi.fn()}
        onNewRequest={vi.fn()}
      />,
    );
    expect(html).toContain("Mis peticiones");
    expect(html).not.toContain("Nueva petición");
  });

  it("IncidentsHeaderBar renderiza filtro Mis incidencias y selector de prioridad", () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <IncidentsHeaderBar
          filter="all"
          onFilterChange={vi.fn()}
          counts={{
            all: 3,
            reported: 1,
            assigned: 1,
            workshop: 0,
            externalRepair: 0,
            waitingParts: 0,
            ready: 0,
            resolved: 1,
            unresolved: 0,
          }}
          canFilterMine={true}
          mineOnly={false}
          onMineOnlyChange={vi.fn()}
          mineCount={2}
          priority="all"
          onPriorityChange={vi.fn()}
          onOpenReports={vi.fn()}
        />
      </MemoryRouter>,
    );
    expect(html).toContain("Mis incidencias");
    expect(html).toContain("Filtrar por prioridad");
  });
});
