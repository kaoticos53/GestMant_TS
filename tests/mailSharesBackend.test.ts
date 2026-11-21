import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { ConvexError } from "convex/values";
import { api, internal } from "../src/convex/_generated/api";
import { markDestinationDeleted } from "../src/convex/_mailShares/orphans";
import type { Id } from "../src/convex/_generated/dataModel";
import { backend } from "./backend";

async function expectConvexError(promise: Promise<unknown>, fragment: string) {
  const error = await promise.then(
    () => null,
    (reason: unknown) => reason,
  );
  expect(error, `Se esperaba un error con: ${fragment}`).not.toBeNull();
  const message =
    error instanceof ConvexError ? String(error.data) : String(error);
  expect(message).toContain(fragment);
}

const ACCOUNT = {
  password: "app-password-1234",
  enabled: true,
  cacheLimitBytes: 512 * 1024 * 1024,
  cacheRetentionDays: 30,
};

/** Un taller con administrador, técnico, invitado y un técnico sin buzón. */
async function setup() {
  const t = backend();
  const adminId = await t.run((ctx) =>
    ctx.db.insert("users", {
      name: "Administradora",
      email: "admin@taller.es",
      role: "admin",
    }),
  );
  const techId = await t.run((ctx) =>
    ctx.db.insert("users", {
      name: "Técnico",
      email: "tecnico@taller.es",
      role: "technician",
    }),
  );
  const guestId = await t.run((ctx) =>
    ctx.db.insert("users", {
      name: "Invitado",
      email: "invitado@taller.es",
      role: "guest",
      isAnonymous: true,
    }),
  );
  const noMailboxId = await t.run((ctx) =>
    ctx.db.insert("users", {
      name: "Sin buzón",
      email: "sinbuzon@taller.es",
      role: "sin-buzon",
    }),
  );
  await t.run((ctx) =>
    ctx.db.insert("roles", {
      key: "sin-buzon",
      label: "Sin buzón",
      description: "",
      kind: "custom",
      grants: { viewIncidents: true },
      createdAt: 1,
      updatedAt: 1,
    }),
  );

  const admin = t.withIdentity({ subject: `${adminId}|s-admin` });
  const tech = t.withIdentity({ subject: `${techId}|s-tech` });
  const guest = t.withIdentity({ subject: `${guestId}|s-guest` });
  const noMailbox = t.withIdentity({ subject: `${noMailboxId}|s-none` });

  await admin.mutation(api.mailAccounts.save, {
    ...ACCOUNT,
    email: "admin@rtva.es",
  });
  await tech.mutation(api.mailAccounts.save, {
    ...ACCOUNT,
    email: "tecnico@rtva.es",
  });

  const incidentId = await t.run((ctx) =>
    ctx.db.insert("incidents", {
      reference: "INC-0001",
      reporterName: "Proveedor",
      description: "Presupuesto del SAT",
      reportedAt: 1_795_179_963_000,
      status: "reported",
      history: [{ status: "reported", at: 1_795_179_963_000 }],
      createdAt: 1_795_179_963_000,
      updatedAt: 1_795_179_963_000,
    }),
  );

  // Mensaje ya abierto en el visor: cabecera, cuerpo y un adjunto cacheado.
  await t.run(async (ctx) => {
    const account = await ctx.db
      .query("mailAccounts")
      .withIndex("by_user", (q) => q.eq("userId", adminId))
      .first();
    if (!account) throw new Error("Sin cuenta de administración");
    const storageId = await ctx.storage.store(
      new Blob(["presupuesto"], { type: "application/pdf" }),
    );
    await ctx.db.insert("mailHeaders", {
      userId: adminId,
      accountId: account._id,
      folderRemoteId: "2",
      messageId: "m-1",
      subject: "Presupuesto del SAT",
      fromName: "Proveedor",
      fromAddress: "sat@proveedor.es",
      date: 1_795_179_963_000,
      size: 4096,
      flags: "",
      hasAttachments: true,
      snippet: "Adjunto el presupuesto.",
      bodyState: "cached",
      cachedAt: 1_795_179_963_000,
      lastOpenedAt: 1_795_179_963_000,
      cachedBytes: 100,
    });
    await ctx.db.insert("mailBodies", {
      userId: adminId,
      accountId: account._id,
      messageId: "m-1",
      text: "Hola:\n\nAdjunto el presupuesto del SAT.\n\nUn saludo.",
      textTruncated: false,
      html: "<p>Adjunto el presupuesto del SAT.</p>",
      htmlTruncated: false,
      bodyBytes: 80,
      parsedAt: 1_795_179_963_000,
    });
    await ctx.db.insert("mailAttachments", {
      userId: adminId,
      accountId: account._id,
      messageId: "m-1",
      partIndex: 2,
      filename: "presupuesto.pdf",
      contentType: "application/pdf",
      size: 11,
      inline: false,
      storageId,
      createdAt: 1_795_179_963_000,
    });
  });

  return {
    t,
    admin,
    tech,
    guest,
    noMailbox,
    adminId,
    techId,
    incidentId,
  };
}

