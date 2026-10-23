import { describe, expect, it } from "vitest";
import {
  ESTADO_ENTREGA_OPTIONS,
  FECHA_TIPO_OPTIONS,
  getEstadoEntregaLabel,
  getFechaTipoLabel,
} from "@/pages/dashboard/purchasing/components/history/drawer/helpers";

describe("historyFilterDrawer helpers", () => {
  describe("FECHA_TIPO_OPTIONS", () => {
    it("contiene las 3 opciones de criterio de fecha", () => {
      expect(FECHA_TIPO_OPTIONS).toHaveLength(3);
      expect(FECHA_TIPO_OPTIONS.map((o) => o.value)).toEqual([
        "pedido",
        "recepcion",
        "ambas",
      ]);
    });

    it("resuelve las etiquetas correctas de fecha con getFechaTipoLabel", () => {
      expect(getFechaTipoLabel("pedido")).toBe("Fecha de pedido (F. PEDIDO)");
      expect(getFechaTipoLabel("recepcion")).toBe(
        "Fecha de recepción (F. RECEP.)",
      );
      expect(getFechaTipoLabel("ambas")).toBe("Cualquiera de las dos");
      expect(getFechaTipoLabel("desconocido")).toBe(
        "Fecha de pedido (F. PEDIDO)",
      );
    });
  });

  describe("ESTADO_ENTREGA_OPTIONS", () => {
    it("contiene los 4 estados de entrega posibles", () => {
      expect(ESTADO_ENTREGA_OPTIONS).toHaveLength(4);
      expect(ESTADO_ENTREGA_OPTIONS.map((o) => o.value)).toEqual([
        "todos",
        "pendientes",
        "recibidos",
        "parciales",
      ]);
    });

    it("resuelve las etiquetas correctas de estado de entrega con getEstadoEntregaLabel", () => {
      expect(getEstadoEntregaLabel("todos")).toBe("Todos los estados");
      expect(getEstadoEntregaLabel("pendientes")).toBe(
        "Pendientes (con piezas por recibir)",
      );
      expect(getEstadoEntregaLabel("recibidos")).toBe(
        "Completados (todo recibido)",
      );
      expect(getEstadoEntregaLabel("parciales")).toBe("Recibidos parcialmente");
      expect(getEstadoEntregaLabel("otro")).toBe("Todos los estados");
    });
  });
});
