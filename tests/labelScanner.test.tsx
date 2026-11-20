// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { EquipmentLabelExtraction } from "@/lib/ai";
import { settle } from "./settle";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const {
  mockUseQuery,
  mockUseAction,
  mockUseIsMobile,
  mockCompressImageFile,
  mockPreScanBarcodes,
  mockToastError,
} = vi.hoisted(() => ({
  mockUseQuery: vi.fn(),
  mockUseAction: vi.fn(),
  mockUseIsMobile: vi.fn(),
  mockCompressImageFile: vi.fn(),
  mockPreScanBarcodes: vi.fn(),
  mockToastError: vi.fn(),
}));

vi.mock("convex/react", () => ({
  useQuery: mockUseQuery,
  useAction: mockUseAction,
}));

vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: mockUseIsMobile,
}));

vi.mock("@/lib/imageCompress", () => ({
  compressImageFile: mockCompressImageFile,
}));

vi.mock("@/components/ai/barcodePreScan", () => ({
  preScanBarcodes: mockPreScanBarcodes,
}));

vi.mock("sonner", () => ({
  toast: {
    error: mockToastError,
    success: vi.fn(),
  },
}));

import { EquipmentLabelScanner } from "@/components/ai/EquipmentLabelScanner";

function makeExtraction(
  overrides: Partial<EquipmentLabelExtraction> = {},
): EquipmentLabelExtraction {
  return {
    brand: "LG",
    model: "50UM7600PLB",
    serialNumber: "912MAYY5H530",
    equipmentKind: "Televisor",
    confidence: "high",
    evidence: "LG 50UM7600PLB SERIAL NO.: 912MAYY5H530",
    alternatives: ["50UM7600PLB.BEUSLJP"],
    warnings: [],
    catalogMatch: {
      model: "50UM7600PLB",
      brand: "LG",
      equipmentKind: "Televisor",
    },
    ...overrides,
  };
}

class MockFileReader {
  result: string | ArrayBuffer | null = "data:image/jpeg;base64,ZmFrZQ==";
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  readAsDataURL() {
    this.onload?.();
  }
}

async function selectFile(container: HTMLElement) {
  const input = container.querySelector<HTMLInputElement>("input[type='file']");
  expect(input).not.toBeNull();
  const file = new File(["fake-bytes"], "etiqueta.jpg", { type: "image/jpeg" });
  Object.defineProperty(input, "files", {
    value: [file],
    configurable: true,
  });
  await act(async () => {
    input?.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await settle();
}

describe("EquipmentLabelScanner", () => {
  let container: HTMLDivElement;
  let root: Root;
  let extractMock: ReturnType<typeof vi.fn>;
  let originalFileReader: typeof FileReader;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    originalFileReader = globalThis.FileReader;
    globalThis.FileReader = MockFileReader as unknown as typeof FileReader;

    extractMock = vi.fn().mockResolvedValue(makeExtraction());
    mockUseAction.mockReturnValue(extractMock);
    mockUseQuery.mockReturnValue({ available: true });
    mockUseIsMobile.mockReturnValue(false);
    mockPreScanBarcodes.mockResolvedValue(["912MAYY5H530"]);
    mockCompressImageFile.mockImplementation(async (f: File) => f);
    mockToastError.mockClear();
  });

  afterEach(async () => {
    globalThis.FileReader = originalFileReader;
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("no se renderiza si el usuario no está autenticado", async () => {
    const onApply = vi.fn();
    await act(async () => {
      root.render(
        <EquipmentLabelScanner isAuthenticated={false} onApply={onApply} />,
      );
    });
    await settle();

    expect(container.textContent).toBe("");
    expect(container.querySelector("button")).toBeNull();
  });

  it("no se renderiza si la IA no está disponible", async () => {
    mockUseQuery.mockReturnValue({ available: false });
    const onApply = vi.fn();
    await act(async () => {
      root.render(
        <EquipmentLabelScanner isAuthenticated={true} onApply={onApply} />,
      );
    });
    await settle();

    expect(container.textContent).toBe("");
  });

  it("en escritorio abre el diálogo de revisión lado a lado y aplica al confirmar", async () => {
    mockUseIsMobile.mockReturnValue(false);
    const onApply = vi.fn();

    await act(async () => {
      root.render(
        <EquipmentLabelScanner isAuthenticated={true} onApply={onApply} />,
      );
    });
    await settle();

    await selectFile(container);

    expect(extractMock).toHaveBeenCalledWith({
      imageDataUrl: "data:image/jpeg;base64,ZmFrZQ==",
      detectedBarcodes: ["912MAYY5H530"],
    });
    // No se aplica antes de confirmar en escritorio
    expect(onApply).not.toHaveBeenCalled();

    // El diálogo de Radix se monta en document.body
    expect(document.body.textContent).toContain("Revisar datos de la etiqueta");
    expect(document.body.textContent).toContain("Confianza alta");
    expect(document.body.textContent).toContain(
      "LG 50UM7600PLB SERIAL NO.: 912MAYY5H530",
    );
    expect(document.body.textContent).toContain("Coincide con catálogo");

    // Rotar 90°
    const rotateBtn = Array.from(document.body.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("Rotar 90°"),
    );
    expect(rotateBtn).not.toBeUndefined();
    await act(async () => {
      rotateBtn?.click();
    });

    // Seleccionar alternativa
    const altBtn = Array.from(document.body.querySelectorAll("button")).find(
      (b) => b.textContent?.trim() === "50UM7600PLB.BEUSLJP",
    );
    expect(altBtn).not.toBeUndefined();
    await act(async () => {
      altBtn?.click();
    });

    // Confirmar y aplicar
    const confirmBtn = Array.from(
      document.body.querySelectorAll("button"),
    ).find((b) => b.textContent?.includes("Confirmar y aplicar"));
    expect(confirmBtn).not.toBeUndefined();
    await act(async () => {
      confirmBtn?.click();
    });
    await settle();

    expect(onApply).toHaveBeenCalledWith({
      brand: "LG",
      model: "50UM7600PLB.BEUSLJP",
      serialNumber: "912MAYY5H530",
      equipmentKind: "Televisor",
    });
  });

  it("en móvil pre-rellena en línea y muestra el banner con Confirmar y Deshacer", async () => {
    mockUseIsMobile.mockReturnValue(true);
    const onApply = vi.fn();
    const onUndo = vi.fn();

    await act(async () => {
      root.render(
        <EquipmentLabelScanner
          isAuthenticated={true}
          onApply={onApply}
          onUndo={onUndo}
        />,
      );
    });
    await settle();

    await selectFile(container);

    // En móvil se aplica inmediatamente
    expect(onApply).toHaveBeenCalledWith({
      brand: "LG",
      model: "50UM7600PLB",
      serialNumber: "912MAYY5H530",
      equipmentKind: "Televisor",
    });
    expect(container.textContent).toContain("Detectado por IA · Verificar");
    expect(document.body.textContent).not.toContain(
      "Revisar datos de la etiqueta",
    );

    // Deshacer
    const undoBtn = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Deshacer"),
    );
    expect(undoBtn).not.toBeUndefined();
    await act(async () => {
      undoBtn?.click();
    });

    expect(onUndo).toHaveBeenCalledTimes(1);
    expect(container.textContent).not.toContain("Detectado por IA · Verificar");
  });
});
