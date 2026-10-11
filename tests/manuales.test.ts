import { convexTest } from "convex-test";
import { ConvexError } from "convex/values";
import { describe, expect, test } from "vitest";
import { api } from "../src/convex/_generated/api";
import type { Id } from "../src/convex/_generated/dataModel";
import schema from "../src/convex/schema";
import {
  MANUAL_TYPES,
  canDeleteManual,
  canEditManual,
  changedManualFields,
  filterManuals,
  isPdfFile,
  manualBrands,
  manualChangeLabels,
  manualChangeSummary,
  manualClassification,
  manualCountForEquipment,
  manualFileVersions,
  manualHistory,
  manualModels,
  manualScopeLabel,
  manualTitleFromFile,
  manualsForEquipment,
} from "../src/lib/manuals";
import { MAX_FILE_SIZE } from "../src/lib/upload";

/** Todos los módulos de funciones de la app (convex-test los levanta in-process). */
const modules = import.meta.glob("../src/convex/**/!(*.*.*)*.*s");

type Test = ReturnType<typeof convexTest>;
type Authed = ReturnType<Test["withIdentity"]>;

/** Lanza la promesa y comprueba que el ConvexError contiene el texto. */
async function expectConvexError(promise: Promise<unknown>, fragment: string) {
  const error = await promise.then(
    () => null,
    (err: unknown) => err,
  );
  expect(
    error,
    `Se esperaba un error que contuviera: ${fragment}`,
  ).not.toBeNull();
  const message =
    error instanceof ConvexError ? String(error.data) : String(error);
  expect(message).toContain(fragment);
}

/** Da de alta un usuario del taller y devuelve su sesión. */
async function addUser(
  t: Test,
  role: "admin" | "manager" | "technician",
  name: string,
): Promise<Authed> {
  const userId = await t.run((ctx) =>
    ctx.db.insert("users", {
      name,
      email: `${name
        .normalize("NFD")
        .replace(/[^a-zA-Z]+/g, "-")
        .toLowerCase()}@taller.es`,
      role,
    }),
  );
  return t.withIdentity({ subject: `${userId}|session1` });
}

/** Instancia de test con una sesión del taller del rol indicado. */
async function authedTest(role: "admin" | "manager" | "technician") {
  const t = convexTest(schema, modules);
  const authed = await addUser(t, role, `Prueba ${role}`);
  return { t, authed };
}

/** Un PDF de mentira en el almacén, como el que sube el navegador. */
async function storedFile(
  t: Test,
  body = "%PDF-1.4 manual",
  type = "application/pdf",
): Promise<Id<"_storage">> {
  return await t.run((ctx) => ctx.storage.store(new Blob([body], { type })));
}

async function seedEquipment(
  t: Test,
  overrides: {
    code?: string;
    brand?: string;
    model?: string;
    name?: string;
  } = {},
) {
  return await t.run((ctx) =>
    ctx.db.insert("equipment", {
      code: overrides.code ?? "EQ-001",
      brand: overrides.brand ?? "Sony",
      name: overrides.name ?? "Cámara de estudio",
      model: overrides.model ?? "HDC-3500",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }),
  );
}

/** El alta de un manual de archivo, con lo que se cambia en cada prueba. */
const archivoArgs = {
  title: "Manual de servicio HDC-3500",
  kind: "file" as const,
  type: "Manual de servicio",
  brand: "Sony",
  model: "HDC-3500",
};

