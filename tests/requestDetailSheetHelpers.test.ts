import { describe, expect, it } from "vitest";
import {
  getRequestNextHint,
  getRequestNextLabel,
  getRequestNowLabel,
  resolveCanManageRequest,
} from "../src/pages/dashboard/requests/components/detail/helpers";

describe("requestDetailSheetHelpers", () => {
  describe("resolveCanManageRequest", () => {
    it("permite gestionar si canManageRequest es true y no está archivada ni retirada", () => {
      expect(resolveCanManageRequest(true, undefined, undefined)).toBe(true);
    });

    it("deshabilita la gestión si el usuario no tiene permisos", () => {
      expect(resolveCanManageRequest(false, undefined, undefined)).toBe(false);
    });

    it("deshabilita la gestión si la petición está archivada", () => {
      expect(resolveCanManageRequest(true, 1774000000000, undefined)).toBe(false);
    });

    it("deshabilita la gestión si la petición está retirada a la papelera", () => {
      expect(resolveCanManageRequest(true, undefined, 1774000000000)).toBe(false);
    });
  });

  describe("getRequestNowLabel", () => {
    it("devuelve la etiqueta base si no está retirada ni archivada", () => {
      expect(getRequestNowLabel("Pendiente", false, false)).toBe("Pendiente");
    });

    it("añade sufijo de retirada si está en la papelera", () => {
      expect(getRequestNowLabel("Pendiente", true, false)).toBe("Pendiente · retirada");
    });

    it("añade sufijo de archivo si está archivada", () => {
      expect(getRequestNowLabel("Aprobada", false, true)).toBe("Aprobada · en el archivo");
    });
  });

  describe("getRequestNextLabel", () => {
    it("devuelve null si no hay acción siguiente", () => {
      expect(getRequestNextLabel(null, false)).toBeNull();
    });

    it("devuelve texto específico de asociación si la acción es approve y no tiene referencia", () => {
      expect(getRequestNextLabel("approve", true)).toBe(
        "Asociar un repuesto y aprobarla"
      );
    });

    it("devuelve la etiqueta estándar para approve si tiene referencia", () => {
      expect(getRequestNextLabel("approve", false)).toBe("Aprobar la petición");
    });
  });

  describe("getRequestNextHint", () => {
    it("explica que está en papelera si retirada es true", () => {
      const hint = getRequestNextHint("pending", true, true, false);
      expect(hint).toContain("Retirada a la papelera");
    });

    it("explica que está en el archivo si archived es true", () => {
      const hint = getRequestNextHint("issued", true, false, true);
      expect(hint).toContain("En el archivo");
    });

    it("explica que la tramita quien gestiona si canManage es false", () => {
      const hint = getRequestNextHint("pending", false, false, false);
      expect(hint).toContain("La tramita quien gestiona los repuestos");
    });

    it("informa adecuadamente para estados clave", () => {
      expect(
        getRequestNextHint("pendingSupplierQuote", true, false, false)
      ).toContain("Presupuesto pedido al proveedor");
      expect(getRequestNextHint("issued", true, false, false)).toContain(
        "Material entregado"
      );
      expect(getRequestNextHint("returned", true, false, false)).toContain(
        "El material se devolvió"
      );
      expect(getRequestNextHint("rejected", true, false, false)).toContain(
        "Ya está cerrada"
      );
      expect(getRequestNextHint("cancelled", true, false, false)).toContain(
        "Ya está cerrada"
      );
    });
  });
});
