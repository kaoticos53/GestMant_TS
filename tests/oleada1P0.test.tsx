// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
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

const { STATE, QUERY_CALLS } = vi.hoisted(() => ({
  STATE: {
    byRequestData: { requests: [], orders: [] } as unknown,
    canShareGrants: { createIncidentFromMail: true } as Record<string, boolean>,
  },
  QUERY_CALLS: [] as { name: string; args: unknown }[],
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), message: vi.fn() },
}));

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({
    user: {
      _id: "user-1",
      role: "manager",
      roles: ["manager"],
      active: true,
      isAnonymous: false,
    },
  }),
}));

vi.mock("@/convex/_generated/api", () => ({
  api: {
    permissions: {
      myPermissions: { name: "permissions:myPermissions" },
    },
    purchasing: {
      byRequest: { name: "purchasing:byRequest" },
      requestPurchase: { name: "purchasing:requestPurchase" },
      createRequestsFromShortage: {
        name: "purchasing:createRequestsFromShortage",
      },
    },
    mailShares: {
      canShare: { name: "mailShares:canShare" },
      findTarget: { name: "mailShares:findTarget" },
      share: { name: "mailShares:share" },
      createIncidentFromMail: { name: "mailShares:createIncidentFromMail" },
      listOrphaned: { name: "mailShares:listOrphaned" },
      downloadOrphaned: { name: "mailShares:downloadOrphaned" },
      purgeOrphaned: { name: "mailShares:purgeOrphaned" },
    },
    partRequests: {
      decisions: { name: "partRequests:decisions" },
    },
  },
}));

vi.mock("convex/react", () => ({
  useQuery: (query: { name?: string }, args?: unknown) => {
    const name = query?.name ?? "unknown";
    QUERY_CALLS.push({ name, args });
    if (args === "skip") return undefined;
    if (name === "permissions:myPermissions") {
      return { grants: { viewPurchasing: true, managePurchasing: true } };
    }
    if (name === "purchasing:byRequest") return STATE.byRequestData;
    if (name === "mailShares:canShare") {
      return { grants: STATE.canShareGrants };
    }
    if (name === "mailShares:listOrphaned") return [];
    if (name === "partRequests:decisions") return [];
    return undefined;
  },
  useMutation: () => vi.fn().mockResolvedValue({ references: [], repeated: 0 }),
  useAction: () => vi.fn().mockResolvedValue({ reference: "INC-0099" }),
}));

vi.mock("@/pages/dashboard/settings/AutomaticArchiveCard", () => ({
  AutomaticArchiveCard: () => <div data-testid="automatic-archive-card" />,
}));
vi.mock("@/pages/dashboard/settings/TrashCard", () => ({
  TrashCard: () => <div data-testid="trash-card" />,
}));
vi.mock("@/pages/dashboard/settings/UnusedUploadsCard", () => ({
  UnusedUploadsCard: () => <div data-testid="unused-uploads-card" />,
}));
vi.mock("@/pages/dashboard/settings/StorageCleanupCard", () => ({
  StorageCleanupCard: () => <div data-testid="storage-cleanup-card" />,
}));
vi.mock("@/pages/dashboard/settings/CatalogsCard", () => ({
  CatalogsCard: () => <div data-testid="catalogs-card" />,
}));
vi.mock("@/pages/dashboard/settings/EquipmentModelsCard", () => ({
  EquipmentModelsCard: () => <div data-testid="models-card" />,
}));

import { Tabs } from "@/components/ui/tabs";
import { AbilityProvider } from "@/components/AbilityProvider";
import { ShareMailDialog } from "@/pages/dashboard/mailbox/ShareMailDialog";
import { PendingSection } from "@/pages/dashboard/purchasing/components/PendingSection";
import { LinkedPurchasesCard } from "@/pages/dashboard/requests/components/LinkedPurchasesCard";
import { WorkshopSettingsTabsPanels } from "@/pages/dashboard/settings/view/components/WorkshopSettingsTabsPanels";
import { isSummaryHidden } from "@/pages/dashboard/constants/navConfig";
import { WorkAlertNotice } from "@/pages/dashboard/WorkAlertNotice";
import type { RequestDoc } from "@/pages/dashboard/requests/types";

function makeRequest(overrides: Partial<RequestDoc> = {}): RequestDoc {
  return {
    _id: "req-1" as Id<"partRequests">,
    _creationTime: 1000,
    reference: "PET-0001",
    requesterName: "Carlos Técnico",
    requesterTeam: "Plató",
    equipment: "Cámara",
    description: "Cable triaxial",
    urgency: "normal",
    status: "pending",
    createdAt: 1000,
    updatedAt: 1000,
    lines: [
      {
        sparePartId: "part-1" as Id<"spareParts">,
        code: "CAB-01",
        name: "Cable triaxial",
        quantity: 2,
      },
    ],
    attachments: [],
    ...overrides,
  } as RequestDoc;
}