describe("manuales: la ficha y su clasificación", () => {
  test("un tipo de fuera del catálogo no vale", async () => {
    const { t, authed } = await authedTest("manager");
    await expectConvexError(
      authed.mutation(api.manuals.create, {
        ...archivoArgs,
        type: "Manual de lo que sea",
        storageId: await storedFile(t),
        fileName: "HDC-3500.pdf",
      }),
      "no está en el catálogo",
    );
  });

  test("un manual de archivo guarda su PDF, su tipo y su clasificación", async () => {
    const { t, authed } = await authedTest("manager");
    await authed.mutation(api.manuals.create, {
      ...archivoArgs,
      storageId: await storedFile(t),
      fileName: "HDC-3500.pdf",
    });

    const list = await authed.query(api.manuals.list, {});
    expect(list).toHaveLength(1);
    expect(list[0].title).toBe("Manual de servicio HDC-3500");
    expect(list[0].kind).toBe("file");
    expect(list[0].type).toBe("Manual de servicio");
    expect(list[0].brand).toBe("Sony");
    expect(list[0].model).toBe("HDC-3500");
    expect(list[0].fileName).toBe("HDC-3500.pdf");
    expect(list[0].size).toBeGreaterThan(0);
    // La lista resuelve la dirección con la que se abre el archivo.
    expect(list[0].url).toContain("api/storage/");
  });

  test("asignado a un equipo, hereda su marca y su modelo", async () => {
    const { t, authed } = await authedTest("manager");
    const equipmentId = await seedEquipment(t, {
      brand: "Panasonic",
      model: "AW-UE150",
    });
    await authed.mutation(api.manuals.create, {
      title: "Manual de usuario AW-UE150",
      kind: "file",
      type: "Manual de usuario",
      equipmentId,
      storageId: await storedFile(t),
      fileName: "AW-UE150.pdf",
    });

    const list = await authed.query(api.manuals.list, {});
    expect(list[0].equipmentId).toBe(equipmentId);
    expect(list[0].brand).toBe("Panasonic");
    expect(list[0].model).toBe("AW-UE150");
  });

  test("una nota escrita desde la ficha del equipo nace asignada a él", async () => {
    const { t, authed } = await authedTest("manager");
    const equipmentId = await seedEquipment(t, {
      brand: "Grass Valley",
      model: "K2 Summit",
      name: "Servidor de vídeo",
    });
    // Es lo que manda el formulario cuando se abre desde la ficha: el equipo
    // viene ya elegido y sin marca ni modelo escritos.
    await authed.mutation(api.manuals.create, {
      title: "Arranque del servidor",
      kind: "note",
      type: "Procedimiento interno",
      equipmentId,
      notes: "<p>Arrancar en el orden del manual, no en el de la etiqueta.</p>",
    });

    const list = await authed.query(api.manuals.list, {});
    expect(list[0].brand).toBe("Grass Valley");
    expect(list[0].model).toBe("K2 Summit");
    // Y cuenta como suyo en la ficha del equipo, no como manual del modelo.
    const { assigned, byModel } = manualsForEquipment(list, {
      _id: equipmentId,
      brand: "Grass Valley",
      model: "K2 Summit",
    });
    expect(assigned.map((manual) => manual.title)).toEqual([
      "Arranque del servidor",
    ]);
    expect(byModel).toHaveLength(0);
  });

  test("rechaza un archivo que no es un PDF", async () => {
    const { t, authed } = await authedTest("manager");
    await expectConvexError(
      authed.mutation(api.manuals.create, {
        ...archivoArgs,
        storageId: await storedFile(t, "no soy un pdf", "image/png"),
        fileName: "foto.png",
      }),
      "se carga en PDF",
    );
  });

  test("rechaza un manual que pase del límite de tamaño", async () => {
    const { t, authed } = await authedTest("manager");
    const grande = new Uint8Array(MAX_FILE_SIZE + 1);
    const storageId = await t.run((ctx) =>
      ctx.storage.store(new Blob([grande], { type: "application/pdf" })),
    );
    await expectConvexError(
      authed.mutation(api.manuals.create, {
        ...archivoArgs,
        storageId,
        fileName: "enorme.pdf",
      }),
      "puede pesar como mucho",
    );
  });

  test("sin título, se propone el nombre del archivo", async () => {
    const { t, authed } = await authedTest("manager");
    await authed.mutation(api.manuals.create, {
      title: "",
      kind: "file",
      type: "Ficha técnica",
      storageId: await storedFile(t),
      fileName: "HDC-3500_servicio.pdf",
    });
    const list = await authed.query(api.manuals.list, {});
    expect(list[0].title).toBe("HDC 3500 servicio");
  });

  test("un manual puede quedarse sin equipo y un equipo sin manuales", async () => {
    const { t, authed } = await authedTest("manager");
    await seedEquipment(t);
    await authed.mutation(api.manuals.create, {
      title: "Puesta en marcha de la cámara",
      kind: "note",
      type: "Procedimiento interno",
      model: "PXW-Z280",
      notes: "<p>El menú de servicio se abre con…</p>",
    });

    const list = await authed.query(api.manuals.list, {});
    expect(list).toHaveLength(1);
    expect(list[0].equipmentId).toBeUndefined();
    expect(list[0].brand).toBeUndefined();
    expect(list[0].kind).toBe("note");
  });
});

