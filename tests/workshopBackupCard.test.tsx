// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BACKUP_FORMAT, BACKUP_VERSION } from "@/lib/backup";
import { settle } from "./settle";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const {
  mockUseAction,
  mockUseQuery,
  mockToastSuccess,
  mockToastError,
  mockProtectBackup,
} = vi.hoisted(() => ({
  mockUseAction: vi.fn(),
  mockUseQuery: vi.fn(),
  mockToastSuccess: vi.fn(),
  mockToastError: vi.fn(),
  mockProtectBackup: vi.fn(),
}));

vi.mock("convex/react", () => ({
  useAction: mockUseAction,
  useQuery: mockUseQuery,
}));

vi.mock("sonner", () => ({
  toast: {
    success: mockToastSuccess,
    error: mockToastError,
    info: vi.fn(),
  },
}));

vi.mock("@/lib/backupFile", () => ({
  MIN_BACKUP_PASSPHRASE: 10,
  isProtectedBackup: (raw: string) => {
    try {
      return (
        (JSON.parse(raw) as { format?: unknown } | null)?.format ===
        "pulso-taller-backup-file"
      );
    } catch {
      return false;
    }
  },
  protectBackup: mockProtectBackup,
  unlockBackup: vi.fn(),
}));

import { WorkshopBackupSection } from "@/pages/dashboard/settings/workshopData/components/WorkshopBackupSection";

