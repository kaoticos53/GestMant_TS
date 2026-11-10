import { backend } from "./backend";
import { ConvexError } from "convex/values";
import { describe, expect, test } from "vitest";
import { api } from "../src/convex/_generated/api";
import { MAX_FILE_SIZE } from "../src/lib/upload";

const PNG_HEAD = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13,
]);

/** Instancia de test con un usuario autenticado. */
async function setup() {
  const t = backend();
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
  expect(
    error,
    `Se esperaba un error que contuviera: ${fragment}`,
  ).not.toBeNull();
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
      ctx.storage.store(new Blob([PNG_HEAD], { type: "image/png" })),
    );

    expect(
      await authed.action(api.uploads.imageUrl, { storageId }),
    ).toContain("api/storage/");

    // Sin sesión no se resuelve la URL de nadie.
    await expectConvexError(
      t.action(api.uploads.imageUrl, { storageId }),
      "Debes iniciar sesión",
    );
  });

  test("rechaza y elimina un archivo que finge ser imagen (SVG/HTML/texto)", async () => {
    const { t, authed } = await setup();
    const storageId = await t.run((ctx) =>
      ctx.storage.store(
        new Blob(['<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'], {
          type: "image/png",
        }),
      ),
    );

    await expectConvexError(
      authed.action(api.uploads.imageUrl, { storageId }),
      "Solo se pueden adjuntar fotos",
    );

    const storedAfter = await t.run((ctx) =>
      ctx.db.system.get("_storage", storageId),
    );
    expect(storedAfter).toBeNull();
  });

  test("rechaza y elimina una imagen que supera el tamaño máximo permitido", async () => {
    const { t, authed } = await setup();
    const oversized = new Uint8Array(MAX_FILE_SIZE + 1);
    oversized.set(PNG_HEAD);
    const storageId = await t.run((ctx) =>
      ctx.storage.store(new Blob([oversized], { type: "image/png" })),
    );

    await expectConvexError(
      authed.action(api.uploads.imageUrl, { storageId }),
      "como mucho",
    );

    const storedAfter = await t.run((ctx) =>
      ctx.db.system.get("_storage", storageId),
    );
    expect(storedAfter).toBeNull();
  });

  test("una cuenta dada de baja no puede pedir subidas ni enlazar imágenes", async () => {
    const t = backend();
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
      ctx.storage.store(new Blob([PNG_HEAD], { type: "image/png" })),
    );

    await expectConvexError(
      authed.mutation(api.uploads.generateImageUploadUrl, {}),
      "Esta cuenta ha sido dada de baja",
    );
    await expectConvexError(
      authed.action(api.uploads.imageUrl, { storageId }),
      "Esta cuenta ha sido dada de baja",
    );
  });

  test("un invitado anónimo no puede pedir subidas ni enlazar imágenes", async () => {
    const t = backend();
    const userId = await t.run((ctx) =>
      ctx.db.insert("users", {
        name: "Invitado",
        isAnonymous: true,
        role: "guest",
      }),
    );
    const authed = t.withIdentity({ subject: `${userId}|session1` });
    const storageId = await t.run((ctx) =>
      ctx.storage.store(new Blob([PNG_HEAD], { type: "image/png" })),
    );

    await expectConvexError(
      authed.mutation(api.uploads.generateImageUploadUrl, {}),
      "Debes iniciar sesión con una cuenta registrada",
    );
    await expectConvexError(
      authed.action(api.uploads.imageUrl, { storageId }),
      "Debes iniciar sesión con una cuenta registrada",
    );
  });
});