describe("manuales: quién puede qué", () => {
  test("el invitado no los ve ni los escribe", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run((ctx) =>
      ctx.db.insert("users", {
        name: "Invitado",
        role: "technician",
        isAnonymous: true,
      }),
    );
    const guest = t.withIdentity({ subject: `${userId}|session1` });

    // La lista devuelve vacío en vez de un error: el panel la pide al montar.
    expect(await guest.query(api.manuals.list, {})).toEqual([]);
    await expectConvexError(
      guest.mutation(api.manuals.create, {
        title: "Lo que sea",
        kind: "note",
        type: "Procedimiento interno",
        notes: "<p>hola</p>",
      }),
      "uso interno del taller",
    );
  });

  test("sin sesión tampoco: la lista queda vacía", async () => {
    const t = convexTest(schema, modules);
    expect(await t.query(api.manuals.list, {})).toEqual([]);
  });

  test("el técnico consulta y escribe su nota, pero no sube archivos", async () => {
    const { t, authed } = await authedTest("technician");
    await authed.mutation(api.manuals.create, {
      title: "Puesta en marcha de la cámara",
      kind: "note",
      type: "Procedimiento interno",
      model: "HDC-3500",
      notes: "<p>Encender en este orden…</p>",
    });
    expect(await authed.query(api.manuals.list, {})).toHaveLength(1);

    await expectConvexError(
      authed.mutation(api.manuals.create, {
        ...archivoArgs,
        storageId: await storedFile(t),
      }),
      "es cosa de quien gestiona el módulo",
    );
  });

  test("un técnico no toca la nota de otro; su autor y el responsable sí", async () => {
    const t = convexTest(schema, modules);
    const ana = await addUser(t, "technician", "Ana");
    const bruno = await addUser(t, "technician", "Bruno");
    const manager = await addUser(t, "manager", "Marta");

    await ana.mutation(api.manuals.create, {
      title: "Nota de Ana",
      kind: "note",
      type: "Procedimiento interno",
      notes: "<p>Lo que vi</p>",
    });
    const [note] = await ana.query(api.manuals.list, {});

    await expectConvexError(
      bruno.mutation(api.manuals.update, {
        id: note._id,
        title: "Secuestrada",
      }),
      "solo quien lo gestiona o su autor",
    );
    await expectConvexError(
      bruno.mutation(api.manuals.remove, { id: note._id }),
      "solo quien lo gestiona o su autor",
    );

    await ana.mutation(api.manuals.update, {
      id: note._id,
      title: "Nota de Ana (corregida)",
    });
    expect((await ana.query(api.manuals.list, {}))[0].title).toBe(
      "Nota de Ana (corregida)",
    );

    await manager.mutation(api.manuals.update, {
      id: note._id,
      title: "Revisada por el responsable",
    });
    expect((await ana.query(api.manuals.list, {}))[0].title).toBe(
      "Revisada por el responsable",
    );
  });

  test("el autor borra su nota; un manual con archivo solo lo borra quien gestiona", async () => {
    const t = convexTest(schema, modules);
    const tecnico = await addUser(t, "technician", "Ana");
    const manager = await addUser(t, "manager", "Marta");

    await tecnico.mutation(api.manuals.create, {
      title: "Nota suelta",
      kind: "note",
      type: "Procedimiento interno",
      notes: "<p>…</p>",
    });
    const [note] = await tecnico.query(api.manuals.list, {});
    await tecnico.mutation(api.manuals.remove, { id: note._id });
    expect(await tecnico.query(api.manuals.list, {})).toEqual([]);

    await manager.mutation(api.manuals.create, {
      ...archivoArgs,
      storageId: await storedFile(t),
      fileName: "HDC-3500.pdf",
    });
    const [manual] = await tecnico.query(api.manuals.list, {});
    expect(manual.kind).toBe("file");

    await expectConvexError(
      tecnico.mutation(api.manuals.remove, { id: manual._id }),
      "solo quien lo gestiona o su autor",
    );
    await manager.mutation(api.manuals.remove, { id: manual._id });
    expect(await manager.query(api.manuals.list, {})).toEqual([]);
  });
});