describe("Oleada 1 — estabilidad y bugs P0", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeAll(() => {
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
  });

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    QUERY_CALLS.length = 0;
    STATE.byRequestData = { requests: [], orders: [] };
    STATE.canShareGrants = { createIncidentFromMail: true };
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("LinkedPurchasesCard omite purchasing:byRequest sin permiso de lectura y oculta Pedir compra si está rechazada", async () => {
    await act(async () => {
      root.render(
        <LinkedPurchasesCard
          request={makeRequest({ status: "pending" })}
          hasShortage={true}
          canPurchase={false}
          canViewPurchasing={false}
        />,
      );
    });
    await settle();

    expect(QUERY_CALLS).toContainEqual({
      name: "purchasing:byRequest",
      args: "skip",
    });

    await act(async () => {
      root.render(
        <LinkedPurchasesCard
          request={makeRequest({ status: "rejected" })}
          hasShortage={true}
          canPurchase={true}
          canViewPurchasing={true}
        />,
      );
    });
    await settle();

    expect(container.textContent).not.toContain("Pedir compra");
  });

  it("ShareMailDialog activa directamente Crear incidencia cuando no hay destinos disponibles", async () => {
    await act(async () => {
      root.render(
        <ShareMailDialog
          messageId="msg-1"
          open={true}
          onOpenChange={() => {}}
        />,
      );
    });
    await settle();

    const submitButton = Array.from(
      document.body.querySelectorAll("button"),
    ).find((b) => b.textContent?.includes("Crear incidencia"));
    expect(submitButton).toBeDefined();
    expect(submitButton?.disabled).toBe(false);
  });

  it("WorkshopSettingsTabsPanels no monta OrphanMailSharesCard para canPurgeUploads sin canManageData", async () => {
    await act(async () => {
      root.render(
        <Tabs value="storage">
          <WorkshopSettingsTabsPanels
            canManageArchive={true}
            canPurgeUploads={true}
            canManageData={false}
            hasManageIncidents={true}
            hasDecideRequests={true}
          />
        </Tabs>,
      );
    });
    await settle();

    expect(
      QUERY_CALLS.some((c) => c.name === "mailShares:listOrphaned"),
    ).toBe(false);

    QUERY_CALLS.length = 0;
    await act(async () => {
      root.render(
        <Tabs value="storage">
          <WorkshopSettingsTabsPanels
            canManageArchive={true}
            canPurgeUploads={true}
            canManageData={true}
            hasManageIncidents={true}
            hasDecideRequests={true}
          />
        </Tabs>,
      );
    });
    await settle();

    expect(
      QUERY_CALLS.some((c) => c.name === "mailShares:listOrphaned"),
    ).toBe(true);
  });

  it("PendingSection delega la apertura de una petición de falta de stock a onOpenRequest", async () => {
    const onOpenRequest = vi.fn();
    const req = {
      ...makeRequest({ status: "pending" }),
      attachments: [],
    };
    const parts = [
      {
        _id: "part-1" as Id<"spareParts">,
        _creationTime: 1000,
        code: "CAB-01",
        name: "Cable triaxial",
        category: "Cables",
        stock: 0,
        minStock: 1,
        unit: "ud",
        supplier: "Proveedor",
      },
    ];

    await act(async () => {
      root.render(
        <AbilityProvider>
          <PendingSection
            purchaseRequests={[]}
            partRequests={[req as never]}
            parts={parts as never}
            canManage={true}
            onOpenRequest={onOpenRequest}
          />
        </AbilityProvider>,
      );
    });
    await settle();

    const link = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("PET-0001"),
    );
    expect(link).toBeDefined();
    await act(async () => {
      link?.click();
    });

    expect(onOpenRequest).toHaveBeenCalledWith("req-1");
  });

  it("WorkAlertNotice muestra la alerta cuando uno de los roles asignados coincide con la audiencia", () => {
    const html = renderToStaticMarkup(
      <WorkAlertNotice
        role={["technician", "manager"]}
        audience={["manager"]}
        days={3}
        staleWork={[
          {
            incident: {
              _id: "inc-1" as Id<"incidents">,
              reference: "INC-0001",
              status: "assigned",
              assigneeName: "Nuria",
            },
            days: 5,
          },
        ]}
        dismissed={false}
        canOpenSettings={false}
        onOpenIncident={() => {}}
        onOpenSettings={() => {}}
        onDismiss={() => {}}
      />,
    );

    expect(html).toContain("INC-0001");
  });

  it("isSummaryHidden oculta la tira superior en analytics, equipment, manuals y users", () => {
    expect(isSummaryHidden("analytics", 4)).toBe(true);
    expect(isSummaryHidden("equipment", 4)).toBe(true);
    expect(isSummaryHidden("manuals", 4)).toBe(true);
    expect(isSummaryHidden("users", 4)).toBe(true);
    expect(isSummaryHidden("incidents", 4)).toBe(false);
  });
});
