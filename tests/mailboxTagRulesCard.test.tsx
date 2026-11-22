// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { settle } from "./settle";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const { mockUseQuery, mockUseMutation } = vi.hoisted(() => ({
  mockUseQuery: vi.fn(),
  mockUseMutation: vi.fn(),
}));

vi.mock("convex/react", () => ({
  useQuery: mockUseQuery,
  useMutation: mockUseMutation,
}));

import { MailboxTagRulesCard } from "@/pages/dashboard/settings/mailbox/MailboxTagRulesCard";

describe("MailboxTagRulesCard (Fase 4)", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.clearAllMocks();
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

  it("muestra reglas existentes, plantillas rápidas y permite añadir plantilla con 1 clic", async () => {
    const mockSave = vi.fn().mockResolvedValue("rule_new");
    const mockToggle = vi.fn().mockResolvedValue(undefined);
    const mockDelete = vi.fn().mockResolvedValue(undefined);
    const mockReorder = vi.fn().mockResolvedValue(undefined);

    let mutIdx = 0;
    mockUseMutation.mockImplementation(() => {
      mutIdx += 1;
      const mod = mutIdx % 4;
      if (mod === 1) return mockSave;
      if (mod === 2) return mockToggle;
      if (mod === 3) return mockDelete;
      return mockReorder;
    });

    mockUseQuery.mockReturnValue([
      {
        _id: "r_1",
        name: "Averías urgentes",
        enabled: true,
        priority: 0,
        matchMode: "any",
        conditions: [
          {
            field: "subject_or_snippet",
            operator: "contains",
            value: "avería",
          },
        ],
        tags: ["incidents"],
      },
    ]);

    await act(async () => {
      root.render(<MailboxTagRulesCard />);
      await settle();
    });

    expect(container.textContent).toContain("Averías urgentes");
    expect(container.textContent).toContain("Incidencias");

    const presetBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("Notificaciones automáticas"),
    );
    expect(presetBtn).toBeDefined();
    await act(async () => {
      presetBtn?.click();
      await settle();
    });
    expect(mockSave).toHaveBeenCalledTimes(1);
  });
});
