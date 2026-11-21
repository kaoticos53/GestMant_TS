// @vitest-environment jsdom
import { settle } from "./settle";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const { STATE } = vi.hoisted(() => ({
  STATE: {
    rows: [] as Record<string, unknown>[],
    calls: [] as { name: string; args: unknown }[],
  },
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), message: vi.fn() },
}));

vi.mock("convex/react", async () => {
  const { getFunctionName } = await import("convex/server");
  return {
    useQuery: (query: unknown) => {
      const name = getFunctionName(query as never);
      if (name === "mailShares:listOrphaned") return STATE.rows;
      return undefined;
    },
    useMutation: (mutation: unknown) => async (args: unknown) => {
      STATE.calls.push({ name: getFunctionName(mutation as never), args });
      return true;
    },
    useAction: (action: unknown) => async (args: unknown) => {
      STATE.calls.push({ name: getFunctionName(action as never), args });
      return {
        url: "https://taller.test/api/storage/objeto",
        name: "presupuesto.pdf",
        contentType: "application/pdf",
      };
    },
  };
});

import { OrphanMailSharesCard } from "@/pages/dashboard/settings/OrphanMailSharesCard";

const HUERFANA = {
  shareId: "share_1",
  destinationType: "equipment",
  destinationReference: "EQ-0001",
  subject: "Presupuesto del SAT",
  fromName: "Proveedor",
  fromAddress: "sat@proveedor.es",
  mode: "original",
  deletedAt: 1_800_000_000_000,
  purgeAt: 1_800_604_800_000,
  size: 38,
  files: [
    { kind: "eml", index: null, name: "correo.eml", size: 27 },
    { kind: "attachment", index: 0, name: "presupuesto.pdf", size: 11 },
  ],
};

describe("OrphanMailSharesCard — descarga de huérfanas", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    STATE.calls = [];
    STATE.rows = [HUERFANA];
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    vi.restoreAllMocks();
  });

  it("enseña cada archivo disponible junto a la purga", async () => {
    await act(async () => {
      root.render(<OrphanMailSharesCard />);
    });
    await settle();

    expect(container.textContent).toContain("Presupuesto del SAT");
    expect(container.textContent).toContain("correo.eml");
    expect(container.textContent).toContain("presupuesto.pdf");
    expect(container.textContent).toContain("Purgar ahora");
  });

  it("descarga el adjunto por la ruta propia de huérfanas", async () => {
    await act(async () => {
      root.render(<OrphanMailSharesCard />);
    });
    await settle();

    const button = Array.from(container.querySelectorAll("button")).find(
      (candidate) => candidate.textContent?.includes("presupuesto.pdf"),
    );
    expect(button).toBeDefined();

    await act(async () => {
      button!.dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }),
      );
    });
    await settle();

    expect(STATE.calls).toContainEqual({
      name: "mailShares:downloadOrphaned",
      args: { shareId: "share_1", file: "attachment", index: 0 },
    });
  });
});
