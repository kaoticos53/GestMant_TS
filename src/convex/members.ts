import {
  createAccount,
  getAuthSessionId,
  getAuthUserId,
  invalidateSessions,
  modifyAccountCredentials,
  retrieveAccount,
} from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import { validatePassword } from "../lib/password";
import {
  DEFAULT_ROLE,
  areRoleListsEqual,
  effectiveUserRoles,
  isAdminUser,
  normalizeUserRoles,
  primaryUserRole,
} from "../lib/roles";
import { clampSidebarWidth } from "../lib/sidebar";
import { dismissalOf } from "../lib/workAlert";
import { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { identityNotice, secureMutation } from "./_auth/secureMutation";
import { CAPABILITIES } from "../lib/permissions";
import { isClosedIncident } from "../lib/incidentFlow";
import {
  grantsForRole,
  grantsForRoles,
  hasCapability,
  roleExists,
} from "./permissions";
import {
  type MutationCtx,
  QueryCtx,
  action,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { ROLES, roleValidator } from "./schema";
import { logSecurityEvent, notifySecurityAlert } from "./audit";

async function requireUser(ctx: QueryCtx) {
  const userId = await getAuthUserId(ctx);
  if (userId === null) {
    throw new ConvexError("Debes iniciar sesión para gestionar usuarios.");
  }
  const user = await ctx.db.get(userId);
  if (!user || user.active === false || user.isAnonymous === true) {
    throw new ConvexError(
      user?.active === false
        ? "Esta cuenta ha sido dada de baja o no está activa."
        : "Debes iniciar sesión con una cuenta registrada para realizar esta acción.",
    );
  }
  return userId;
}

async function requireAdmin(ctx: QueryCtx): Promise<Id<"users">> {
  const userId = await requireUser(ctx);
  const user = await ctx.db.get(userId);
  if (!isAdminUser(user)) {
    throw new ConvexError(
      "Solo el administrador puede gestionar usuarios y roles.",
    );
  }
  return userId;
}

/** Cadena opcional recortada: vacío → `undefined` (limpia el campo al patchear). */
function trimmed(value: string | undefined): string | undefined {
  const result = value?.trim();
  return result ? result : undefined;
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function assertValidEmail(email: string) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new ConvexError("Indica un correo electrónico válido.");
  }
}

/** Campos comunes del perfil (nombre, puesto, ubicación y teléfono). */
const profileArgs = {
  name: v.string(),
  position: v.optional(v.string()),
  location: v.optional(v.string()),
  phone: v.optional(v.string()),
};

/**
 * Asigna el rol la primera vez que entra un usuario: el administrador si es el
 * primer usuario o coincide con el correo admin; si es invitado, rol guest; el resto,
 * técnicos (un administrador puede promoverlos después).
 */
export const ensureRole = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new ConvexError("Debes iniciar sesión.");
    }
    const user = await ctx.db.get(userId);
    if (!user) throw new ConvexError("Usuario no encontrado.");
    if (user.active === false) {
      throw new ConvexError(
        "Esta cuenta ha sido dada de baja o no está activa.",
      );
    }

    const existingRoles = effectiveUserRoles(user);
    if (existingRoles.length > 0) return primaryUserRole(existingRoles);

    if (user.isAnonymous === true) {
      await ctx.db.patch(userId, { role: ROLES.GUEST, roles: [ROLES.GUEST] });
      return ROLES.GUEST;
    }

    const initialAdmin = process.env.INITIAL_ADMIN_EMAIL?.trim().toLowerCase();
    const existingAdmin = await ctx.db
      .query("users")
      .withIndex("by_role", (q) => q.eq("role", ROLES.ADMIN))
      .first();

    const userEmail = user.email?.trim().toLowerCase();
    const matchesConfiguredAdmin = Boolean(
      initialAdmin && userEmail === initialAdmin,
    );
    const isFirstUser = !existingAdmin;

    // Solo el primer usuario de la instalación o quien coincida con INITIAL_ADMIN_EMAIL
    // configurado de forma segura en el entorno puede recibir el rol de administrador.
    // Si ya existe un administrador, ningún nuevo registro puede autopromocionarse.
    const role =
      matchesConfiguredAdmin || isFirstUser ? ROLES.ADMIN : DEFAULT_ROLE;
    await ctx.db.patch(userId, { role, roles: [role] });
    return role;
  },
});