describe("manuales: baja y retirada", () => {
  test("borrar un manual se lleva su archivo del almacén", async () => {
    const { t, authed } = await authedTest("manager");
    const storageId = await storedFile(t);
    await authed.mutation(api.manuals.create, {
      ...archivoArgs,
      storageId,
      fileName: "HDC-3500.pdf",
    });
    const [manual] = await authed.query(api.manuals.list, {});
    await authed.mutation(api.manuals.remove, { id: manual._id });
    expect(await t.run((ctx) => ctx.storage.getUrl(storageId))).toBeNull();
  });

  test("sustituir el archivo conserva el anterior como versión descargable", async () => {
    const { t, authed } = await authedTest("manager");
    const primero = await storedFile(t, "%PDF-1.4 v1");
    const segundo = await storedFile(t, "%PDF-1.4 v2");
    await authed.mutation(api.manuals.create, {
      ...archivoArgs,
      storageId: primero,
      fileName: "v1.pdf",
    });
    const [manual] = await authed.query(api.manuals.list, {});
    await authed.mutation(api.manuals.update, {
      id: manual._id,
      storageId: segundo,
      fileName: "v2.pdf",
    });

    const [actualizado] = await authed.query(api.manuals.list, {});
    expect(actualizado.fileName).toBe("v2.pdf");
    expect(actualizado.url).toContain("api/storage/");
    // El PDF sustituido no se borra: queda en el historial y se descarga igual.
    const versiones = manualFileVersions(actualizado);
    expect(versiones).toHaveLength(1);
    expect(versiones[0].file?.fileName).toBe("v1.pdf");
    expect(versiones[0].url).toContain("api/storage/");
    expect(await t.run((ctx) => ctx.storage.getUrl(primero))).not.toBeNull();
    expect(await t.run((ctx) => ctx.storage.getUrl(segundo))).not.toBeNull();
  });

  test("borrar un manual se lleva también las versiones anteriores", async () => {
    const { t, authed } = await authedTest("manager");
    const primero = await storedFile(t, "%PDF-1.4 v1");
    const segundo = await storedFile(t, "%PDF-1.4 v2");
    await authed.mutation(api.manuals.create, {
      ...archivoArgs,
      storageId: primero,
      fileName: "v1.pdf",
    });
    const [manual] = await authed.query(api.manuals.list, {});
    await authed.mutation(api.manuals.update, {
      id: manual._id,
      storageId: segundo,
      fileName: "v2.pdf",
    });
    await authed.mutation(api.manuals.remove, { id: manual._id });

    expect(await t.run((ctx) => ctx.storage.getUrl(primero))).toBeNull();
    expect(await t.run((ctx) => ctx.storage.getUrl(segundo))).toBeNull();
  });

  test("una nota no se convierte en archivo al editar", async () => {
    const { t, authed } = await authedTest("manager");
    await authed.mutation(api.manuals.create, {
      title: "Nota del taller",
      kind: "note",
      type: "Procedimiento interno",
      notes: "<p>…</p>",
    });
    const [note] = await authed.query(api.manuals.list, {});
    await expectConvexError(
      authed.mutation(api.manuals.update, {
        id: note._id,
        storageId: await storedFile(t),
        fileName: "HDC-3500.pdf",
      }),
      "no se convierte en archivo",
    );
  });

  test("la nota de un manual de tipo nota no puede quedarse vacía", async () => {
    const { authed } = await authedTest("manager");
    await authed.mutation(api.manuals.create, {
      title: "Nota del taller",
      kind: "note",
      type: "Procedimiento interno",
      notes: "<p>contenido</p>",
    });
    const [note] = await authed.query(api.manuals.list, {});
    await expectConvexError(
      authed.mutation(api.manuals.update, { id: note._id, notes: "" }),
      "no puede quedarse vacía",
    );
  });

  test("desvincular el equipo conserva la clasificación del manual", async () => {
    const { t, authed } = await authedTest("manager");
    const equipmentId = await seedEquipment(t);
    await authed.mutation(api.manuals.create, {
      ...archivoArgs,
      equipmentId,
      storageId: await storedFile(t),
      fileName: "HDC-3500.pdf",
    });
    const [manual] = await authed.query(api.manuals.list, {});
    await authed.mutation(api.manuals.update, {
      id: manual._id,
      equipmentId: null,
    });

    const [suelto] = await authed.query(api.manuals.list, {});
    expect(suelto.equipmentId).toBeUndefined();
    expect(suelto.brand).toBe("Sony");
    expect(suelto.model).toBe("HDC-3500");
  });

  test("dar de baja un equipo deja sus manuales sueltos, no los borra", async () => {
    const { t, authed } = await authedTest("manager");
    const equipmentId = await seedEquipment(t);
    await authed.mutation(api.manuals.create, {
      ...archivoArgs,
      equipmentId,
      storageId: await storedFile(t),
      fileName: "HDC-3500.pdf",
    });
    await authed.mutation(api.equipment.remove, { id: equipmentId });

    const [manual] = await authed.query(api.manuals.list, {});
    expect(manual.equipmentId).toBeUndefined();
    expect(manual.brand).toBe("Sony");
    expect(manual.model).toBe("HDC-3500");
  });
});

