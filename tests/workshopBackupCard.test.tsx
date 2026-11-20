// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BACKUP_FORMAT, BACKUP_VERSION } from "@/lib/backup";
import { settle } from "./settle";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const { mockUseAction, mockToastSuccess, mockToastError } = vi.hoisted(() => ({
  mockUseAction: vi.fn(),
  mockToastSuccess: vi.fn(),
  mockToastError: vi.fn(),
}));

vi.mock("convex/react", () => ({
  useAction: mockUseAction,
}));

vi.mock("sonner", () => ({
  toast: {
    success: mockToastSuccess,
    error: mockToastError,
  },
}));

import { WorkshopBackupSection } from "@/pages/dashboard/settings/workshopData/components/WorkshopBackupSection";

describe("WorkshopBackupSection (Fase 3 TDD)", () => {
  let container: HTMLDivElement;
  let root: Root;
  let exportMock: ReturnType<typeof vi.fn>;
  let restoreMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    const samplePayload = JSON.stringify({
      format: BACKUP_FORMAT,
      version: BACKUP_VERSION,
      exportedAt: 1_700_000_000_000,
      exportedBy: "admin@taller.es",
      tables: {
        equipment: [{ _id: "e1", name: "Cam", model: "M1" }],
      },
    });

    exportMock = vi.fn().mockResolvedValue({
      rawJson: samplePayload,
      summary: {
        exportedAt: 1_700_000_000_000,
        exportedBy: "admin@taller.es",
        totalRecords: 1,
        tableCounts: { equipment: 1 },
      },
    });
    restoreMock = vi.fn().mockResolvedValue({
      restoredRecords: 1,
      exportedAt: 1_700_000_000_000,
    });

    let call = 0;
    mockUseAction.mockImplementation(() => {
      call += 1;
      return call % 2 === 1 ? exportMock : restoreMock;
    });

    if (!URL.createObjectURL) {
      URL.createObjectURL = vi.fn(() => "blob:mock");
    } else {
      vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:mock");
    }
    if (!URL.revokeObjectURL) {
      URL.revokeObjectURL = vi.fn();
    } else {
      vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    }

    mockToastSuccess.mockClear();
    mockToastError.mockClear();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("permite descargar una copia completa en JSON", async () => {
    await act(async () => {
      root.render(<WorkshopBackupSection />);
    });
    await settle();

    const exportBtn = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Descargar copia (.json)"),
    );
    expect(exportBtn).not.toBeUndefined();

    await act(async () => {
      exportBtn?.click();
    });
    await settle();

    expect(exportMock).toHaveBeenCalledWith({});
    expect(mockToastSuccess).toHaveBeenCalled();
  });

  it("valida el archivo de backup, exige confirmación RESTAURAR y ejecuta restoreBackup", async () => {
    await act(async () => {
      root.render(<WorkshopBackupSection />);
    });
    await settle();

    const validJson = JSON.stringify({
      format: BACKUP_FORMAT,
      version: BACKUP_VERSION,
      exportedAt: 1_700_000_000_000,
      exportedBy: "admin@taller.es",
      tables: {
        equipment: [{ _id: "e1", name: "Cam", model: "M1" }],
      },
    });

    const input = container.querySelector<HTMLInputElement>("input[type='file']");
    expect(input).not.toBeNull();
    const file = new File([validJson], "backup.json", {
      type: "application/json",
    });
    Object.defineProperty(file, "text", {
      value: async () => validJson,
    });
    Object.defineProperty(input, "files", {
      value: [file],
      configurable: true,
    });

    await act(async () => {
      input?.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await settle();

    expect(document.body.textContent).toContain("1 registros detectados");

    const confirmInput = document.body.querySelector<HTMLInputElement>(
      "#restore-confirm-input",
    );
    expect(confirmInput).not.toBeNull();
    await act(async () => {
      if (confirmInput) {
        const setter = Object.getOwnPropertyDescriptor(
          HTMLInputElement.prototype,
          "value",
        )?.set;
        setter?.call(confirmInput, "RESTAURAR");
        confirmInput.dispatchEvent(new Event("input", { bubbles: true }));
      }
    });

    const restoreBtn = Array.from(document.body.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("Restaurar copia"),
    );
    expect(restoreBtn).not.toBeUndefined();

    await act(async () => {
      restoreBtn?.click();
    });
    await settle();

    expect(restoreMock).toHaveBeenCalledWith({ rawJson: validJson });
    expect(mockToastSuccess).toHaveBeenCalled();
  });
});