/** Actualiza el perfil de la propia persona (nunca el rol ni el estado). */
export const updateProfile = mutation({
  args: profileArgs,
  handler: secureMutation(
    {
      identityMessage: identityNotice(
        "Debes iniciar sesión para gestionar usuarios.",
      ),
    },
    profileArgs,
    async (ctx, args, actor) => {
      const userId = actor._id;
      const name = args.name.trim();
      if (!name) throw new ConvexError("Indica tu nombre y apellidos.");
      await ctx.db.patch(userId, {
        name,
        // Argumento omitido = no tocar; cadena vacía = limpiar el campo.
        ...(args.position !== undefined
          ? { position: trimmed(args.position) }
          : {}),
        ...(args.location !== undefined
          ? { location: trimmed(args.location) }
          : {}),
        ...(args.phone !== undefined ? { phone: trimmed(args.phone) } : {}),
      });
      return true;
    },
  ),
});

/**
 * Guarda en el propio perfil cómo tiene colocado el menú lateral (ancho y
 * plegado), para que su próximo acceso lo encuentre igual venga del navegador
 * que venga. El backend no conoce el tamaño de la ventana, así que solo aplica
 * los límites propios del panel; el navegador ajusta el resto.
 */
const saveSidebarLayoutArgs = { width: v.number(), collapsed: v.boolean() };

export const saveSidebarLayout = mutation({
  args: saveSidebarLayoutArgs,
  handler: secureMutation(
    {
      identityMessage: identityNotice(
        "Debes iniciar sesión para gestionar usuarios.",
      ),
    },
    saveSidebarLayoutArgs,
    async (ctx, args, actor) => {
      const userId = actor._id;
      await ctx.db.patch(userId, {
        sidebarWidth: clampSidebarWidth(args.width, Number.POSITIVE_INFINITY),
        sidebarCollapsed: args.collapsed,
      });
      return true;
    },
  ),
});

/**
 * Guarda en el propio perfil el aviso de trabajo sin constancia que esa persona
 * dio por visto —qué incidencias y con qué margen—, para que al entrar desde
 * otro dispositivo no se lo vuelvan a repetir. Con `null` se olvida: el aviso
 * vuelve a salir tal cual, que es el botón «Volver a mostrar el aviso».
 *
 * Las referencias se guardan limpias y ordenadas (`dismissalOf`, la misma regla
 * que usa el panel), para que comparar lo avisado no dependa de cómo llegó.
 */
const saveWorkAlertDismissalArgs = {
  dismissal: v.union(
    v.object({
      marginDays: v.number(),
      references: v.array(v.string()),
    }),
    v.null(),
  ),
};

export const saveWorkAlertDismissal = mutation({
  args: saveWorkAlertDismissalArgs,
  handler: secureMutation(
    {
      identityMessage: identityNotice(
        "Debes iniciar sesión para gestionar usuarios.",
      ),
    },
    saveWorkAlertDismissalArgs,
    async (ctx, args, actor) => {
      const userId = actor._id;
      if (args.dismissal === null) {
        // Olvidarlo es quitar el campo: sin él, el aviso sale como si nunca se
        // hubiera cerrado.
        await ctx.db.patch(userId, { workAlertDismissal: undefined });
        return true;
      }
      const marginDays = Math.round(args.dismissal.marginDays);
      if (!Number.isFinite(marginDays)) {
        throw new ConvexError("El margen del aviso no es válido.");
      }
      await ctx.db.patch(userId, {
        workAlertDismissal: dismissalOf(args.dismissal.references, marginDays),
      });
      return true;
    },
  ),
});

/** El administrador modifica el perfil de cualquier usuario. */
const updateUserArgs = { userId: v.id("users"), ...profileArgs };

