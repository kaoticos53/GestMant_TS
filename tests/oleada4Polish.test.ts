import { describe, expect, test } from "vitest";
import { findExactCodeMatch } from "../src/lib/codeLookup";
import { canUseFastDateWindow } from "../src/lib/mailClient/listView";
import { stockAdjustMessage } from "../src/lib/stockToasts";
import {
  filterManualsWithSpecialRules,
  matchesManualKind,
} from "../src/pages/dashboard/manuals/hooks/useManualsListState";
import type { ManualDoc } from "../src/pages/dashboard/manuals/types";
import {
  INITIAL_AI_FORM_DATA,
  isAiFormDirty,
} from "../src/pages/dashboard/settings/ai/hooks/useAiSettingsForm";

describe("Oleada 4 · coincidencia exacta de código (QR / pistola)", () => {
  const equipment = [
    { id: "a", code: "EQ-CAM-0042", serialNumber: "SN-1" },
    { id: "b", code: "EQ-CAM-0043", serialNumber: "SN-2" },
    { id: "c", code: undefined, serialNumber: "SN-3" },
  ];
  const codesOf = (item: (typeof equipment)[number]) => [
    item.code,
    item.serialNumber,
  ];

  test("encuentra el único elemento sin distinguir mayúsculas ni espacios", () => {
    expect(findExactCodeMatch(equipment, "  eq-cam-0042 ", codesOf)?.id).toBe(
      "a",
    );
    expect(findExactCodeMatch(equipment, "SN-3", codesOf)?.id).toBe("c");
  });

  test("no abre nada con texto vacío, parcial o ambiguo", () => {
    expect(findExactCodeMatch(equipment, "", codesOf)).toBeNull();
    expect(findExactCodeMatch(equipment, "EQ-CAM", codesOf)).toBeNull();
    const duplicated = [...equipment, { id: "d", code: "EQ-CAM-0042", serialNumber: "X" }];
    expect(findExactCodeMatch(duplicated, "EQ-CAM-0042", codesOf)).toBeNull();
  });
});

describe("Oleada 4 · aviso de ajuste rápido de stock", () => {
  test("describe el signo y el código", () => {
    expect(stockAdjustMessage("ALI-24015", 1)).toBe("+1 en ALI-24015");
    expect(stockAdjustMessage("ALI-24015", -1)).toBe("−1 en ALI-24015");
  });
});

describe("Oleada 4 · filtro de clase de manual", () => {
  const manuals = [
    { _id: "m1", kind: "file", title: "Manual A" },
    { _id: "m2", kind: "note", title: "Nota mía", authorId: "u1" },
    { _id: "m3", kind: "note", title: "Nota ajena", authorId: "u2" },
  ] as unknown as ManualDoc[];

  const base = {
    query: "",
    type: "all",
    brand: "all",
    model: "all",
    equipmentFilter: "all",
  };

  test("matchesManualKind distingue PDF, notas y mis notas", () => {
    expect(matchesManualKind(manuals[0], "file", "u1")).toBe(true);
    expect(matchesManualKind(manuals[0], "note", "u1")).toBe(false);
    expect(matchesManualKind(manuals[1], "mine", "u1")).toBe(true);
    expect(matchesManualKind(manuals[2], "mine", "u1")).toBe(false);
    expect(matchesManualKind(manuals[1], "mine", null)).toBe(false);
    expect(matchesManualKind(manuals[2], "all", null)).toBe(true);
  });

  test("filterManualsWithSpecialRules aplica la clase si se indica", () => {
    expect(filterManualsWithSpecialRules(manuals, base)).toHaveLength(3);
    expect(
      filterManualsWithSpecialRules(manuals, { ...base, kind: "file" }).map(
        (m) => m._id,
      ),
    ).toEqual(["m1"]);
    expect(
      filterManualsWithSpecialRules(manuals, {
        ...base,
        kind: "mine",
        currentUserId: "u1",
      }).map((m) => m._id),
    ).toEqual(["m2"]);
  });
});

describe("Oleada 4 · filtros rápidos del buzón", () => {
  test("«Sin leer» y «Con adjuntos» desactivan la ventana rápida por fecha", () => {
    expect(canUseFastDateWindow({})).toBe(true);
    expect(canUseFastDateWindow({ unreadOnly: true })).toBe(false);
    expect(canUseFastDateWindow({ withAttachments: true })).toBe(false);
    expect(
      canUseFastDateWindow({ unreadOnly: false, withAttachments: false }),
    ).toBe(true);
  });
});

describe("Oleada 4 · cambios sin guardar en la IA", () => {
  test("detecta cambios reales y la clave nueva", () => {
    const saved = { ...INITIAL_AI_FORM_DATA, allowedRoles: ["admin", "manager"] };
    expect(isAiFormDirty({ ...saved }, saved)).toBe(false);
    expect(
      isAiFormDirty({ ...saved, allowedRoles: ["manager", "admin"] }, saved),
    ).toBe(false);
    expect(isAiFormDirty({ ...saved, enabled: !saved.enabled }, saved)).toBe(
      true,
    );
    expect(isAiFormDirty({ ...saved, apiKey: "sk-nueva" }, saved)).toBe(true);
    expect(isAiFormDirty({ ...saved, clearApiKey: true }, saved)).toBe(true);
  });
});
