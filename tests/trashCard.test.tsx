// @vitest-environment jsdom
import { settle } from "./settle";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const { STATE } = vi.hoisted(() => ({
  STATE: {
    trash: { pending: [] as any[], kept: [] as any[], pendingBytes: 0, nextPurgeAt: null as number | null },
    incidentsTrash: { items: [] as any[], nextPurgeAt: null as number | null, retentionDays: 30 },
    requestsTrash: { items: [] as any[], nextPurgeAt: null as number | null, retentionDays: 30 },
    settings: { days: 30 },
    calls: [] as { name: string; args: unknown }[],
  },
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), message: vi.fn() },
}));

vi.mock("convex/react", async () => {
  const { getFunctionName } = await import("convex/server");
  return {
    useQuery: (query: unknown, args: unknown) => {
      if (args === "skip") return undefined;
      const name = getFunctionName(query as never);
      if (name === "trash:list") return STATE.trash;
      if (name === "trash:settings") return STATE.settings;
      if (name === "incidents:trash") return STATE.incidentsTrash;
      if (name === "partRequests:trash") return STATE.requestsTrash;
      return undefined;
    },
    useMutation: (mutation: unknown) => async (args: unknown) => {
      const name = getFunctionName(mutation as never);
      STATE.calls.push({ name, args });
      return { ok: true, bytes: 1024, kept: false };
    },
  };
});

import { TrashCard } from "@/pages/dashboard/settings/TrashCard";

describe("TrashCard — papelera unificada del taller", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    STATE.calls = [];
    STATE.trash = { pending: [], kept: [], pendingBytes: 0, nextPurgeAt: null };
    STATE.incidentsTrash = { items: [], nextPurgeAt: null, retentionDays: 30 };
    STATE.requestsTrash = { items: [], nextPurgeAt: null, retentionDays: 30 };
    STATE.settings = { days: 30 };
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("enseña mensaje de papelera vacía si no hay nada retirado", async () => {
    await act(async () => {
      root.render(<TrashCard />);
    });
    await settle();

    expect(container.textContent).toContain("Papelera del taller");
    expect(container.textContent).toContain("La papelera está vacía");
  });

  it("enseña la sección de incidencias retiradas cuando hay alguna", async () => {
    STATE.incidentsTrash = {
      items: [
        {
          id: "inc_1",
          reference: "INC-0042",
          status: "reported",
          equipmentKind: "Cámara",
          model: "Sony FX6",
          location: "Plató 1",
          description: "No enciende tras golpe",
          deletedAt: Date.now() - 3600000,
          deletedBy: "Elena Vidal",
          deletedReason: "Aviso duplicado",
          purgeAt: Date.now() + 86400000 * 25,
          archived: false,
          reporterEmail: "operador@taller.es",
          emailedAt: Date.now() - 3500000,
          emailError: null,
        },
      ],
      nextPurgeAt: Date.now() + 86400000 * 25,
      retentionDays: 30,
    };

    await act(async () => {
      root.render(<TrashCard />);
    });
    await settle();

    expect(container.textContent).toContain("Incidencias retiradas");
    expect(container.textContent).toContain("INC-0042");
    expect(container.textContent).toContain("Sony FX6");
    expect(container.textContent).toContain("Aviso duplicado");
    expect(container.textContent).toContain("Recuperar");
    expect(container.textContent).toContain("Borrar ya");
  });

  it("permite recuperar una incidencia retirada", async () => {
    STATE.incidentsTrash = {
      items: [
        {
          id: "inc_1",
          reference: "INC-0042",
          status: "reported",
          equipmentKind: "Cámara",
          model: "Sony FX6",
          location: "Plató 1",
          description: "No enciende tras golpe",
          deletedAt: Date.now() - 3600000,
          deletedBy: "Elena Vidal",
          deletedReason: "Aviso duplicado",
          purgeAt: Date.now() + 86400000 * 25,
          archived: false,
          reporterEmail: null,
          emailedAt: null,
          emailError: null,
        },
      ],
      nextPurgeAt: null,
      retentionDays: 30,
    };

    await act(async () => {
      root.render(<TrashCard />);
    });
    await settle();

    const restoreBtn = Array.from(container.querySelectorAll("button")).find(
      (btn) => btn.textContent?.includes("Recuperar"),
    );
    expect(restoreBtn).toBeDefined();

    await act(async () => {
      restoreBtn!.dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }),
      );
    });
    await settle();

    const restoreCall = STATE.calls.find(
      (c) => c.name === "incidents:restore",
    );
    expect(restoreCall).toBeDefined();
    expect(restoreCall?.args).toEqual({ incidentId: "inc_1" });
  });

  it("permite abrir diálogo y borrar una incidencia definitivamente", async () => {
    STATE.incidentsTrash = {
      items: [
        {
          id: "inc_1",
          reference: "INC-0042",
          status: "reported",
          equipmentKind: "Cámara",
          model: "Sony FX6",
          location: "Plató 1",
          description: "No enciende tras golpe",
          deletedAt: Date.now() - 3600000,
          deletedBy: "Elena Vidal",
          deletedReason: "Aviso duplicado",
          purgeAt: Date.now() + 86400000 * 25,
          archived: false,
          reporterEmail: null,
          emailedAt: null,
          emailError: null,
        },
      ],
      nextPurgeAt: null,
      retentionDays: 30,
    };

    await act(async () => {
      root.render(<TrashCard />);
    });
    await settle();

    const deleteBtn = Array.from(container.querySelectorAll("button")).find(
      (btn) => btn.textContent?.includes("Borrar ya"),
    );
    expect(deleteBtn).toBeDefined();

    await act(async () => {
      deleteBtn!.dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }),
      );
    });
    await settle();

    // Diálogo abierto
    expect(document.body.textContent).toContain("¿Borrar incidencia INC-0042 definitivamente?");

    const confirmBtn = Array.from(document.body.querySelectorAll("button")).find(
      (btn) => btn.textContent?.includes("Borrar definitivamente"),
    );
    expect(confirmBtn).toBeDefined();

    await act(async () => {
      confirmBtn!.dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }),
      );
    });
    await settle();

    const deleteCall = STATE.calls.find(
      (c) => c.name === "incidents:deleteNow",
    );
    expect(deleteCall).toBeDefined();
    expect(deleteCall?.args).toEqual({ incidentId: "inc_1" });
  });
});