export const updateUser = mutation({
  args: updateUserArgs,
  handler: secureMutation(
    {
      capability: "manageUsers",
      identityMessage: identityNotice(
        "Debes iniciar sesión para gestionar usuarios.",
      ),
      denyMessage: "Solo el administrador puede gestionar usuarios y roles.",
    },
    updateUserArgs,
    async (ctx, args) => {
      const target = await ctx.db.get(args.userId);
      if (!target) throw new ConvexError("El usuario ya no existe.");
      const name = args.name.trim();
      if (!name) throw new ConvexError("Indica tu nombre y apellidos.");
      await ctx.db.patch(args.userId, {
        name,
        // Argumento omitido = no tocar; cadena vacía = limpiar el campo.
        ...(args.position !== undefined
          ? { position: trimmed(args.position) }
          : {}),
        ...(args.location !== undefined
          ? { location: trimmed(args.location) }
          : {}),
        ...(args.phone !== undefined ? { phone: trimmed(args.phone) } : {}),
      });
      return true;
    },
  ),
});

/**
 * Da de alta a un usuario con cuenta de acceso (correo + contraseña). Crea la
 * credencial con el proveedor `password` y el perfil en el mismo paso. Es una
 * acción porque la creación de cuentas vive en el store de @convex-dev/auth.
 */
export const createUser = action({
  args: {
    name: v.string(),
    email: v.string(),
    password: v.string(),
    role: v.optional(roleValidator),
    roles: v.optional(v.array(roleValidator)),
    position: v.optional(v.string()),
    location: v.optional(v.string()),
    phone: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const actorId = await getAuthUserId(ctx);
    if (!actorId) {
      throw new ConvexError("Debes iniciar sesión para gestionar usuarios.");
    }
    await ctx.runQuery(internal.members.getAdminActor, { userId: actorId });

    const name = args.name.trim();
    if (!name) throw new ConvexError("Indica tu nombre y apellidos.");
    const email = normalizeEmail(args.email);
    assertValidEmail(email);
    if (args.password.length < 8) {
      throw new ConvexError("La contraseña debe tener al menos 8 caracteres.");
    }
    const existing = await ctx.runQuery(internal.members.findUserByEmail, {
      email,
    });
    if (existing !== null) {
      throw new ConvexError("Ya existe una cuenta con ese correo.");
    }
    const rawRoles =
      args.roles && args.roles.length > 0
        ? args.roles
        : args.role
          ? [args.role]
          : [];
    const normalizedRoles = normalizeUserRoles(rawRoles);
    if (normalizedRoles.length === 0) {
      throw new ConvexError("Asigna al menos un rol al usuario.");
    }
    if (normalizedRoles.includes(ROLES.GUEST)) {
      throw new ConvexError(
        "El rol de invitado es solo para sesiones anónimas.",
      );
    }
    for (const key of normalizedRoles) {
      const roleOk = await ctx.runQuery(internal.permissions.roleKeyExists, {
        key,
      });
      if (!roleOk) {
        throw new ConvexError("El rol indicado no existe.");
      }
    }

    const primary = primaryUserRole(normalizedRoles);
    const position = trimmed(args.position);
    const location = trimmed(args.location);
    const phone = trimmed(args.phone);
    const { user } = await createAccount(ctx, {
      provider: "password",
      account: { id: email, secret: args.password },
      profile: {
        email,
        name,
        role: primary,
        roles: normalizedRoles,
        active: true,
        ...(position ? { position } : {}),
        ...(location ? { location } : {}),
        ...(phone ? { phone } : {}),
      },
      shouldLinkViaEmail: false,
    });
    return user._id;
  },
});

/**
 * Activa o da de baja a un usuario. Al darlo de baja se invalidan sus
 * sesiones (pierde el acceso inmediatamente); la baja es reversible.
 */
export const setActive = action({
  args: { userId: v.id("users"), active: v.boolean() },
  handler: async (ctx, args) => {
    const actorId = await getAuthUserId(ctx);
    if (!actorId) {
      throw new ConvexError("Debes iniciar sesión para gestionar usuarios.");
    }
    await ctx.runQuery(internal.members.getAdminActor, { userId: actorId });
    if (!args.active && args.userId === actorId) {
      throw new ConvexError("No puedes dar de baja tu propia cuenta.");
    }
    const target = await ctx.runQuery(internal.members.getTargetUser, {
      userId: args.userId,
    });
    if (target.active === args.active) return false; // sin cambios
    await ctx.runMutation(internal.members.patchActive, {
      userId: args.userId,
      active: args.active,
      actorId,
    });
    if (!args.active) {
      await invalidateSessions(ctx, { userId: args.userId });
    }
    return true;
  },
});

