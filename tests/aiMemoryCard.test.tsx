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

import { AiMemoryCard } from "@/pages/dashboard/settings/AiMemoryCard";

describe("AiMemoryCard (Fase 4)", () => {
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

  it("muestra estadísticas, hechos guardados y permite reindexar", async () => {
    const mockRebuild = vi.fn().mockResolvedValue({ indexed: 18 });
    const mockRebuildMail = vi.fn().mockResolvedValue({ indexed: 5 });
    const mockSaveFact = vi.fn().mockResolvedValue("f1");
    const mockDeleteFact = vi.fn().mockResolvedValue(undefined);

    let mutIdx = 0;
    mockUseMutation.mockImplementation(() => {
      mutIdx += 1;
      const mod = mutIdx % 4;
      if (mod === 1) return mockRebuild;
      if (mod === 2) return mockRebuildMail;
      if (mod === 3) return mockSaveFact;
      return mockDeleteFact;
    });

    let qIdx = 0;
    mockUseQuery.mockImplementation(() => {
      qIdx += 1;
      return qIdx % 2 === 1
        ? {
            totalChunks: 20,
            workshopChunks: 15,
            mailboxChunks: 5,
            factsCount: 1,
          }
        : [
            {
              _id: "fact_1",
              title: "Compresor GA-15",
              fact: "Revisar junta cada 6 meses",
              module: "incidents",
            },
          ];
    });

    await act(async () => {
      root.render(<AiMemoryCard />);
      await settle();
    });

    const text = container.textContent ?? "";
    expect(text).toContain("15");
    expect(text).toContain("Compresor GA-15");

    const rebuildBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("Indexar todo el taller"),
    );
    await act(async () => {
      rebuildBtn?.click();
      await settle();
    });
    expect(mockRebuild).toHaveBeenCalledTimes(1);
  });
});
