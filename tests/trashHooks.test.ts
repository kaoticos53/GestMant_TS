import { describe, expect, it } from "vitest";
import {
  DEFAULT_TRASH_RETENTION_DAYS,
  MAX_TRASH_RETENTION_DAYS,
  MIN_TRASH_RETENTION_DAYS,
} from "@/lib/trash";
import type { DeletingEntity, TrashFilter } from "@/pages/dashboard/settings/trash/types";

describe("Trash Module Types & Validation Rules", () => {
  it("respeta las constantes de retención del dominio", () => {
    expect(MIN_TRASH_RETENTION_DAYS).toBeGreaterThanOrEqual(1);
    expect(MAX_TRASH_RETENTION_DAYS).toBeGreaterThan(MIN_TRASH_RETENTION_DAYS);
    expect(DEFAULT_TRASH_RETENTION_DAYS).toBeGreaterThanOrEqual(MIN_TRASH_RETENTION_DAYS);
    expect(DEFAULT_TRASH_RETENTION_DAYS).toBeLessThanOrEqual(MAX_TRASH_RETENTION_DAYS);
  });

  it("valida rangos numéricos enteros para el plazo de la papelera", () => {
    const isValidDays = (raw: string): boolean => {
      const val = Number(raw);
      return (
        raw.trim() !== "" &&
        Number.isInteger(val) &&
        val >= MIN_TRASH_RETENTION_DAYS &&
        val <= MAX_TRASH_RETENTION_DAYS
      );
    };

    expect(isValidDays("30")).toBe(true);
    expect(isValidDays(String(MIN_TRASH_RETENTION_DAYS))).toBe(true);
    expect(isValidDays(String(MAX_TRASH_RETENTION_DAYS))).toBe(true);
    expect(isValidDays("0")).toBe(false);
    expect(isValidDays("-5")).toBe(false);
    expect(isValidDays("9999")).toBe(false);
    expect(isValidDays("30.5")).toBe(false);
    expect(isValidDays("")).toBe(false);
    expect(isValidDays("abc")).toBe(false);
  });

  it("permite discriminar correctamente las entidades de borrado DeletingEntity", () => {
    const incidentEntity: DeletingEntity = {
      type: "incident",
      item: {
        id: "inc_1" as never,
        reference: "INC-001",
        status: "reported",
        title: "Fallo motor",
        description: "Detalle",
        equipmentKind: "Motor",
        deletedAt: Date.now(),
        purgeAt: Date.now() + 86400000,
      } as never,
    };

    const requestEntity: DeletingEntity = {
      type: "request",
      item: {
        id: "req_1" as never,
        reference: "PET-001",
        status: "pending",
        incidentReference: "INC-001",
        title: "Rodamiento",
        deletedAt: Date.now(),
        purgeAt: Date.now() + 86400000,
      } as never,
    };

    const storageEntity: DeletingEntity = {
      type: "storage",
      item: {
        id: "st_1" as never,
        size: 2048,
        contentType: "image/png",
        kind: "image",
        url: "https://example.com/test.png",
        fromForm: false,
        kept: false,
        purgeAt: Date.now() + 86400000,
      } as never,
    };

    expect(incidentEntity.type).toBe("incident");
    expect(requestEntity.type).toBe("request");
    expect(storageEntity.type).toBe("storage");
  });

  it("soporta todas las opciones del filtro de papelera TrashFilter", () => {
    const filters: TrashFilter[] = ["all", "incidents", "requests", "storage"];
    expect(filters).toHaveLength(4);
    expect(filters.includes("all")).toBe(true);
  });
});