/** Cambio de contraseña por el propio usuario autenticado (no anónimo). */
export const changePassword = action({
  args: {
    currentPassword: v.string(),
    newPassword: v.string(),
  },
  handler: async (ctx, args) => {
    const actorId = await getAuthUserId(ctx);
    if (!actorId) {
      throw new ConvexError("Debes iniciar sesión para cambiar tu contraseña.");
    }
    const actor = await ctx.runQuery(internal.members.getPasswordActor, {
      userId: actorId,
    });
    if (!actor || !actor.active || actor.isAnonymous || !actor.email) {
      throw new ConvexError(
        "Esta cuenta no admite cambio de contraseña con correo.",
      );
    }
    const validationError = validatePassword(args.newPassword);
    if (validationError) {
      throw new ConvexError(validationError);
    }
    if (args.newPassword === args.currentPassword) {
      throw new ConvexError(
        "La nueva contraseña debe ser distinta de la actual.",
      );
    }

    try {
      await retrieveAccount(ctx, {
        provider: "password",
        account: { id: actor.email, secret: args.currentPassword },
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : "";
      if (msg.includes("TooManyFailedAttempts")) {
        throw new ConvexError(
          "Demasiados intentos fallidos. Espera unos minutos e inténtalo de nuevo.",
        );
      }
      if (msg.includes("InvalidAccountId")) {
        throw new ConvexError(
          "Tu cuenta usa acceso sin contraseña; pide al administrador que la configure.",
        );
      }
      throw new ConvexError("La contraseña actual no es correcta.");
    }

    await modifyAccountCredentials(ctx, {
      provider: "password",
      account: { id: actor.email, secret: args.newPassword },
    });

    const currentSessionId = await getAuthSessionId(ctx);
    await invalidateSessions(ctx, {
      userId: actorId,
      ...(currentSessionId ? { except: [currentSessionId] } : {}),
    });

    await ctx.runMutation(internal.members.recordPasswordSecurityEvent, {
      actorId,
      actorEmail: actor.email,
      action: "password_change",
      target: `user:${actorId}`,
      metadata: JSON.stringify({
        metadataVersion: 1,
        selfService: true,
        targetEmail: actor.email,
      }),
    });
    return true;
  },
});

/** Restablecimiento de contraseña por el administrador, cerrando todas las sesiones del destino. */
export const resetUserPassword = action({
  args: {
    userId: v.id("users"),
    newPassword: v.string(),
  },
  handler: async (ctx, args) => {
    const actorId = await getAuthUserId(ctx);
    if (!actorId) {
      throw new ConvexError("Debes iniciar sesión para gestionar usuarios.");
    }
    await ctx.runQuery(internal.members.getAdminActor, { userId: actorId });
    if (actorId === args.userId) {
      throw new ConvexError(
        "Para cambiar tu propia contraseña usa Mi perfil.",
      );
    }
    const target = await ctx.runQuery(internal.members.getPasswordActor, {
      userId: args.userId,
    });
    if (!target) {
      throw new ConvexError("El usuario ya no existe.");
    }
    if (target.isAnonymous || !target.email) {
      throw new ConvexError(
        "No se puede restablecer contraseña en una cuenta sin correo o de invitado.",
      );
    }
    const validationError = validatePassword(args.newPassword);
    if (validationError) {
      throw new ConvexError(validationError);
    }

    await ctx.runMutation(internal.members.ensurePasswordAccount, {
      userId: args.userId,
      email: target.email,
    });
    await modifyAccountCredentials(ctx, {
      provider: "password",
      account: { id: target.email, secret: args.newPassword },
    });
    await invalidateSessions(ctx, { userId: args.userId });

    await ctx.runMutation(internal.members.recordPasswordSecurityEvent, {
      actorId,
      action: "password_reset",
      target: `user:${args.userId}`,
      metadata: JSON.stringify({
        metadataVersion: 1,
        targetEmail: target.email,
      }),
    });
    return true;
  },
});

export const getPasswordActor = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) return null;
    return {
      _id: user._id,
      email: user.email ? normalizeEmail(user.email) : undefined,
      active: user.active !== false,
      isAnonymous: user.isAnonymous === true,
    };
  },
});