beforeEach(() => {
  process.env.PULSO_SETTINGS_ENCRYPTION_KEY = "clave-de-prueba-f5";
  // Copiar un adjunto a la copia lee su objeto de `_storage` por URL; en el
  // arnés esa URL no existe, así que se devuelve el mismo contenido.
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(new Blob(["presupuesto"], { type: "application/pdf" })),
    ),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.PULSO_SETTINGS_ENCRYPTION_KEY;
});

describe("mailShares.share", () => {
  test("el resumen guarda metadatos y extracto, sin cuerpo ni adjuntos", async () => {
    const { t, admin, adminId, incidentId } = await setup();

    await admin.action(api.mailShares.share, {
      messageId: "m-1",
      destinationType: "incident",
      destinationId: incidentId,
      mode: "summary",
    });

    const rows = await t.run((ctx) => ctx.db.query("mailShares").collect());
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      destinationType: "incident",
      destinationReference: "INC-0001",
      mode: "summary",
      subject: "Presupuesto del SAT",
      fromAddress: "sat@proveedor.es",
      sharedBy: adminId,
      sharedByName: "Administradora",
    });
    expect(rows[0].summary).toContain("Adjunto el presupuesto");
    expect(rows[0].bodyText).toBeUndefined();
    expect(rows[0].bodyHtml).toBeUndefined();
    expect(rows[0].attachments).toBeUndefined();

    // La caché del buzón no cambia: sigue habiendo un cuerpo y un adjunto.
    const cache = await t.run(async (ctx) => ({
      bodies: await ctx.db.query("mailBodies").collect(),
      attachments: await ctx.db.query("mailAttachments").collect(),
      audit: await ctx.db.query("securityAuditLog").collect(),
    }));
    expect(cache.bodies).toHaveLength(1);
    expect(cache.attachments).toHaveLength(1);
    expect(cache.audit.some((row) => row.action === "mail_share_create")).toBe(
      true,
    );
  });

  test("el original copia cuerpo y adjunto a objetos propios", async () => {
    const { t, admin, incidentId } = await setup();
    const cacheAttachment = await t.run(
      async (ctx) => (await ctx.db.query("mailAttachments").collect())[0],
    );

    await admin.action(api.mailShares.share, {
      messageId: "m-1",
      destinationType: "incident",
      destinationId: incidentId,
      mode: "original",
    });

    const rows = await t.run((ctx) => ctx.db.query("mailShares").collect());
    expect(rows[0].bodyText).toContain("Adjunto el presupuesto");
    expect(rows[0].bodyHtml).toContain("<p>");
    expect(rows[0].attachments).toHaveLength(1);
    expect(rows[0].attachments?.[0].name).toBe("presupuesto.pdf");
    expect(rows[0].attachments?.[0].storageId).not.toBe(
      cacheAttachment.storageId,
    );

    const stored = await t.run((ctx) =>
      ctx.db.system.query("_storage").collect(),
    );
    expect(stored).toHaveLength(2);
  });

  test("clientShareId evita duplicar la copia en un reintento", async () => {
    const { t, admin, incidentId } = await setup();
    const args = {
      messageId: "m-1",
      destinationType: "incident" as const,
      destinationId: incidentId,
      mode: "summary" as const,
      clientShareId: "form-1",
    };

    const first = await admin.action(api.mailShares.share, args);
    const second = await admin.action(api.mailShares.share, args);

    expect(second.shareId).toBe(first.shareId);
    const rows = await t.run((ctx) => ctx.db.query("mailShares").collect());
    expect(rows).toHaveLength(1);
  });

  test("el mismo clientShareId en otra ficha no reutiliza la copia", async () => {
    const { t, admin, incidentId } = await setup();
    const otraIncidencia = await t.run((ctx) =>
      ctx.db.insert("incidents", {
        reference: "INC-9001",
        reporterName: "Otro",
        description: "Otra incidencia",
        reportedAt: 1,
        status: "reported",
        history: [{ status: "reported", at: 1, by: "Otro" }],
        createdAt: 1,
        updatedAt: 1,
      }),
    );

    const first = await admin.action(api.mailShares.share, {
      messageId: "m-1",
      destinationType: "incident",
      destinationId: incidentId,
      mode: "summary",
      clientShareId: "misma-marca",
    });
    const second = await admin.action(api.mailShares.share, {
      messageId: "m-1",
      destinationType: "incident",
      destinationId: otraIncidencia,
      mode: "summary",
      clientShareId: "misma-marca",
    });

    expect(second.shareId).not.toBe(first.shareId);
    const rows = await t.run((ctx) => ctx.db.query("mailShares").collect());
    expect(rows).toHaveLength(2);
    expect(new Set(rows.map((row) => row.destinationId))).toEqual(
      new Set([incidentId, otraIncidencia]),
    );
  });

  test("sin viewMailbox no se puede compartir", async () => {
    // El rechazo lo da la puerta del buzón (`requireMailboxMember`), que es la
    // única comprobación de `viewMailbox`: compartir no repite esa regla.
    const { noMailbox, incidentId } = await setup();
    await expectConvexError(
      noMailbox.action(api.mailShares.share, {
        messageId: "m-1",
        destinationType: "incident",
        destinationId: incidentId,
        mode: "summary",
      }),
      "buzón",
    );
  });

  test("un mensaje de otro buzón no se comparte", async () => {
    const { tech, incidentId } = await setup();
    await expectConvexError(
      tech.action(api.mailShares.share, {
        messageId: "m-1",
        destinationType: "incident",
        destinationId: incidentId,
        mode: "summary",
      }),
      "no pertenece a tu buzón",
    );
  });

  test("sin manageIncidents no se adjunta a una incidencia", async () => {
    const { t, tech, techId, incidentId } = await setup();
    // Un mensaje del propio técnico: así la comprobación que falla es la de la
    // capacidad del destino y no la de propiedad del mensaje.
    await t.run(async (ctx) => {
      const account = await ctx.db
        .query("mailAccounts")
        .withIndex("by_user", (q) => q.eq("userId", techId))
        .first();
      if (!account) throw new Error("Sin cuenta del técnico");
      await ctx.db.insert("mailHeaders", {
        userId: techId,
        accountId: account._id,
        folderRemoteId: "2",
        messageId: "m-2",
        subject: "Aviso del técnico",
        fromName: "Técnico",
        fromAddress: "tecnico@rtva.es",
        date: 1_795_179_963_000,
        size: 1024,
        flags: "",
        hasAttachments: false,
        snippet: "Aviso",
        bodyState: "cached",
        cachedAt: 1_795_179_963_000,
        cachedBytes: 20,
      });
      await ctx.db.insert("mailBodies", {
        userId: techId,
        accountId: account._id,
        messageId: "m-2",
        text: "Aviso",
        textTruncated: false,
        htmlTruncated: false,
        bodyBytes: 5,
        parsedAt: 1_795_179_963_000,
      });
    });

    await expectConvexError(
      tech.action(api.mailShares.share, {
        messageId: "m-2",
        destinationType: "incident",
        destinationId: incidentId,
        mode: "original",
      }),
      "Tu rol no puede adjuntar",
    );
  });
});

