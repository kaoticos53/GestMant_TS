import { describe, expect, it } from "vitest";
import {
  filterKnownRoleKeys,
  formatHistoryStatus,
  formatRecipientsSummary,
  formatScheduleNotice,
  formatSendSuccessMessage,
  toggleRoleInList,
} from "@/pages/dashboard/weeklyReport/helpers";

describe("weeklyReportDialogHelpers", () => {
  describe("filterKnownRoleKeys", () => {
    it("conserva solo las claves que existen en la lista conocida", () => {
      const known = ["admin", "tecnico", "solicitante"];
      const keys = ["admin", "desconocido", "tecnico", "eliminado"];
      expect(filterKnownRoleKeys(keys, known)).toEqual(["admin", "tecnico"]);
    });

    it("devuelve array vacío si no hay coincidencias", () => {
      expect(filterKnownRoleKeys(["a", "b"], ["c", "d"])).toEqual([]);
    });
  });

  describe("toggleRoleInList", () => {
    it("añade una clave si checked es true y no existe", () => {
      expect(toggleRoleInList(["admin"], "tecnico", true)).toEqual([
        "admin",
        "tecnico",
      ]);
    });

    it("no duplica la clave si checked es true y ya existe", () => {
      expect(toggleRoleInList(["admin", "tecnico"], "tecnico", true)).toEqual([
        "admin",
        "tecnico",
      ]);
    });

    it("elimina la clave si checked es false", () => {
      expect(toggleRoleInList(["admin", "tecnico"], "tecnico", false)).toEqual([
        "admin",
      ]);
    });

    it("no altera la lista si checked es false y la clave no estaba", () => {
      expect(toggleRoleInList(["admin"], "tecnico", false)).toEqual(["admin"]);
    });
  });

  describe("formatScheduleNotice", () => {
    it("explica el horario cuando el resumen está habilitado", () => {
      // 1 = Lunes
      const notice = formatScheduleNotice(true, 1);
      expect(notice).toContain("Se envía los lunes por la mañana (07:00 UTC).");
    });

    it("explica el estado inactivo cuando enabled es false", () => {
      const notice = formatScheduleNotice(false, 1);
      expect(notice).toContain("Mientras esté apagado no se envía nada");
    });
  });

  describe("formatRecipientsSummary", () => {
    it("muestra mensaje de advertencia cuando no hay personas con correo", () => {
      const summary = formatRecipientsSummary([]);
      expect(summary).toBe(
        "Ninguna persona en activo de esos roles tiene correo: así no saldría el resumen.",
      );
    });

    it("formatea singular cuando solo hay un destinatario", () => {
      const summary = formatRecipientsSummary(["taller@example.com"]);
      expect(summary).toContain("1 persona recibe el resumen: taller@example.com.");
    });

    it("formatea plural cuando hay varios destinatarios", () => {
      const summary = formatRecipientsSummary([
        "taller@example.com",
        "jefe@example.com",
      ]);
      expect(summary).toContain("2 personas reciben el resumen: taller@example.com, jefe@example.com.");
    });

    it("concatena la fecha del último envío si se proporciona", () => {
      const timestamp = 1700000000000;
      const summary = formatRecipientsSummary(["taller@example.com"], timestamp);
      expect(summary).toContain("Último envío:");
    });
  });

  describe("formatSendSuccessMessage", () => {
    it("formatea singular con 1 persona", () => {
      expect(formatSendSuccessMessage(1)).toBe("Resumen enviado a 1 persona");
    });

    it("formatea plural con más de 1 persona", () => {
      expect(formatSendSuccessMessage(3)).toBe("Resumen enviado a 3 personas");
    });
  });

  describe("formatHistoryStatus", () => {
    it("formatea envío exitoso con cantidad de destinatarios", () => {
      const status = formatHistoryStatus("sent", 4);
      expect(status).toBe("Enviado a 4");
    });

    it("formatea envío no realizado cuando el estado no es sent", () => {
      const status = formatHistoryStatus("failed", 0);
      expect(status).toBe("No salió");
    });

    it("añade la fecha formateada cuando existe sentAt", () => {
      const timestamp = 1700000000000;
      const status = formatHistoryStatus("sent", 2, timestamp);
      expect(status).toContain("Enviado a 2 ·");
    });
  });
});
