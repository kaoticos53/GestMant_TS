import { describe, expect, it, vi } from "vitest";
import {
  DEFAULT_BARCODE_FORMATS,
  cleanScannedCode,
  createBarcodeDetector,
  isBarcodeDetectorSupported,
  triggerScanHapticFeedback,
} from "@/components/barcode/helpers";

describe("barcodeScannerHelpers", () => {
  describe("DEFAULT_BARCODE_FORMATS", () => {
    it("incluye qr_code y los principales estándares industriales de código de barras", () => {
      expect(DEFAULT_BARCODE_FORMATS).toEqual([
        "qr_code",
        "code_128",
        "code_39",
        "ean_13",
        "ean_8",
        "data_matrix",
      ]);
    });
  });

  describe("cleanScannedCode", () => {
    it("elimina espacios en blanco alrededor del código", () => {
      expect(cleanScannedCode("  EQ-CAM-0042  ")).toBe("EQ-CAM-0042");
      expect(cleanScannedCode("\nREP-123\t")).toBe("REP-123");
    });

    it("mantiene códigos limpios sin modificar", () => {
      expect(cleanScannedCode("EQ-100")).toBe("EQ-100");
    });
  });

  describe("isBarcodeDetectorSupported", () => {
    it("devuelve false si el objeto window no existe o no tiene BarcodeDetector", () => {
      expect(isBarcodeDetectorSupported(undefined)).toBe(false);
      expect(isBarcodeDetectorSupported(null)).toBe(false);
      expect(isBarcodeDetectorSupported({})).toBe(false);
      expect(isBarcodeDetectorSupported({ BarcodeDetector: "not-a-func" })).toBe(false);
    });

    it("devuelve true si BarcodeDetector es una función", () => {
      const mockWindow = { BarcodeDetector: vi.fn() };
      expect(isBarcodeDetectorSupported(mockWindow)).toBe(true);
    });
  });

  describe("createBarcodeDetector", () => {
    it("devuelve null si no está soportado", () => {
      expect(createBarcodeDetector(DEFAULT_BARCODE_FORMATS, {})).toBeNull();
    });

    it("crea la instancia pasando los formatos correspondientes", () => {
      const MockDetector = vi.fn();
      const mockWindow = { BarcodeDetector: MockDetector };

      createBarcodeDetector(["qr_code"], mockWindow);

      expect(MockDetector).toHaveBeenCalledWith({ formats: ["qr_code"] });
    });

    it("captura errores de constructor y devuelve null de forma segura", () => {
      const MockDetector = vi.fn(function () {
        throw new Error("Formato inválido");
      });
      const mockWindow = { BarcodeDetector: MockDetector };

      expect(createBarcodeDetector(["qr_code"], mockWindow)).toBeNull();
    });
  });

  describe("triggerScanHapticFeedback", () => {
    it("invoca navigator.vibrate con el patrón especificado", () => {
      const mockVibrate = vi.fn();
      const mockNav = { vibrate: mockVibrate };

      triggerScanHapticFeedback([40, 30, 40], mockNav);

      expect(mockVibrate).toHaveBeenCalledWith([40, 30, 40]);
    });

    it("no lanza excepción si navigator no tiene vibrate o si falla", () => {
      expect(() => triggerScanHapticFeedback([40], {})).not.toThrow();

      const failingNav = {
        vibrate: vi.fn().mockImplementation(() => {
          throw new Error("Hardware error");
        }),
      };
      expect(() => triggerScanHapticFeedback([40], failingNav)).not.toThrow();
    });
  });
});