describe("manuales: historial de cambios", () => {
  test("el alta deja el primer movimiento firmado por quien la hizo", async () => {
    const { authed } = await authedTest("manager");
    await authed.mutation(api.manuals.create, {
      title: "Nota del taller",
      kind: "note",
      type: "Procedimiento interno",
      notes: "<p>…</p>",
    });
    const [manual] = await authed.query(api.manuals.list, {});
    expect(manual.history).toHaveLength(1);
    expect(manual.history[0].action).toBe("created");
    expect(manual.history[0].by).toBe("Prueba manager");
  });

  test("corregir la ficha apunta qué cambió y conserva el alta", async () => {
    const { authed } = await authedTest("manager");
    await authed.mutation(api.manuals.create, {
      title: "Nota del taller",
      kind: "note",
      type: "Procedimiento interno",
      notes: "<p>…</p>",
    });
    const [manual] = await authed.query(api.manuals.list, {});
    await authed.mutation(api.manuals.update, {
      id: manual._id,
      title: "Nota del taller (corregida)",
      type: "Guía rápida",
    });

    const [actualizado] = await authed.query(api.manuals.list, {});
    const historial = manualHistory(actualizado);
    expect(historial).toHaveLength(2);
    expect(historial[0].action).toBe("edited");
    expect(manualChangeLabels(historial[0].fields)).toEqual(["Título", "Tipo"]);
    // El movimiento del alta sigue ahí: el historial crece por el final.
    expect(historial[1].action).toBe("created");
  });

  test("guardar sin cambiar nada no deja rastro", async () => {
    const { authed } = await authedTest("manager");
    await authed.mutation(api.manuals.create, {
      title: "Nota del taller",
      kind: "note",
      type: "Procedimiento interno",
      notes: "<p>…</p>",
    });
    const [manual] = await authed.query(api.manuals.list, {});
    await authed.mutation(api.manuals.update, {
      id: manual._id,
      title: manual.title,
      type: manual.type,
    });
    const [actualizado] = await authed.query(api.manuals.list, {});
    expect(manualHistory(actualizado)).toHaveLength(1);
  });
});

