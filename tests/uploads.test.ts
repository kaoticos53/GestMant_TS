import { convexTest } from "convex-test";
import { ConvexError } from "convex/values";
import { describe, expect, test } from "vitest";
import { api } from "../src/convex/_generated/api";
import schema from "../src/convex/schema";

/** Todos los módulos de funciones de la app (convex-test los levanta in-process). */
const modules = import.meta.glob("../src/convex/**/!(*.*.*)*.*s");

/** Instancia de test con un usuario autenticado. */
async function setup() {
  const t = convexTest(schema, modules);
  const userId = await t.run((ctx) =>
    ctx.db.insert("users", {
      name: "Iván Torres",
      email: "tecnico@taller.es",
      role: "technician",
    }),
  );
  return { t, authed: t.withIdentity({ subject: `${userId}|session1` }) };
}

/** Lanza el error de Convex y comprueba que contiene el texto esperado. */
async function expectConvexError(promise: Promise<unknown>, fragment: string) {
  const error = await promise.then(
    () => null,
    (err: unknown) => err,
  );
  expect(error, `Se esperaba un error que contuviera: ${fragment}`).not.toBeNull();
  const message =
    error instanceof ConvexError ? String(error.data) : String(error);
  expect(message).toContain(fragment);
}

describe("imágenes de las notas y las descripciones", () => {
  test("la URL de subida la pide quien tiene sesión", async () => {
    const { t, authed } = await setup();

    await expectConvexError(
      t.mutation(api.uploads.generateImageUploadUrl, {}),
      "Debes iniciar sesión",
    );
    expect(
      await authed.mutation(api.uploads.generateImageUploadUrl, {}),
    ).toContain("upload");
  });

  test("la imagen subida se enlaza y el enlace es el del almacenamiento", async () => {
    const { t, authed } = await setup();
    const storageId = await t.run((ctx) =>
      ctx.storage.store(new Blob(["foto"], { type: "image/png" })),
    );

    expect(await authed.mutation(api.uploads.imageUrl, { storageId })).toContain(
      "api/storage/",
    );

    // Sin sesión no se resuelve la URL de nadie.
    await expectConvexError(
      t.mutation(api.uploads.imageUrl, { storageId }),
      "Debes iniciar sesión",
    );
  });

  test("una cuenta dada de baja no puede pedir subidas ni enlazar imágenes", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run((ctx) =>
      ctx.db.insert("users", {
        name: "Usuario Inactivo",
        email: "baja@taller.es",
        role: "technician",
        active: false,
      }),
    );
    const authed = t.withIdentity({ subject: `${userId}|session1` });
    const storageId = await t.run((ctx) =>
      ctx.storage.store(new Blob(["foto"], { type: "image/png" })),
    );

    await expectConvexError(
      authed.mutation(api.uploads.generateImageUploadUrl, {}),
      "Esta cuenta ha sido dada de baja",
    );
    await expectConvexError(
      authed.mutation(api.uploads.imageUrl, { storageId }),
      "Esta cuenta ha sido dada de baja",
    );
  });

  test("un invitado anónimo no puede pedir subidas ni enlazar imágenes", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run((ctx) =>
      ctx.db.insert("users", {
        name: "Invitado",
        isAnonymous: true,
        role: "guest",
      }),
    );
    const authed = t.withIdentity({ subject: `${userId}|session1` });
    const storageId = await t.run((ctx) =>
      ctx.storage.store(new Blob(["foto"], { type: "image/png" })),
    );

    await expectConvexError(
      authed.mutation(api.uploads.generateImageUploadUrl, {}),
      "Debes iniciar sesión con una cuenta registrada",
    );
    await expectConvexError(
      authed.mutation(api.uploads.imageUrl, { storageId }),
      "Debes iniciar sesión con una cuenta registrada",
    );
  });
});