export const ensurePasswordAccount = internalMutation({
  args: { userId: v.id("users"), email: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("authAccounts")
      .withIndex("providerAndAccountId", (q) =>
        q.eq("provider", "password").eq("providerAccountId", args.email),
      )
      .first();
    if (existing) {
      if (existing.userId !== args.userId) {
        throw new ConvexError(
          "Ese correo ya está vinculado a otra cuenta de contraseña.",
        );
      }
      return existing._id;
    }
    return await ctx.db.insert("authAccounts", {
      userId: args.userId,
      provider: "password",
      providerAccountId: args.email,
    });
  },
});

export const recordPasswordSecurityEvent = internalMutation({
  args: {
    actorId: v.id("users"),
    actorEmail: v.optional(v.string()),
    action: v.union(v.literal("password_change"), v.literal("password_reset")),
    target: v.string(),
    metadata: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await logSecurityEvent(ctx, args);
  },
});

/** Comprobación de rol para las acciones (no tienen acceso directo a la BD). */
export const getAdminActor = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user || !isAdminUser(user)) {
      throw new ConvexError(
        "Solo el administrador puede gestionar usuarios y roles.",
      );
    }
    return user._id;
  },
});

/** ¿Ya hay una cuenta con ese correo? (para el alta, antes de crearla). */
export const findUserByEmail = internalQuery({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", args.email))
      .first();
    return existing?._id ?? null;
  },
});

/** Estado actual del usuario destino (alta/baja). */
export const getTargetUser = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) throw new ConvexError("El usuario ya no existe.");
    return { active: user.active !== false };
  },
});

/** Cambia el estado activo/baja en la ficha del usuario. */
export const patchActive = internalMutation({
  args: {
    userId: v.id("users"),
    active: v.boolean(),
    actorId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const target = await ctx.db.get(args.userId);
    await ctx.db.patch(args.userId, { active: args.active });
    await logSecurityEvent(ctx, {
      actorId: args.actorId,
      action: "account_status_change",
      target: `user:${args.userId}`,
      metadata: {
        active: args.active,
        targetEmail: target?.email,
        targetName: target?.name,
      },
    });
  },
});

/**
 * Usuarios que pueden recibir el trabajo (coordinador/admin al asignar una
 * incidencia). No confundir con `list`, que es solo para administradores.
 *
 * El técnico de taller también cambia a quién le toca la orden —siempre pudo
 * hacerlo en el servidor (`incidents.assignWorkshop`)—, pero solo la que lleva,
 * así que la lista se abre con esa incidencia delante (`incidentId`). Sin la
 * incidencia, la puerta sigue siendo la de coordinación.
 */
export const listAssignable = query({
  args: { incidentId: v.optional(v.id("incidents")) },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    const me = await ctx.db.get(userId);
    const canCoordinate =
      me !== null && (await hasCapability(ctx, me, "manageIncidents"));
    // El caso se mira solo si hace falta: quien coordina no lo necesita.
    const incident =
      !canCoordinate && args.incidentId !== undefined
        ? await ctx.db.get(args.incidentId)
        : null;
    const ownsWorkshopOrder =
      !canCoordinate && me !== null && incident?.workshopAssigneeId === me._id;
    if (!canCoordinate && !ownsWorkshopOrder) {
      throw new ConvexError(
        "Solo el coordinador o el técnico de la orden de taller pueden asignar incidencias a otros técnicos.",
      );
    }
    const users = await ctx.db.query("users").collect();
    return users
      .filter(
        (user) => effectiveUserRoles(user).length > 0 && user.active !== false,
      )
      .map((user) => {
        const roles = effectiveUserRoles(user);
        return {
          _id: user._id,
          name:
            user.name?.trim() || user.email?.trim() || "Usuario del taller",
          email: user.email ?? null,
          role: roles[0] ?? null,
          roles,
          position: user.position ?? null,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name, "es"));
  },
});

/** Listado de usuarios del taller (solo administrador). */
export const list = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const users = await ctx.db.query("users").collect();
    return users
      .map((user) => {
        const roles = effectiveUserRoles(user);
        return {
          _id: user._id,
          name: user.name ?? null,
          email: user.email ?? null,
          role: roles[0] ?? null,
          roles,
          position: user.position ?? null,
          location: user.location ?? null,
          phone: user.phone ?? null,
          active: user.active !== false,
          isAnonymous: user.isAnonymous ?? false,
        };
      })
      .sort((a, b) => (a.email ?? "").localeCompare(b.email ?? ""));
  },
});