describe("mailShares.createIncidentFromMail", () => {
  test("nace en reported con el remitente como notificante y su copia", async () => {
    const { t, admin } = await setup();

    const result = await admin.action(api.mailShares.createIncidentFromMail, {
      messageId: "m-1",
      mode: "summary",
    });

    const incident = await t.run((ctx) => ctx.db.get(result.incidentId));
    expect(incident?.status).toBe("reported");
    expect(incident?.reporterName).toBe("Proveedor");
    expect(incident?.reporterEmail).toBe("sat@proveedor.es");
    expect(incident?.description).toContain("Presupuesto del SAT");
    expect(incident?.assigneeId).toBeUndefined();
    expect(incident?.history).toHaveLength(1);
    expect(incident?.history[0]).toMatchObject({
      status: "reported",
      by: "Administradora",
      note: "Creada desde correo",
    });
    expect(result.reference).toMatch(/^INC-\d+$/);
    expect(result.reference).not.toBe("INC-0001");

    const share = await t.run((ctx) => ctx.db.get(result.shareId));
    expect(share?.destinationType).toBe("incident");
    expect(share?.destinationId).toBe(result.incidentId);
    expect(share?.destinationReference).toBe(result.reference);
    expect(share?.mode).toBe("summary");
    expect(share?.bodyText).toBeUndefined();

    const incidents = await t.run((ctx) => ctx.db.query("incidents").collect());
    expect(incidents).toHaveLength(2); // la del arnés y la nueva
    const audit = await t.run((ctx) =>
      ctx.db.query("securityAuditLog").collect(),
    );
    expect(audit.some((row) => row.action === "mail_share_create")).toBe(true);
  });

  test("un reintento con el mismo clientShareId no duplica la incidencia", async () => {
    const { t, admin } = await setup();
    const args = {
      messageId: "m-1",
      mode: "summary" as const,
      clientShareId: "alta-1",
    };

    const first = await admin.action(
      api.mailShares.createIncidentFromMail,
      args,
    );
    const second = await admin.action(
      api.mailShares.createIncidentFromMail,
      args,
    );

    expect(second.incidentId).toBe(first.incidentId);
    expect(second.shareId).toBe(first.shareId);
    const incidents = await t.run((ctx) => ctx.db.query("incidents").collect());
    expect(incidents).toHaveLength(2);
  });

  test("una copia a una incidencia existente no se toma por un alta", async () => {
    const { t, admin, incidentId } = await setup();

    // El mismo `clientShareId` con el que antes se compartió el correo con una
    // incidencia que ya existía no puede devolver esa incidencia: la petición
    // era crear una nueva.
    await admin.action(api.mailShares.share, {
      messageId: "m-1",
      destinationType: "incident",
      destinationId: incidentId,
      mode: "summary",
      clientShareId: "alta-confundida",
    });

    const result = await admin.action(api.mailShares.createIncidentFromMail, {
      messageId: "m-1",
      mode: "summary",
      clientShareId: "alta-confundida",
    });

    expect(result.incidentId).not.toBe(incidentId);
    expect(result.reference).not.toBe("INC-0001");
    const incident = await t.run((ctx) => ctx.db.get(result.incidentId));
    expect(incident?.history[0]?.note).toBe("Creada desde correo");
    const share = await t.run((ctx) => ctx.db.get(result.shareId));
    expect(share?.createdDestination).toBe(true);
    const rows = await t.run((ctx) => ctx.db.query("mailShares").collect());
    expect(rows).toHaveLength(2);
  });

  test("sin buzón no se crea la incidencia", async () => {
    const { noMailbox } = await setup();
    await expectConvexError(
      noMailbox.action(api.mailShares.createIncidentFromMail, {
        messageId: "m-1",
        mode: "summary",
      }),
      "buzón",
    );
  });
});

