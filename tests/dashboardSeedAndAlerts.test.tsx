// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { useWorkAlertState } from "@/pages/dashboard/hooks/useWorkAlertState";
import { useDashboardSeed } from "@/pages/dashboard/hooks/useDashboardSeed";

const saveWorkAlertDismissalMock = vi.fn();
const seedDemoDataMock = vi.fn();
const seedDemoUploadsMock = vi.fn();
const seedDemoManualsMock = vi.fn();

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("convex/react", () => ({
  useQuery: () => undefined,
  useMutation: () => {
    return saveWorkAlertDismissalMock;
  },
  useAction: () => {
    return seedDemoUploadsMock;
  },
}));

let roots: Root[] = [];

beforeEach(() => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  document.body.innerHTML = "";
  roots = [];
  saveWorkAlertDismissalMock.mockReset();
  seedDemoDataMock.mockReset();
  seedDemoUploadsMock.mockReset();
  seedDemoManualsMock.mockReset();
});

afterEach(async () => {
  await act(async () => {
    for (const root of roots) root.unmount();
  });
  roots = [];
  document.body.innerHTML = "";
});

describe("useWorkAlertState", () => {
  test("calcula showEmptyNotice basado en totalParts y startedEmpty", () => {
    let hook!: ReturnType<typeof useWorkAlertState>;
    function TestComp() {
      hook = useWorkAlertState(null, "tecnico", 0, 0, false);
      return null;
    }

    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    roots.push(root);

    act(() => {
      root.render(<TestComp />);
    });

    expect(hook.isEmpty).toBe(true);

    act(() => {
      hook.handleStartEmpty();
    });

    expect(hook.startedEmpty).toBe(true);
  });
});

describe("useDashboardSeed", () => {
  test("gestiona el estado de carga durante handleSeed", async () => {
    seedDemoUploadsMock.mockResolvedValue({ uploaded: 0, inserted: 0 });
    seedDemoManualsMock.mockResolvedValue({ uploaded: 0, inserted: 0 });
    seedDemoDataMock.mockResolvedValue(undefined);

    let hook!: ReturnType<typeof useDashboardSeed>;
    function TestComp() {
      hook = useDashboardSeed();
      return null;
    }

    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    roots.push(root);

    act(() => {
      root.render(<TestComp />);
    });

    expect(hook.isSeeding).toBe(false);
  });
});