/**
 * Revoca inmediatamente todas las sesiones y refresh tokens activos de un
 * usuario en las tablas de `@convex-dev/auth`, usable dentro de mutaciones
 * atómicas (p. ej. cambio de rol o revocación explícita).
 */
async function revokeAllUserSessions(
  ctx: MutationCtx,
  userId: Id<"users">,
): Promise<number> {
  const sessions = await ctx.db
    .query("authSessions")
    .withIndex("userId", (q) => q.eq("userId", userId))
    .collect();
  for (const session of sessions) {
    const tokens = await ctx.db
      .query("authRefreshTokens")
      .withIndex("sessionId", (q) => q.eq("sessionId", session._id))
      .collect();
    for (const token of tokens) {
      await ctx.db.delete(token._id);
    }
    await ctx.db.delete(session._id);
  }
  return sessions.length;
}

/** Cambia los roles de un usuario (solo administrador, nunca los propios) y revoca sus sesiones activas. */
async function applyUserRolesChange(
  ctx: MutationCtx,
  args: {
    actorId: Id<"users">;
    userId: Id<"users">;
    roles: readonly string[];
    singleRoleError?: string;
  },
): Promise<void> {
  if (args.userId === args.actorId) {
    throw new ConvexError(
      args.singleRoleError ?? "No puedes cambiar tus propios roles.",
    );
  }
  const target = await ctx.db.get(args.userId);
  if (!target) throw new ConvexError("El usuario ya no existe.");
  if (target.isAnonymous === true) {
    throw new ConvexError(
      "No se pueden cambiar los roles de una cuenta de invitado.",
    );
  }

  const normalized = normalizeUserRoles(args.roles);
  if (normalized.length === 0) {
    throw new ConvexError("Asigna al menos un rol al usuario.");
  }
  if (normalized.includes(ROLES.GUEST)) {
    throw new ConvexError("El rol de invitado es solo para sesiones anónimas.");
  }
  for (const key of normalized) {
    if (!(await roleExists(ctx, key))) {
      throw new ConvexError("El rol indicado no existe.");
    }
  }

  const previousRoles = effectiveUserRoles(target);
  if (areRoleListsEqual(previousRoles, normalized)) return;

  const previousPrimary = previousRoles[0] ?? target.role;
  const nextPrimary = primaryUserRole(normalized);
  await ctx.db.patch(args.userId, { role: nextPrimary, roles: normalized });
  const revokedSessions = await revokeAllUserSessions(ctx, args.userId);

  const hadAdmin = previousRoles.includes(ROLES.ADMIN);
  const hasAdmin = normalized.includes(ROLES.ADMIN);
  if (hadAdmin !== hasAdmin) {
    await notifySecurityAlert(ctx, {
      message: `Alerta de seguridad: cambio de rol administrativo (${previousRoles.join(", ") || "sin rol"} -> ${normalized.join(", ")}) para ${target.name ?? target.email ?? args.userId}.`,
      exceptUserId: args.actorId,
    });
  }

  await logSecurityEvent(ctx, {
    actorId: args.actorId,
    action: "role_change",
    target: `user:${args.userId}`,
    metadata: {
      previousRole: previousPrimary,
      newRole: nextPrimary,
      previousRoles,
      newRoles: normalized,
      targetEmail: target.email,
      targetName: target.name,
      revokedSessions,
    },
  });
}

const setRolesArgs = {
  userId: v.id("users"),
  roles: v.array(roleValidator),
};

export const setRoles = mutation({
  args: setRolesArgs,
  handler: secureMutation(
    {
      capability: "manageUsers",
      identityMessage: identityNotice(
        "Debes iniciar sesión para gestionar usuarios.",
      ),
      denyMessage: "Solo el administrador puede gestionar usuarios y roles.",
    },
    setRolesArgs,
    async (ctx, args, actor) => {
      await applyUserRolesChange(ctx, {
        actorId: actor._id,
        userId: args.userId,
        roles: args.roles,
      });
    },
  ),
});

/** Cambia el rol de un usuario (solo administrador, nunca el propio) y revoca sus sesiones activas. */
const setRoleArgs = {
  userId: v.id("users"),
  role: roleValidator,
};