/** Una copia de un equipo borrado, con su adjunto en `_storage`. */
async function seedOrphan(
  t: ReturnType<typeof backend>,
  options: { deletedAt: number; adminId: Id<"users"> },
) {
  return t.run(async (ctx) => {
    const storageId = await ctx.storage.store(
      new Blob(["presupuesto"], { type: "application/pdf" }),
    );
    const equipmentId = await ctx.db.insert("equipment", {
      name: "Cámara de estudio",
      model: "HDC-3500",
      code: "EQ-0001",
      createdAt: 1,
      updatedAt: 1,
    });
    const shareId = await ctx.db.insert("mailShares", {
      destinationType: "equipment",
      destinationId: equipmentId,
      destinationReference: "EQ-0001",
      mode: "original",
      subject: "Presupuesto del SAT",
      fromName: "Proveedor",
      fromAddress: "sat@proveedor.es",
      sentAt: 1_795_179_963_000,
      summary: "Presupuesto del SAT",
      bodyText: "Cuerpo del correo",
      attachments: [
        {
          storageId,
          name: "presupuesto.pdf",
          contentType: "application/pdf",
          size: 11,
        },
      ],
      sharedBy: options.adminId,
      sharedByName: "Administradora",
      sharedAt: 1_795_179_963_000,
      destinationDeletedAt: options.deletedAt,
      orphanPurgeAt: options.deletedAt + 7 * 24 * 60 * 60 * 1000,
    });
    return { shareId, storageId, equipmentId };
  });
}

