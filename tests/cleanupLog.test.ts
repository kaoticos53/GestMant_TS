import { describe, expect, test } from "vitest";

import {
  AUTO_CLEANUP_BY,
  CLEANUP_PASSES,
  CLEANUP_PASS_META,
  REMOVAL_PASSES,
  cleanupCount,
  cleanupTicketsLabel,
  uploadSweepAlert,
} from "../src/lib/cleanupLog";
import { DEFAULT_TRASH_RETENTION_DAYS } from "../src/lib/trash";

describe("las pasadas de limpieza del almacén", () => {
  test("son tres y cada una tiene su nombre a la vista", () => {
    // Las dos que retiran archivos —lo que dejan va a la papelera— y la tercera,
    // que es la que la vacía.
    expect(REMOVAL_PASSES).toEqual(["reportUploads", "orphanFiles"]);
    expect(CLEANUP_PASSES).toEqual([...REMOVAL_PASSES, "trash"]);
    for (const pass of CLEANUP_PASSES) {
      expect(CLEANUP_PASS_META[pass].label).toBeTruthy();
    }
    // La firma de la automática no puede confundirse con una persona.
    expect(AUTO_CLEANUP_BY).toBe("Limpieza automática");
  });

  test("lo que retiró una pasada se escribe con su plural", () => {
    expect(cleanupCount("reportUploads", 1)).toBe("1 imagen");
    expect(cleanupCount("reportUploads", 3)).toBe("3 imágenes");
    expect(cleanupCount("orphanFiles", 0)).toBe("0 archivos");
    expect(cleanupCount("orphanFiles", 1)).toBe("1 archivo");
    expect(cleanupCount("trash", 2)).toBe("2 archivos");
  });

  test("los vales sin archivo que se van con ellas, también", () => {
    expect(cleanupTicketsLabel(1)).toBe("1 vale sin archivo");
    expect(cleanupTicketsLabel(2)).toBe("2 vales sin archivo");
  });
});

/** El aviso, con unos valores de partida: nada pendiente y una sola tanda. */
function aviso(over: Partial<Parameters<typeof uploadSweepAlert>[0]> = {}) {
  return uploadSweepAlert({
    images: 0,
    tickets: 0,
    bytes: 0,
    partial: false,
    retentionDays: DEFAULT_TRASH_RETENTION_DAYS,
    ...over,
  });
}

describe("el aviso de lo que la limpieza se lleva del formulario público", () => {
  test("sin nada que barrer no avisa: un aviso que no cuenta nada es ruido", () => {
    expect(aviso()).toBeNull();
    // Y tampoco cuando no hay fotos pero sí vales sin archivo: eso sí se cuenta.
    expect(aviso({ tickets: 1 })).not.toBeNull();
  });

  test("cuenta lo pendiente y que lo retirado espera en la papelera", () => {
    expect(aviso({ images: 1, bytes: 2 * 1024 * 1024 })).toBe(
      "La limpieza de esta noche se lleva del formulario público 1 imagen sin usar (2 MB). Lo retirado queda 7 días en la papelera, por si hay que recuperarlo. Lo puedes revisar en Ajustes del taller.",
    );
  });

  test("las fotos y los vales sin archivo van en la misma cuenta", () => {
    expect(aviso({ images: 3, tickets: 1, bytes: 4.5 * 1024 * 1024 })).toBe(
      "La limpieza de esta noche se lleva del formulario público 3 imágenes sin usar (4,5 MB) y 1 vale sin archivo. Lo retirado queda 7 días en la papelera, por si hay que recuperarlo. Lo puedes revisar en Ajustes del taller.",
    );
  });

  test("un vale sin archivo no deja nada en la papelera: no se habla de plazo", () => {
    expect(aviso({ tickets: 2 })).toBe(
      "La limpieza de esta noche se lleva del formulario público 2 vales sin archivo. Lo puedes revisar en Ajustes del taller.",
    );
  });

  test("cuando la pasada va por tandas lo dice: no es lo mismo que «esto es todo»", () => {
    expect(aviso({ images: 2, bytes: 1024 * 1024, partial: true })).toBe(
      "La limpieza de esta noche se lleva del formulario público 2 imágenes sin usar (1 MB). Lo retirado queda 7 días en la papelera, por si hay que recuperarlo. La limpieza va por tandas: quedan más para la noche siguiente. Lo puedes revisar en Ajustes del taller.",
    );
  });

  test("el plazo que cita es el vigente, no el de partida", () => {
    expect(aviso({ images: 1, bytes: 1024, retentionDays: 30 })).toBe(
      "La limpieza de esta noche se lleva del formulario público 1 imagen sin usar (1 KB). Lo retirado queda 30 días en la papelera, por si hay que recuperarlo. Lo puedes revisar en Ajustes del taller.",
    );
  });
});
