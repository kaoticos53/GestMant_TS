import { backend } from "./backend";
import { ConvexError } from "convex/values";
import { describe, expect, test } from "vitest";
import { richDocBlocks, richDocToPlainText, richDocToStore } from "../src/lib/richDoc";
import { api } from "../src/convex/_generated/api";

async function setup() {
  const t = backend();
  const aliceId = await t.run((ctx) =>
    ctx.db.insert("users", {
      name: "Alice Rey",
      email: "alice@taller.es",
      role: "manager",
      active: true,
    }),
  );
  const bobId = await t.run((ctx) =>
    ctx.db.insert("users", {
      name: "Bob Díaz",
      email: "bob@taller.es",
      role: "technician",
      position: "Cámara",
      active: true,
    }),
  );
  const caraId = await t.run((ctx) =>
    ctx.db.insert("users", {
      name: "Cara Ruiz",
      email: "cara@taller.es",
      role: "technician",
      active: false,
    }),
  );
  return {
    t,
    alice: t.withIdentity({ subject: `${aliceId}|session1` }),
    bob: t.withIdentity({ subject: `${bobId}|session1` }),
    aliceId,
    bobId,
    caraId,
  };
}

/** Lanza la promesa y comprueba que el error contiene el texto. */
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

describe("envío de mensajes", () => {
  test("alice escribe a bob y bob ve el mensaje sin leer", async () => {
    const { alice, bob, aliceId, bobId } = await setup();

    await alice.mutation(api.messages.send, {
      recipientId: bobId,
      text: " ¿Me pasas el cable SDI del plató 2? ",
    });

    // Lista de bob: entrante, sin leer, con nombres capturados
    const bobList = await bob.query(api.messages.list, {});
    expect(bobList).toHaveLength(1);
    expect(bobList[0].senderId).toBe(aliceId);
    expect(bobList[0].recipientId).toBe(bobId);
    expect(bobList[0].senderName).toBe("Alice Rey");
    expect(bobList[0].recipientName).toBe("Bob Díaz");
    expect(bobList[0].text).toBe("¿Me pasas el cable SDI del plató 2?");
    expect(bobList[0].read).toBe(false);

    // La lista de alice solo muestra lo suyo
    const aliceList = await alice.query(api.messages.list, {});
    expect(aliceList).toHaveLength(1);
    expect(aliceList[0].senderId).toBe(aliceId);
  });

  test("valida texto, longitud, destino y sesión", async () => {
    const { t, alice, aliceId, bobId } = await setup();
    await expectConvexError(
      alice.mutation(api.messages.send, { recipientId: bobId, text: "   " }),
      "Escribe un mensaje antes de enviarlo.",
    );
    await expectConvexError(
      alice.mutation(api.messages.send, {
        recipientId: bobId,
        text: "x".repeat(1501),
      }),
      "1500 caracteres",
    );
    await expectConvexError(
      alice.mutation(api.messages.send, {
        recipientId: aliceId,
        text: "hola yo mismo",
      }),
      "a ti mismo",
    );
    const ghost = await t.run((ctx) =>
      ctx.db.insert("users", { name: "Temporal" }),
    );
    await t.run((ctx) => ctx.db.delete(ghost));
    await expectConvexError(
      alice.mutation(api.messages.send, { recipientId: ghost, text: "hola" }),
      "ya no existe",
    );
    await expectConvexError(
      t.mutation(api.messages.send, { recipientId: bobId, text: "hola" }),
      "Debes iniciar sesión",
    );
  });

  test("no se puede escribir a un usuario dado de baja", async () => {
    const { alice, caraId } = await setup();
    await expectConvexError(
      alice.mutation(api.messages.send, {
        recipientId: caraId,
        text: "Hola, ¿sigues por aquí?",
      }),
      "dado de baja",
    );
  });
});