describe("mailShares: copias huérfanas", () => {
  test("marcar un destino borrado fija el plazo de siete días", async () => {
    const { t, adminId } = await setup();
    const { shareId, equipmentId } = await seedOrphan(t, {
      deletedAt: 0,
      adminId,
    });
    const now = 1_800_000_000_000;

    await t.run(async (ctx) => {
      await ctx.db.patch(shareId, {
        destinationDeletedAt: undefined,
        orphanPurgeAt: undefined,
      });
      await markDestinationDeleted(ctx, "equipment", equipmentId, now);
    });

    const row = await t.run((ctx) => ctx.db.get(shareId));
    expect(row?.destinationDeletedAt).toBe(now);
    expect(row?.orphanPurgeAt).toBe(now + 7 * 24 * 60 * 60 * 1000);
  });

  test("la papelera lista la huérfana con su plazo y tamaño", async () => {
    const { t, admin, tech, adminId } = await setup();
    const { shareId } = await seedOrphan(t, {
      deletedAt: 1_800_000_000_000,
      adminId,
    });

    const rows = await admin.query(api.mailShares.listOrphaned, {});
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      shareId,
      destinationType: "equipment",
      destinationReference: "EQ-0001",
      subject: "Presupuesto del SAT",
      fromAddress: "sat@proveedor.es",
      size: 11,
    });

    await expectConvexError(
      tech.query(api.mailShares.listOrphaned, {}),
      "administrador",
    );
  });

  test("purgar una huérfana borra su contenido, sus objetos y la fila", async () => {
    const { t, admin, adminId } = await setup();
    const { shareId, storageId } = await seedOrphan(t, {
      deletedAt: 1_800_000_000_000,
      adminId,
    });

    await admin.mutation(api.mailShares.purgeOrphaned, { shareId });

    expect(await t.run((ctx) => ctx.db.get(shareId))).toBeNull();
    expect(await t.run((ctx) => ctx.db.system.get(storageId))).toBeNull();
    const audit = await t.run((ctx) =>
      ctx.db.query("securityAuditLog").collect(),
    );
    expect(
      audit.some(
        (row) =>
          row.action === "mail_share_orphan_purge" &&
          String(row.metadata).includes("orphan"),
      ),
    ).toBe(true);
  });

  test("borrar el equipo deja su copia huérfana", async () => {
    const { t, admin, adminId } = await setup();
    const { shareId, equipmentId } = await seedOrphan(t, {
      deletedAt: 0,
      adminId,
    });
    await t.run((ctx) =>
      ctx.db.patch(shareId, {
        destinationDeletedAt: undefined,
        orphanPurgeAt: undefined,
      }),
    );

    await admin.mutation(api.equipment.remove, { id: equipmentId });

    const row = await t.run((ctx) => ctx.db.get(shareId));
    expect(row?.destinationDeletedAt).toBeGreaterThan(0);
    expect(row?.orphanPurgeAt).toBe(
      row!.destinationDeletedAt! + 7 * 24 * 60 * 60 * 1000,
    );
    expect(await t.run((ctx) => ctx.db.get(equipmentId))).toBeNull();
  });

  test("el barrido purga solo las que cumplieron los siete días", async () => {
    const { t, adminId } = await setup();
    const old = await seedOrphan(t, { deletedAt: 1_000_000, adminId });
    const fresh = await seedOrphan(t, {
      deletedAt: Date.now() - 60_000,
      adminId,
    });

    const purged = await t.mutation(internal.mailShares.sweepOrphaned, {});

    expect(purged).toBe(1);
    expect(await t.run((ctx) => ctx.db.get(old.shareId))).toBeNull();
    expect(await t.run((ctx) => ctx.db.get(fresh.shareId))).not.toBeNull();
  });
});