describe("WorkshopBackupSection (Fase 3 TDD)", () => {
  let container: HTMLDivElement;
  let root: Root;
  let exportMock: ReturnType<typeof vi.fn>;
  let restoreMock: ReturnType<typeof vi.fn>;
  let undoMock: ReturnType<typeof vi.fn>;

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
      manifest: { totalRecords: 1, tableCounts: { equipment: 1 } },
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
      undoUntil: Date.now() + 10 * 60 * 1000,
    });
    undoMock = vi.fn().mockResolvedValue({ restoredRecords: 1 });

    let call = 0;
    mockUseAction.mockImplementation(() => {
      call += 1;
      if (call % 3 === 1) return exportMock;
      if (call % 3 === 2) return restoreMock;
      return undoMock;
    });
    mockUseQuery.mockReturnValue({
      active: false,
      phase: "idle",
      processedRecords: 0,
      totalRecords: 0,
      startedAt: null,
      undoAvailable: false,
      undoUntil: null,
      completedAt: null,
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
    mockProtectBackup.mockReset();
    mockProtectBackup.mockImplementation(async (raw: string) => raw);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("cifra y descarga una copia con la frase indicada", async () => {
    await act(async () => {
      root.render(<WorkshopBackupSection />);
    });
    await settle();

    const exportBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("Descargar copia cifrada (.json)"),
    );
    expect(exportBtn).not.toBeUndefined();

    await act(async () => {
      exportBtn?.click();
    });
    await settle();

    const passInput = document.body.querySelector<HTMLInputElement>(
      "#export-backup-passphrase",
    );
    const repeatInput = document.body.querySelector<HTMLInputElement>(
      "#export-backup-passphrase-repeat",
    );
    expect(passInput).not.toBeNull();
    expect(repeatInput).not.toBeNull();
    const setter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )?.set;
    await act(async () => {
      setter?.call(passInput, "frase-segura-123");
      passInput?.dispatchEvent(new Event("input", { bubbles: true }));
      setter?.call(repeatInput, "frase-segura-123");
      repeatInput?.dispatchEvent(new Event("input", { bubbles: true }));
    });

    const confirmBtn = Array.from(
      document.body.querySelectorAll("button"),
    ).find((b) => b.textContent?.trim() === "Descargar copia cifrada");
    await act(async () => {
      confirmBtn?.click();
    });
    await settle();

    expect(exportMock).toHaveBeenCalledWith({});
    expect(mockProtectBackup).toHaveBeenCalledWith(
      expect.any(String),
      "frase-segura-123",
    );
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
      manifest: { totalRecords: 1, tableCounts: { equipment: 1 } },
    });

    const input =
      container.querySelector<HTMLInputElement>("input[type='file']");
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

    const restoreBtn = Array.from(
      document.body.querySelectorAll("button"),
    ).find((b) => b.textContent?.includes("Restaurar copia"));
    expect(restoreBtn).not.toBeUndefined();

    await act(async () => {
      restoreBtn?.click();
    });
    await settle();

    expect(restoreMock).toHaveBeenCalledWith({ rawJson: validJson });
    expect(mockToastSuccess).toHaveBeenCalled();
  });

  it("estima el tiempo de restauración y avisa cuando la copia es voluminosa o grande", async () => {
    await act(async () => {
      root.render(<WorkshopBackupSection />);
    });
    await settle();

    const backupWith = (rows: number) =>
      JSON.stringify({
        format: BACKUP_FORMAT,
        version: BACKUP_VERSION,
        exportedAt: 1_700_000_000_000,
        exportedBy: "admin@taller.es",
        tables: {
          equipment: Array.from({ length: rows }, (_, i) => ({
            _id: `e${i}`,
            name: "Cámara",
          })),
        },
        manifest: {
          totalRecords: rows,
          tableCounts: { equipment: rows },
        },
      });

    const selectFile = async (rows: number) => {
      const raw = backupWith(rows);
      const input =
        container.querySelector<HTMLInputElement>("input[type='file']");
      const file = new File([raw], "backup.json", {
        type: "application/json",
      });
      Object.defineProperty(file, "text", {
        value: async () => raw,
      });
      Object.defineProperty(input, "files", {
        value: [file],
        configurable: true,
      });
      await act(async () => {
        input?.dispatchEvent(new Event("change", { bubbles: true }));
      });
      await settle();
    };

    const cancel = async () => {
      const button = Array.from(document.body.querySelectorAll("button")).find(
        (b) => b.textContent?.includes("Cancelar"),
      );
      await act(async () => {
        button?.click();
      });
      await settle();
    };

    // Muestra normal: una estimación discreta, sin aviso.
    await selectFile(1);
    expect(document.body.textContent).toContain(
      "Restauración estimada: unos 2 s",
    );
    expect(document.body.textContent).not.toContain("Copia voluminosa");
    await cancel();

    // A partir de 3 000 filas, aviso visible con el tiempo estimado.
    await selectFile(3_500);
    expect(document.body.textContent).toContain("Copia voluminosa");
    expect(document.body.textContent).toContain("unos 7 s");
    await cancel();

    // A partir de 6 000, aviso reforzado.
    await selectFile(6_500);
    expect(document.body.textContent).toContain("Copia grande");
    expect(document.body.textContent).toContain("unos 13 s o más");
  });

  it("no lanza dos restauraciones y muestra el progreso mientras dura", async () => {
    await act(async () => {
      root.render(<WorkshopBackupSection />);
    });
    await settle();

    let finishRestore:
      | ((value: { restoredRecords: number; exportedAt: number }) => void)
      | null = null;
    restoreMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          finishRestore = resolve;
        }),
    );

    const validJson = JSON.stringify({
      format: BACKUP_FORMAT,
      version: BACKUP_VERSION,
      exportedAt: 1_700_000_000_000,
      exportedBy: "admin@taller.es",
      tables: {
        equipment: [{ _id: "e1", name: "Cam", model: "M1" }],
      },
      manifest: { totalRecords: 1, tableCounts: { equipment: 1 } },
    });
    const input =
      container.querySelector<HTMLInputElement>("input[type='file']");
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

    const confirmInput = document.body.querySelector<HTMLInputElement>(
      "#restore-confirm-input",
    );
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

    const restoreBtn = Array.from(
      document.body.querySelectorAll("button"),
    ).find((b) => b.textContent?.includes("Restaurar copia")) as
      HTMLButtonElement | undefined;
    expect(restoreBtn).not.toBeUndefined();

    await act(async () => {
      restoreBtn?.click();
    });
    await settle();

    // Mientras dura: una sola llamada, botón deshabilitado, progreso a la vista
    // y la palabra de confirmación intacta (si falla, se puede reintentar).
    expect(restoreMock).toHaveBeenCalledTimes(1);
    expect(restoreBtn?.disabled).toBe(true);
    expect(document.body.textContent).toContain("Restaurando la copia");
    expect(confirmInput?.value).toBe("RESTAURAR");
    expect(confirmInput?.disabled).toBe(true);

    await act(async () => {
      restoreBtn?.click();
    });
    await settle();
    expect(restoreMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      finishRestore?.({ restoredRecords: 1, exportedAt: 1_700_000_000_000 });
    });
    await settle();
    expect(document.body.textContent).not.toContain(
      "Confirmar restauración de copia",
    );
    expect(mockToastSuccess).toHaveBeenCalled();
  });

  it("muestra la fase y el avance de una restauración larga", async () => {
    mockUseQuery.mockReturnValue({
      active: true,
      phase: "inserting",
      processedRecords: 40,
      totalRecords: 120,
      startedAt: 1_700_000_000_000,
      undoAvailable: false,
      undoUntil: null,
      completedAt: null,
    });

    await act(async () => {
      root.render(<WorkshopBackupSection />);
    });
    await settle();

    expect(document.body.textContent).toContain("Insertando registros");
    expect(document.body.textContent).toContain("40 de 120 registros");
    expect(document.body.textContent).toContain("No cierres la pestaña");
  });

  it("ofrece deshacer una restauración terminada", async () => {
    mockUseQuery.mockReturnValue({
      active: false,
      phase: "completed",
      processedRecords: 1,
      totalRecords: 1,
      startedAt: 1_700_000_000_000,
      undoAvailable: true,
      undoUntil: Date.now() + 10 * 60 * 1000,
      completedAt: 1_700_000_000_000,
    });

    await act(async () => {
      root.render(<WorkshopBackupSection />);
    });
    await settle();

    expect(document.body.textContent).toContain("Restauración completada");
    const undoButtons = Array.from(
      document.body.querySelectorAll("button"),
    ).filter((button) => button.textContent?.includes("Deshacer restauración"));
    expect(undoButtons).toHaveLength(1);

    await act(async () => {
      undoButtons[0]?.click();
    });
    await settle();

    expect(document.body.textContent).toContain(
      "Deshacer la última restauración",
    );
    const confirmButtons = Array.from(
      document.body.querySelectorAll("button"),
    ).filter((button) => button.textContent?.includes("Deshacer restauración"));
    await act(async () => {
      confirmButtons.at(-1)?.click();
    });
    await settle();

    expect(undoMock).toHaveBeenCalledWith({});
    expect(mockToastSuccess).toHaveBeenCalled();
  });
});
