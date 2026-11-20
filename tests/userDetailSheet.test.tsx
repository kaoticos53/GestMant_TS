// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { settle } from "./settle";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const { mockUseQuery } = vi.hoisted(() => ({
  mockUseQuery: vi.fn(),
}));

vi.mock("convex/react", () => ({
  useQuery: mockUseQuery,
}));

import { UserDetailSheet } from "@/pages/dashboard/users/components/UserDetailSheet";
import type { Member } from "@/pages/dashboard/users/types";

const SAMPLE_MEMBER: Member = {
  _id: "user_2" as never,
  name: "Lucía Gómez",
  email: "lucia@taller.es",
  role: "technician",
  position: "Técnico electromecánico",
  location: "Nave 2",
  phone: "600123123",
  active: true,
  isAnonymous: false,
};

describe("UserDetailSheet (Fase 3)", () => {
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

  it("muestra perfil, capacidades, actividad y permite editar o desactivar", async () => {
    mockUseQuery.mockReturnValue({
      assignedIncidentsTotal: 9,
      activeAssignedIncidents: 3,
      requestsCount: 4,
      capabilities: [{ key: "viewIncidents", label: "Ver incidencias" }],
      recentMovements: [
        {
          _id: "mov_u1",
          kind: "manual_adjust",
          sparePartName: "Correa trapezoidal",
          delta: -1,
          createdAt: Date.now(),
        },
      ],
    });

    const onEdit = vi.fn();
    const onToggleActive = vi.fn();

    await act(async () => {
      root.render(
        <UserDetailSheet
          member={SAMPLE_MEMBER}
          isSelf={false}
          roleLabelOf={() => "Técnico"}
          onClose={vi.fn()}
          onEdit={onEdit}
          onToggleActive={onToggleActive}
        />,
      );
      await settle();
    });

    const text = document.body.textContent ?? "";
    expect(text).toContain("Lucía Gómez");
    expect(text).toContain("lucia@taller.es");
    expect(text).toContain("Ver incidencias");
    expect(text).toContain("Correa trapezoidal");

    const editBtn = Array.from(document.body.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("Editar perfil"),
    );
    expect(editBtn).toBeDefined();
    await act(async () => {
      editBtn?.click();
      await settle();
    });
    expect(onEdit).toHaveBeenCalledWith(SAMPLE_MEMBER);
  });
});