export const setRole = mutation({
  args: setRoleArgs,
  handler: secureMutation(
    {
      capability: "manageUsers",
      identityMessage: identityNotice(
        "Debes iniciar sesión para gestionar usuarios.",
      ),
      denyMessage: "Solo el administrador puede gestionar usuarios y roles.",
    },
    setRoleArgs,
    async (ctx, args, actor) => {
      await applyUserRolesChange(ctx, {
        actorId: actor._id,
        userId: args.userId,
        roles: [args.role],
        singleRoleError: "No puedes cambiar tu propio rol.",
      });
    },
  ),
});


const revokeSessionsArgs = {
  userId: v.optional(v.id("users")),
};

/**
 * Revoca todas las sesiones activas propias o (si es administrador) de otro
 * usuario ante sospecha de compromiso de cuenta.
 */
export const revokeSessions = mutation({
  args: revokeSessionsArgs,
  handler: secureMutation(
    {
      identityMessage: identityNotice(
        "Debes iniciar sesión para cerrar sesiones activas.",
      ),
      denyMessage:
        "Solo el administrador puede cerrar sesiones de otro usuario.",
      authorize: async (_ctx, actor, args) => {
        if (
          args.userId !== undefined &&
          args.userId !== actor._id &&
          !isAdminUser(actor)
        ) {
          return "Solo el administrador puede cerrar sesiones de otro usuario.";
        }
        return null;
      },
    },
    revokeSessionsArgs,
    async (ctx, args, actor) => {
      const targetId = args.userId ?? actor._id;
      const target = await ctx.db.get(targetId);
      if (!target) throw new ConvexError("El usuario ya no existe.");
      const revoked = await revokeAllUserSessions(ctx, targetId);
      await logSecurityEvent(ctx, {
        actorId: actor._id,
        action: "session_revoked",
        target: `user:${targetId}`,
        metadata: {
          revoked,
          selfService: targetId === actor._id,
          targetEmail: target.email,
        },
      });
      return { revoked };
    },
  ),
});

export const getMemberSummary = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const target = await ctx.db.get(args.userId);
    if (!target) {
      return null;
    }

    const assigned = effectiveUserRoles(target);
    const grants = await grantsForRoles(
      ctx,
      assigned.length > 0 ? assigned : [DEFAULT_ROLE],
    );
    const capabilities = CAPABILITIES.filter((c) => Boolean(grants[c.id])).map(
      (c) => ({ key: c.id, label: c.label }),
    );

    // Las mismas capacidades, contadas por el rol que las concede: con varios
    // roles, el administrador ve de dónde viene cada permiso.
    const byRole: {
      roleKey: string;
      capabilities: { key: string; label: string }[];
    }[] = [];
    for (const roleKey of [
      ...new Set(assigned.length > 0 ? assigned : [DEFAULT_ROLE]),
    ]) {
      const roleGrants = await grantsForRole(ctx, roleKey);
      byRole.push({
        roleKey,
        capabilities: CAPABILITIES.filter((c) => Boolean(roleGrants[c.id])).map(
          (c) => ({ key: c.id, label: c.label }),
        ),
      });
    }

    const allIncidents = await ctx.db.query("incidents").collect();
    const assignedIncidents = allIncidents.filter(
      (inc) =>
        inc.deletedAt === undefined &&
        (inc.assigneeId === args.userId ||
          inc.workshopAssigneeId === args.userId),
    );
    const activeAssignedIncidents = assignedIncidents.filter(
      (inc) => !isClosedIncident(inc.status),
    ).length;

    const allRequests = await ctx.db.query("partRequests").collect();
    const userRequestsCount = allRequests.filter(
      (req) => req.deletedAt === undefined && req.requesterId === args.userId,
    ).length;

    const recentMovements = (
      await ctx.db
        .query("stockMovements")
        .withIndex("by_createdAt")
        .order("desc")
        .take(120)
    )
      .filter((m) => m.actorId === args.userId)
      .slice(0, 8);

    return {
      assignedIncidentsTotal: assignedIncidents.length,
      activeAssignedIncidents,
      requestsCount: userRequestsCount,
      capabilities,
      byRole,
      recentMovements,
    };
  },
});