describe("conversación y lectura", () => {
  test("el hilo ordena los mensajes de ambos lados en orden cronológico", async () => {
    const { alice, bob, aliceId, bobId } = await setup();
    await alice.mutation(api.messages.send, {
      recipientId: bobId,
      text: "Primer mensaje",
    });
    await bob.mutation(api.messages.send, {
      recipientId: aliceId,
      text: "Respuesta de bob",
    });

    const threadFromAlice = await alice.query(api.messages.thread, {
      userId: bobId,
    });
    expect(threadFromAlice).toHaveLength(2);
    expect(threadFromAlice[0].text).toBe("Primer mensaje");
    expect(threadFromAlice[1].text).toBe("Respuesta de bob");

    // Bob ve exactamente la misma conversación
    const threadFromBob = await bob.query(api.messages.thread, {
      userId: aliceId,
    });
    expect(threadFromBob.map((message) => message.text)).toEqual(
      threadFromAlice.map((message) => message.text),
    );
  });

  test("markThreadRead marca solo los suyos de ese emisor", async () => {
    const { t, alice, bob, aliceId, bobId, caraId } = await setup();
    await alice.mutation(api.messages.send, {
      recipientId: bobId,
      text: "Para bob",
    });
    // Mensaje de otra persona directamente en la tabla
    await t.run((ctx) =>
      ctx.db.insert("messages", {
        senderId: caraId,
        senderName: "Cara Ruiz",
        recipientId: bobId,
        recipientName: "Bob Díaz",
        text: "También para bob",
        read: false,
        createdAt: Date.now(),
      }),
    );

    const updated = await bob.mutation(api.messages.markThreadRead, {
      userId: aliceId,
    });
    expect(updated).toBe(1);

    const list = await bob.query(api.messages.list, {});
    const fromAlice = list.find((message) => message.text === "Para bob");
    const fromCara = list.find((message) => message.text === "También para bob");
    expect(fromAlice?.read).toBe(true);
    expect(fromAlice?.readAt).toBeTypeOf("number");
    expect(fromCara?.read).toBe(false); // de otra persona: intacto

    // Repetir no vuelve a tocar nada
    expect(
      await bob.mutation(api.messages.markThreadRead, { userId: aliceId }),
    ).toBe(0);
  });

  test("sin sesión las listas llegan vacías y abrir un hilo sí falla", async () => {
    // El centro de mensajes vive en la cabecera del panel y pide estas dos al
    // montar: degradan a vacío para no tumbar la pantalla. Abrir un hilo
    // concreto, en cambio, exige cuenta.
    const { t, bobId } = await setup();
    expect(await t.query(api.messages.list, {})).toEqual([]);
    expect(await t.query(api.messages.contacts, {})).toEqual([]);
    await expectConvexError(
      t.query(api.messages.thread, { userId: bobId }),
      "Debes iniciar sesión",
    );
  });
});

describe("directorio de contactos", () => {
  test("excluye al propio usuario y a los dados de baja", async () => {
    const { alice, bobId, caraId } = await setup();
    const contacts = await alice.query(api.messages.contacts, {});
    expect(contacts.map((contact) => contact._id)).toEqual([bobId]);
    expect(contacts.map((contact) => contact._id)).not.toContain(caraId);
    expect(contacts[0].name).toBe("Bob Díaz");
    expect(contacts[0].position).toBe("Cámara");
  });
});

describe("mensajes con formato", () => {
  test("el formato se guarda como documento y se lee como texto", async () => {
    const { alice, bob, bobId } = await setup();
    await alice.mutation(api.messages.send, {
      recipientId: bobId,
      text: "<p>Necesito el cable <strong>SDI</strong> del plató 2.</p><ul><li>De 3 metros</li></ul>",
    });

    const [message] = await bob.query(api.messages.list, {});
    // El mensaje se guarda como documento —bloques y marcas—, no como HTML...
    expect(richDocBlocks(message.text)).toEqual([
      {
        type: "paragraph",
        inline: [
          { text: "Necesito el cable " },
          { text: "SDI", marks: ["bold"] },
          { text: " del plató 2." },
        ],
      },
      {
        type: "list",
        ordered: false,
        items: [[{ type: "paragraph", inline: [{ text: "De 3 metros" }] }]],
      },
    ]);
    expect(message.text).not.toContain("<p>");
    // ...y lo que se enseña en la lista de hilos y se lee es su texto.
    expect(richDocToPlainText(message.text)).toBe(
      "Necesito el cable SDI del plató 2.\nDe 3 metros",
    );
  });

  test("un mensaje de siempre se guarda tal cual", async () => {
    const { alice, bobId } = await setup();
    await alice.mutation(api.messages.send, {
      recipientId: bobId,
      text: "  ¿Cómo va el turno?  ",
    });

    const [message] = await alice.query(api.messages.list, {});
    expect(message.text).toBe("¿Cómo va el turno?");
  });

  test("un mensaje con solo formato no es un mensaje", async () => {
    const { alice, bobId } = await setup();
    await expectConvexError(
      alice.mutation(api.messages.send, {
        recipientId: bobId,
        text: "<p><strong> </strong></p>",
      }),
      "Escribe un mensaje antes de enviarlo.",
    );
  });

  test("el límite cuenta el texto, no el formato", async () => {
    const { alice, bobId } = await setup();
    // Mil quinientos caracteres con formato: el documento que se guarda es más
    // largo que el límite, pero lo que se lee está justo en el tope.
    const html = `<p><strong>${"x".repeat(1500)}</strong></p>`;
    await alice.mutation(api.messages.send, { recipientId: bobId, text: html });

    const [message] = await alice.query(api.messages.list, {});
    expect(message.text.length).toBeGreaterThan(1500);
    expect(richDocToPlainText(message.text).length).toBe(1500);
  });

  test("un documento desmedido no entra aunque su texto sea corto", async () => {
    const { alice, bobId } = await setup();
    // Muchísimos párrafos de una letra: el texto no llega al límite (1500),
    // pero el documento pasa del suyo (cuatro veces el texto). El tope del
    // documento lo corta antes de guardarlo.
    const html = Array.from({ length: 150 }, () => "<p>x</p>").join("");
    const docs = richDocToStore(html)!;
    expect(richDocToPlainText(docs).length).toBeLessThanOrEqual(1500);
    expect(docs.length).toBeGreaterThan(6000);

    await expectConvexError(
      alice.mutation(api.messages.send, { recipientId: bobId, text: html }),
      "demasiado formato",
    );
  });
});
