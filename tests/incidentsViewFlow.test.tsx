// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { COLA } = vi.hoisted(() => ({
  COLA: {
    incidents: [] as unknown[],
    equipment: [] as unknown[],
    requests: [] as unknown[],
  },
}));

vi.mock("convex/react", async () => {
  const { getFunctionName } = await import("convex/server");
  return {
    useQuery: (query: unknown) => {
      const nombre = getFunctionName(query as never);
      if (nombre === "incidents:list") return COLA.incidents;
      if (nombre === "equipment:list") return COLA.equipment;
      if (nombre === "partRequests:list") return COLA.requests;
      return [];
    },
    useMutation: () => vi.fn().mockResolvedValue(undefined),
  };
});

import { MemoryRouter } from "react-router";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { IncidentsView } from "@/pages/dashboard/IncidentsView";

const AHORA = Date.now();

function createIncident(extra: Partial<Doc<"incidents">> = {}): Doc<"incidents"> {
  return {
    _id: "inc-1" as Id<"incidents">,
    _creationTime: AHORA,
    reference: "INC-2026-0001",
    status: "reported",
    equipmentKind: "Cámara",
    model: "Sony HDC-3500",
    serialNumber: "SN-998877",
    location: "Estudio 1",
    description: "No da señal por SDI 1",
    reporterName: "Laura Peña",
    reportedAt: AHORA - 3600000,
    history: [],
    ...extra,
  };
}

let roots: Root[] = [];

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  document.body.innerHTML = "";
  roots = [];
  COLA.incidents = [];
  COLA.equipment = [];
  COLA.requests = [];
});

afterEach(async () => {
  await act(async () => {
    for (const root of roots) root.unmount();
  });
  roots = [];
  document.body.innerHTML = "";
});

function renderView(props: React.ComponentProps<typeof IncidentsView> = {}) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  roots.push(root);
  act(() => {
    root.render(
      <MemoryRouter>
        <IncidentsView {...props} />
      </MemoryRouter>,
    );
  });
  return container;
}

describe("IncidentsView flow and rendering", () => {
  it("muestra el estado vacío cuando no hay incidencias en la cola", () => {
    COLA.incidents = [];
    const container = renderView();

    expect(container.textContent).toContain("No hay incidencias notificadas");
    expect(container.textContent).toContain("Abrir formulario");
  });

  it("renderiza tarjetas de incidencias con sus datos principales", () => {
    COLA.incidents = [
      createIncident({
        reference: "INC-2026-0001",
        model: "Sony HDC-3500",
        reporterName: "Laura Peña",
        assigneeName: "Iván Torres",
      }),
    ];

    const container = renderView();

    expect(container.textContent).not.toContain("No hay incidencias notificadas");
    expect(container.textContent).toContain("INC-2026-0001");
    expect(container.textContent).toContain("Sony HDC-3500");
    expect(container.textContent).toContain("Por Laura Peña");
    expect(container.textContent).toContain("Técnico: Iván Torres");
  });

  it("muestra el botón de archivar solo en incidencias cerradas si el usuario es coordinador (canAssign)", () => {
    COLA.incidents = [
      createIncident({
        _id: "inc-res" as Id<"incidents">,
        reference: "INC-2026-0002",
        status: "resolved",
      }),
    ];

    // Sin permisos canAssign
    const userContainer = renderView({ canAssign: false });
    expect(userContainer.querySelector('button[title*="al archivo"]')).toBeNull();

    // Con permisos canAssign
    const managerContainer = renderView({ canAssign: true });
    expect(managerContainer.querySelector('button[title*="al archivo"]')).not.toBeNull();
  });

  it("abre el diálogo de informes al pulsar Informes del periodo", () => {
    COLA.incidents = [createIncident()];
    const container = renderView({ canAssign: true });

    const btn = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Informes del periodo"),
    );
    expect(btn).toBeDefined();

    act(() => {
      btn?.click();
    });

    // Se abre el diálogo de informes
    expect(document.body.textContent).toContain("Informes de un periodo");
  });
});
