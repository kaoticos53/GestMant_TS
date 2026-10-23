import { backend } from "./backend";
import { ConvexError } from "convex/values";
import { describe, expect, test } from "vitest";
import { api } from "../src/convex/_generated/api";
import { identityNotice } from "../src/convex/_auth/secureMutation";

/**
 * La puerta central (`convex/_auth/secureMutation`) hace tres comprobaciones y
 * las hace para todas las mutaciones migradas: sesión de taller, capacidad del
 * rol y —cuando la decisión depende de la ficha— la política que la mutación
 * declara.
 *
 * Lo que aquí se ejercita es el aviso y el efecto: una denegación no deja nada a
 * medias, y quien tiene la capacidad trabaja el caso. La traza de seguridad no
 * entra: Convex revierte la transacción al lanzar, así que el registro de un
 * intento denegado no puede persistir desde dentro (está explicado en la cabecera
 * de `secureMutation`).
 */

type Backend = ReturnType<typeof backend>;
type Session = ReturnType<Backend["withIdentity"]>;

/** Una persona del taller dentro del mismo backend de la prueba. */
async function miembro(
  t: Backend,
  role: "admin" | "manager" | "technician",
  extra: { isAnonymous?: boolean } = {},
) {
  const userId = await t.run((ctx) =>
    ctx.db.insert("users", {
      name: `Usuario ${role}`,
      email: `${role}-${Date.now()}@taller.es`,
      role,
      active: true,
      isAnonymous: extra.isAnonymous ?? false,
    }),
  );
  return { userId, session: t.withIdentity({ subject: `${userId}|session1` }) };
}

/** Deja entrar un aviso por la puerta pública y devuelve su identificador. */
async function aviso(t: Backend, session: Session) {
  await session.mutation(api.incidents.report, {
    reporterName: "Quien avisa",
    description: "El equipo hace un ruido raro.",
    reportedAt: Date.now(),
  });
  const incident = await t.run((ctx) => ctx.db.query("incidents").first());
  if (!incident) throw new Error("La incidencia no llegó a crearse.");
  return incident._id;
}

async function denial(promise: Promise<unknown>) {
  const error = await promise.then(
    () => null,
    (err: unknown) => err,
  );
  expect(error, "Se esperaba una denegación y no la hubo.").not.toBeNull();
  return error instanceof ConvexError ? String(error.data) : String(error);
}

describe("secureMutation", () => {
  test("una capacidad que falta se rechaza con el aviso que corresponde al rol", async () => {
    const t = backend();
    const tecnico = await miembro(t, "technician");
    const incidentId = await aviso(t, tecnico.session);

    const mensaje = await denial(
      tecnico.session.mutation(api.incidents.assign, {
        incidentId,
        assigneeId: tecnico.userId,
      }),
    );
    expect(mensaje).toContain("autoasignarse las pendientes");

    // Y el caso se queda como estaba: la denegación no dejó nada a medias.
    const incident = await t.run((ctx) => ctx.db.get(incidentId));
    expect(incident?.assigneeId).toBeUndefined();
  });

  test("sin sesión de taller el aviso es de identidad, no de permisos", async () => {
    const t = backend();
    const gestor = await miembro(t, "manager");
    const invitado = await miembro(t, "technician", { isAnonymous: true });
    const incidentId = await aviso(t, gestor.session);

    const mensaje = await denial(
      invitado.session.mutation(api.incidents.selfAssign, { incidentId }),
    );
    expect(mensaje).toContain("cuenta registrada para gestionar incidencias");
    expect(mensaje).not.toContain("permisos");
  });

  test("la política de la ficha deniega a quien no la lleva ni coordina", async () => {
    const t = backend();
    const tecnico = await miembro(t, "technician");
    const incidentId = await aviso(t, tecnico.session);

    const mensaje = await denial(
      tecnico.session.mutation(api.incidents.updateEquipment, {
        incidentId,
        model: "Modelo corregido",
      }),
    );
    expect(mensaje).toContain("corregir los datos del equipo");

    const incident = await t.run((ctx) => ctx.db.get(incidentId));
    expect(incident?.model).not.toBe("Modelo corregido");
  });

  test("quien tiene la capacidad pasa la puerta y trabaja la incidencia", async () => {
    const t = backend();
    const gestor = await miembro(t, "manager");
    const incidentId = await aviso(t, gestor.session);

    await gestor.session.mutation(api.incidents.assign, {
      incidentId,
      assigneeId: gestor.userId,
    });

    const incident = await t.run((ctx) => ctx.db.get(incidentId));
    expect(incident?.assigneeId).toBe(gestor.userId);
  });

  test("las capacidades de administración se niegan a un técnico", async () => {
    const t = backend();
    const tecnico = await miembro(t, "technician");
    const gestor = await miembro(t, "manager");

    const mensaje = await denial(
      tecnico.session.mutation(api.members.setRole, {
        userId: gestor.userId,
        role: "admin",
      }),
    );
    expect(mensaje).toContain("Solo el administrador");

    // Y el rol del objetivo no cambió: la denegación no dejó nada a medias.
    const target = await t.run((ctx) => ctx.db.get(gestor.userId));
    expect(target?.role).toBe("manager");
  });

  test("el aviso de identidad distingue al invitado de la cuenta dada de baja", async () => {
    const t = backend();
    const invitado = await miembro(t, "technician", { isAnonymous: true });
    const baja = await miembro(t, "technician");
    await t.run((ctx) => ctx.db.patch(baja.userId, { active: false }));

    expect(
      await denial(invitado.session.mutation(api.manuals.generateUploadUrl, {})),
    ).toContain("uso interno del taller");
    expect(
      await denial(baja.session.mutation(api.manuals.generateUploadUrl, {})),
    ).toContain("dada de baja");
  });

  test("identityNotice separa la cuenta de baja del resto de motivos", () => {
    const aviso = identityNotice("Debes iniciar sesión.");
    expect(aviso("sin_sesion")).toBe("Debes iniciar sesión.");
    expect(aviso("anonima")).toBe("Debes iniciar sesión.");
    expect(aviso("inactiva")).toContain("dada de baja");

    // Y un módulo puede dar su propio texto de baja.
    expect(identityNotice("Entra.", "Baja propia.")("inactiva")).toBe(
      "Baja propia.",
    );
  });

  test("los módulos del primer bloque recuperan el aviso de cuenta dada de baja", async () => {
    const t = backend();
    const baja = await miembro(t, "technician");
    await t.run((ctx) => ctx.db.patch(baja.userId, { active: false }));

    const mensaje = await denial(
      baja.session.mutation(api.partRequests.generateUploadUrl, {}),
    );
    expect(mensaje).toContain("dada de baja");
    expect(mensaje).not.toContain("iniciar sesión");
  });

  test("la política deja pasar al técnico que tiene la incidencia asignada", async () => {
    const t = backend();
    const gestor = await miembro(t, "manager");
    const tecnico = await miembro(t, "technician");
    const incidentId = await aviso(t, gestor.session);

    await gestor.session.mutation(api.incidents.assign, {
      incidentId,
      assigneeId: tecnico.userId,
    });
    await tecnico.session.mutation(api.incidents.updateEquipment, {
      incidentId,
      model: "Modelo corregido",
    });

    const incident = await t.run((ctx) => ctx.db.get(incidentId));
    expect(incident?.model).toBe("Modelo corregido");
  });
});
