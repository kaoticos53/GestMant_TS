import { describe, expect, it } from "vitest";
import { PART_CATEGORIES } from "@/lib/workshop";
import { buildPartCategoryOptions } from "@/pages/dashboard/inventory/dialogs/partForm/helpers";

describe("partFormDialogHelpers - buildPartCategoryOptions", () => {
  it("incluye todas las categorías estándar por defecto cuando el catálogo está vacío", () => {
    const options = buildPartCategoryOptions([]);
    expect(options.length).toBe(PART_CATEGORIES.length);
    for (const cat of PART_CATEGORIES) {
      expect(options).toContainEqual({ name: cat });
    }
  });

  it("añade categorías personalizadas nuevas del catálogo", () => {
    const catalog = [
      { name: "Hidráulica especializada" },
      { name: "Sensores ópticos" },
    ];
    const options = buildPartCategoryOptions(catalog);
    expect(options).toContainEqual({ name: "Hidráulica especializada" });
    expect(options).toContainEqual({ name: "Sensores ópticos" });
    expect(options.length).toBe(PART_CATEGORIES.length + 2);
  });

  it("ignora categorías duplicadas entre estándar y catálogo sin importar mayúsculas/minúsculas", () => {
    const duplicateCategory = PART_CATEGORIES[0] ?? "Mecánica";
    const catalog = [
      { name: duplicateCategory },
      { name: duplicateCategory.toLowerCase() },
      { name: duplicateCategory.toUpperCase() },
      { name: `  ${duplicateCategory}  ` },
    ];
    const options = buildPartCategoryOptions(catalog);
    const occurrences = options.filter(
      (opt) => opt.name.toLowerCase() === duplicateCategory.toLowerCase(),
    );
    expect(occurrences.length).toBe(1);
  });

  it("ignora entradas vacías o compuestas solo por espacios", () => {
    const catalog = [{ name: "" }, { name: "   " }, { name: "Robótica" }];
    const options = buildPartCategoryOptions(catalog);
    expect(options).toContainEqual({ name: "Robótica" });
    expect(options).not.toContainEqual({ name: "" });
    expect(options.length).toBe(PART_CATEGORIES.length + 1);
  });
});