describe("manuales: reglas del historial y las versiones", () => {
  const version = (fileName: string, at: number) => ({
    at,
    action: "fileReplaced" as const,
    file: { storageId: `st-${fileName}`, fileName, size: 1000 },
  });

  test("las versiones salen de la más reciente a la más antigua", () => {
    const manual = {
      history: [version("v1.pdf", 10), version("v2.pdf", 20)],
    };
    expect(
      manualFileVersions(manual).map((entry) => entry.file.fileName),
    ).toEqual(["v2.pdf", "v1.pdf"]);
  });

  test("solo cuentan como versión los movimientos que guardan un archivo", () => {
    const manual = {
      history: [
        { at: 1, action: "created" as const },
        { at: 2, action: "edited" as const, fields: ["title"] },
      ],
    };
    expect(manualFileVersions(manual)).toHaveLength(0);
  });

  test("las etiquetas de los campos cambiados siguen el orden del catálogo", () => {
    expect(manualChangeLabels(["notes", "title", "model"])).toEqual([
      "Título",
      "Modelo",
      "Nota",
    ]);
    expect(manualChangeLabels(undefined)).toEqual([]);
  });

  test("los campos que cambian se comparan sin acentos ni mayúsculas", () => {
    expect(
      changedManualFields(
        {
          title: "Manual",
          type: "Ficha técnica",
          brand: "Sony",
          model: "HDC-3500",
        },
        {
          title: "manual",
          type: "Ficha tecnica",
          brand: "SONY",
          model: "HDC-3500",
        },
      ),
    ).toEqual([]);
    expect(
      changedManualFields(
        { equipmentId: "eq1", notes: "<p>uno</p>" },
        { equipmentId: null, notes: "<p>dos</p>" },
      ),
    ).toEqual(["equipment", "notes"]);
  });

  test("un movimiento se cuenta en una línea", () => {
    expect(manualChangeSummary({ at: 1, action: "created" }, "file")).toContain(
      "archivo",
    );
    expect(
      manualChangeSummary(
        { at: 1, action: "edited", fields: ["title"] },
        "note",
      ),
    ).toBe("Cambió: Título");
    expect(
      manualChangeSummary({ at: 1, action: "fileReplaced" }, "file"),
    ).toContain("versión anterior");
  });
});