describe("mailShares: audiencia y purga", () => {
  async function shareWithIncident() {
    const context = await setup();
    await context.admin.action(api.mailShares.share, {
      messageId: "m-1",
      destinationType: "incident",
      destinationId: context.incidentId,
      mode: "original",
    });
    const share = await context.t.run(
      async (ctx) => (await ctx.db.query("mailShares").collect())[0],
    );
    return { ...context, share };
  }

  test("cualquier miembro activo ve la copia de una incidencia", async () => {
    const { tech, incidentId } = await shareWithIncident();
    const rows = await tech.query(api.mailShares.listForDestination, {
      destinationType: "incident",
      destinationId: incidentId,
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].subject).toBe("Presupuesto del SAT");
  });

  test("el invitado no ve la copia", async () => {
    const { guest, incidentId } = await shareWithIncident();
    const rows = await guest.query(api.mailShares.listForDestination, {
      destinationType: "incident",
      destinationId: incidentId,
    });
    expect(rows).toHaveLength(0);
  });

  test("sin viewMailbox se ve la copia si se ve la ficha", async () => {
    const { noMailbox, incidentId } = await shareWithIncident();
    const rows = await noMailbox.query(api.mailShares.listForDestination, {
      destinationType: "incident",
      destinationId: incidentId,
    });
    expect(rows).toHaveLength(1);
  });

  test("la purga vacía el contenido y deja lápida, y borra los objetos", async () => {
    const { t, tech, incidentId, share } = await shareWithIncident();

    await t
      .withIdentity({ subject: `${share.sharedBy}|s-admin` })
      .mutation(api.mailShares.purge, { shareId: share._id });

    const purged = await t.run(async (ctx) => await ctx.db.get(share._id));
    expect(purged?.contentPurgedAt).toBeTypeOf("number");
    expect(purged?.purgeReason).toBe("manual");
    expect(purged?.subject).toBeUndefined();
    expect(purged?.fromAddress).toBeUndefined();
    expect(purged?.summary).toBeUndefined();
    expect(purged?.bodyText).toBeUndefined();
    expect(purged?.attachments).toBeUndefined();
    expect(purged?.sourceMessageId).toBeUndefined();

    const stored = await t.run((ctx) =>
      ctx.db.system.query("_storage").collect(),
    );
    // Solo queda el objeto de la caché del buzón.
    expect(stored).toHaveLength(1);

    const rows = await tech.query(api.mailShares.listForDestination, {
      destinationType: "incident",
      destinationId: incidentId,
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].subject).toBe("");
    expect(rows[0].fromAddress).toBe("");
    expect(rows[0].purgedAt).toBeTypeOf("number");

    const audit = await t.run((ctx) =>
      ctx.db.query("securityAuditLog").collect(),
    );
    expect(audit.some((row) => row.action === "mail_share_purge")).toBe(true);
  });

  test("solo el administrador puede purgar", async () => {
    const { tech, share } = await shareWithIncident();
    await expectConvexError(
      tech.mutation(api.mailShares.purge, { shareId: share._id }),
      "Solo el administrador",
    );
  });
});