describe("manuales: filtros y clasificación de la lista", () => {
  const manuales = [
    {
      title: "Manual de servicio HDC-3500",
      kind: "file" as const,
      type: "Manual de servicio",
      brand: "Sony",
      model: "HDC-3500",
      equipmentId: "eq1",
      fileName: "hdc-3500.pdf",
      notes: null,
    },
    {
      title: "Manual de usuario AW-UE150",
      kind: "file" as const,
      type: "Manual de usuario",
      brand: "Panasonic",
      model: "AW-UE150",
      equipmentId: null,
      fileName: "aw-ue150.pdf",
      notes: null,
    },
    {
      title: "Puesta en marcha de la cámara",
      kind: "note" as const,
      type: "Procedimiento interno",
      brand: "Sony",
      model: "HDC-3500",
      equipmentId: null,
      fileName: null,
      notes: "<p>Encender en este orden</p>",
    },
  ];

  test("filtra por tipo, marca y modelo", () => {
    expect(
      filterManuals(manuales, { type: "Manual de servicio" }),
    ).toHaveLength(1);
    expect(filterManuals(manuales, { model: "AW-UE150" })).toHaveLength(1);
    // La marca se compara sin acentos ni mayúsculas.
    expect(filterManuals(manuales, { brand: "sony" })).toHaveLength(2);
    expect(
      filterManuals(manuales, { brand: "Sony", model: "HDC-3500" }),
    ).toHaveLength(2);
  });

  test("busca por texto en título, archivo y nota", () => {
    expect(filterManuals(manuales, { query: "aw-ue150" })).toHaveLength(1);
    expect(
      filterManuals(manuales, { query: "encender en este orden" }),
    ).toHaveLength(1);
    expect(filterManuals(manuales, { query: "hdc" })).toHaveLength(2);
    expect(filterManuals(manuales, { query: "nada de nada" })).toHaveLength(0);
  });

  test("filtra por el equipo al que está asignado", () => {
    expect(filterManuals(manuales, { equipmentId: "eq1" })).toHaveLength(1);
  });

  test("las marcas y los modelos salen de lo que hay, sin repetir", () => {
    expect(manualBrands(manuales)).toEqual(["Panasonic", "Sony"]);
    expect(manualModels(manuales)).toEqual(["AW-UE150", "HDC-3500"]);
    expect(manualModels(manuales, "Panasonic")).toEqual(["AW-UE150"]);
  });

  test("los manuales de un equipo: los suyos y los de su modelo", () => {
    const equipo = { _id: "eq1", brand: "Sony", model: "HDC-3500" };
    const { assigned, byModel } = manualsForEquipment(manuales, equipo);
    expect(assigned.map((manual) => manual.title)).toEqual([
      "Manual de servicio HDC-3500",
    ]);
    expect(byModel.map((manual) => manual.title)).toEqual([
      "Puesta en marcha de la cámara",
    ]);
  });

  test("un manual sin marca vale para cualquier equipo del modelo", () => {
    const sinMarca = [
      {
        title: "Procedimiento del taller",
        kind: "note" as const,
        type: "Procedimiento interno",
        brand: null,
        model: "HDC-3500",
        equipmentId: null,
      },
    ];
    const { assigned, byModel } = manualsForEquipment(sinMarca, {
      _id: "eq1",
      brand: "Sony",
      model: "HDC-3500",
    });
    expect(assigned).toHaveLength(0);
    expect(byModel).toHaveLength(1);
  });

  test("un equipo sin marca ni modelo no arrastra manuales del modelo", () => {
    const { assigned, byModel } = manualsForEquipment(manuales, {
      _id: "eq1",
      brand: null,
      model: null,
    });
    expect(assigned).toHaveLength(1);
    expect(byModel).toHaveLength(0);
  });

  test("un manual sin modelo no cuelga de la ficha de ningún equipo", () => {
    // Un manual del taller suelto —sin marca y sin modelo— no es «del modelo» de
    // nada: antes bastaba con que el equipo tuviera modelo para que apareciera en
    // todas las fichas del inventario como si fuera suyo.
    const suelto = [
      {
        title: "Inventario de cables y latiguillos del rack",
        kind: "note" as const,
        type: "Procedimiento interno",
      },
    ];
    const equipo = { _id: "eq1", brand: "Sony", model: "HDC-3500" };
    const { assigned, byModel } = manualsForEquipment(suelto, equipo);
    expect(assigned).toHaveLength(0);
    expect(byModel).toHaveLength(0);
    expect(manualCountForEquipment(suelto, equipo)).toBe(0);
  });

  test("un manual de marca sin modelo tampoco: la marca sola no basta", () => {
    const deMarca = [
      {
        title: "Notas de la marca Sony",
        kind: "note" as const,
        type: "Procedimiento interno",
        brand: "Sony",
        model: null,
      },
    ];
    expect(
      manualsForEquipment(deMarca, {
        _id: "eq1",
        brand: "Sony",
        model: "HDC-3500",
      }).byModel,
    ).toHaveLength(0);
  });

  test("la etiqueta dice de dónde es un manual sin mentir", () => {
    expect(manualScopeLabel({ brand: "Sony", model: "HDC-3500" })).toBe(
      "Del modelo: vale para cualquier equipo Sony HDC-3500",
    );
    // Sin marca, el modelo solo: la nota de un procedimiento interno, por
    // ejemplo, que no declara marca.
    expect(manualScopeLabel({ model: "HDC-3500" })).toBe(
      "Del modelo: vale para cualquier equipo de ese modelo",
    );
    expect(manualScopeLabel({ brand: "Sony" })).toBe(
      "De la marca, sin modelo: no cuelga de ningún equipo",
    );
    expect(manualScopeLabel({})).toBe("Sin equipo asignado");
  });

  test("el alcance y el filtro hablan de equipos, no de unidades", () => {
    // Es el mismo concepto —el dato del inventario— y el filtro del módulo ya lo
    // llama «equipo»: si la etiqueta dijera «unidad», la lista y la ficha
    // parecerían hablar de dos cosas distintas.
    const etiquetas = [
      manualScopeLabel({ brand: "Sony", model: "HDC-3500" }),
      manualScopeLabel({ model: "HDC-3500" }),
      manualScopeLabel({ brand: "Sony" }),
      manualScopeLabel({}),
    ];
    for (const etiqueta of etiquetas) {
      expect(etiqueta.toLowerCase()).not.toContain("unidad");
      expect(etiqueta.toLowerCase()).toContain("equipo");
    }
  });

  test("con equipo, la marca y el modelo que se guardan son los del equipo", () => {
    const equipos = [{ _id: "eq1", brand: "Grass Valley", model: "K2 Summit" }];
    // Lo escrito no manda cuando el manual es de un equipo: es lo que el
    // formulario enseña al elegir equipo, y lo que se guarda.
    expect(
      manualClassification(equipos, {
        equipmentId: "eq1",
        brand: "Sony",
        model: "HDC-3500",
      }),
    ).toEqual({
      linked: equipos[0],
      brand: "Grass Valley",
      model: "K2 Summit",
    });
  });

  test("sin equipo, la clasificación es la que se escribe", () => {
    expect(
      manualClassification([{ _id: "eq1", brand: "Sony", model: "HDC-3500" }], {
        equipmentId: "none",
        brand: "  Sony  ",
        model: " PXW-Z280 ",
      }),
    ).toEqual({ linked: null, brand: "Sony", model: "PXW-Z280" });
  });

  test("un equipo que no está en la lista deja el manual suelto", () => {
    // Con un id que no corresponde a ningún equipo —uno dado de baja mientras
    // el formulario estaba abierto— el manual se guarda suelto, nunca a medias.
    expect(
      manualClassification([], { equipmentId: "eq1", brand: "Sony" }),
    ).toEqual({ linked: null, brand: "Sony", model: "" });
  });

  test("el PDF se reconoce por el tipo o por la extensión", () => {
    expect(isPdfFile({ name: "manual.pdf" })).toBe(true);
    expect(isPdfFile({ name: "MANUAL.PDF" })).toBe(true);
    expect(isPdfFile({ contentType: "application/pdf" })).toBe(true);
    expect(isPdfFile({ name: "foto.png", contentType: "image/png" })).toBe(
      false,
    );
  });

  test("el título propuesto sale del nombre del archivo", () => {
    expect(manualTitleFromFile("HDC-3500_servicio.pdf")).toBe(
      "HDC 3500 servicio",
    );
    expect(manualTitleFromFile("manual.pdf")).toBe("manual");
  });

  test("el catálogo de tipos tiene los de uso más común", () => {
    expect(MANUAL_TYPES).toContain("Manual de servicio");
    expect(MANUAL_TYPES).toContain("Manual de usuario");
    expect(MANUAL_TYPES).toContain("Procedimiento interno");
  });
});

describe("manuales: reglas de quién puede tocar cada ficha", () => {
  const nota = {
    kind: "note" as const,
    title: "Nota",
    type: "Procedimiento interno",
    authorId: "u1",
  };
  const archivo = {
    kind: "file" as const,
    title: "Manual",
    type: "Manual de servicio",
    authorId: "u1",
  };

  test("el responsable puede con cualquier manual", () => {
    expect(canEditManual(archivo, { manage: true })).toBe(true);
    expect(canDeleteManual(archivo, { manage: true })).toBe(true);
  });

  test("el autor puede con su nota, pero no con un archivo", () => {
    expect(canEditManual(nota, { manage: false, userId: "u1" })).toBe(true);
    expect(canDeleteManual(nota, { manage: false, userId: "u1" })).toBe(true);
    expect(canEditManual(archivo, { manage: false, userId: "u2" })).toBe(false);
    expect(canEditManual(archivo, { manage: false, userId: "u1" })).toBe(true);
    // Aun siendo suyo, un manual con archivo no lo borra quien lo consulta.
    expect(canDeleteManual(archivo, { manage: false, userId: "u1" })).toBe(
      false,
    );
  });

  test("sin sesión conocida, solo el responsable toca algo", () => {
    expect(canEditManual(nota, { manage: false })).toBe(false);
    expect(canDeleteManual(nota, { manage: false, userId: null })).toBe(false);
  });
});
