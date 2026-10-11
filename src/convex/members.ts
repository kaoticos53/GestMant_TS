import {
  createAccount,
  getAuthUserId,
  invalidateSessions,
} from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import { ADMIN_EMAIL, DEFAULT_ROLE } from "../lib/roles";
import { clampSidebarWidth } from "../lib/sidebar";
import { dismissalOf } from "../lib/workAlert";
import { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { hasCapability, roleExists } from "./permissions";
import {
  QueryCtx,
  action,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { ROLES, roleValidator } from "./schema";

async function requireUser(ctx: QueryCtx) {
  const userId = await getAuthUserId(ctx);
  if (userId === null) {
    throw new ConvexError("Debes iniciar sesión para gestionar usuarios.");
  }
  return userId;
}

async function requireAdmin(ctx: QueryCtx): Promise<Id<"users">> {
  const userId = await requireUser(ctx);
  const user = await ctx.db.get(userId);
  if (user?.role !== ROLES.ADMIN) {
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
 * Asigna el rol la primera vez que entra un usuario: el administrador si su
 * correo coincide con el de la cuenta admin de la página de acceso; el resto,
 * técnicos (un administrador puede promoverlos después).
 */
export const ensureRole = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUser(ctx);
    const user = await ctx.db.get(userId);
    if (!user) throw new ConvexError("Usuario no encontrado.");

    if (user.role) return user.role;

    const role =
      user.email?.trim().toLowerCase() === ADMIN_EMAIL
        ? ROLES.ADMIN
        : DEFAULT_ROLE;
    await ctx.db.patch(userId, { role });
    return role;
  },
});

/** Actualiza el perfil de la propia persona (nunca el rol ni el estado). */
export const updateProfile = mutation({
  args: profileArgs,
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
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
});

/**
 * Guarda en el propio perfil cómo tiene colocado el menú lateral (ancho y
 * plegado), para que su próximo acceso lo encuentre igual venga del navegador
 * que venga. El backend no conoce el tamaño de la ventana, así que solo aplica
 * los límites propios del panel; el navegador ajusta el resto.
 */
export const saveSidebarLayout = mutation({
  args: { width: v.number(), collapsed: v.boolean() },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    await ctx.db.patch(userId, {
      sidebarWidth: clampSidebarWidth(args.width, Number.POSITIVE_INFINITY),
      sidebarCollapsed: args.collapsed,
    });
    return true;
  },
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
export const saveWorkAlertDismissal = mutation({
  args: {
    dismissal: v.union(
      v.object({
        marginDays: v.number(),
        references: v.array(v.string()),
      }),
      v.null(),
    ),
  },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
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
});

/** El administrador modifica el perfil de cualquier usuario. */
export const updateUser = mutation({
  args: { userId: v.id("users"), ...profileArgs },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
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
    role: roleValidator,
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
    const roleOk = await ctx.runQuery(internal.permissions.roleKeyExists, {
      key: args.role,
    });
    if (!roleOk) {
      throw new ConvexError("El rol indicado no existe.");
    }

    const position = trimmed(args.position);
    const location = trimmed(args.location);
    const phone = trimmed(args.phone);
    const { user } = await createAccount(ctx, {
      provider: "password",
      account: { id: email, secret: args.password },
      profile: {
        email,
        name,
        role: args.role,
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
    });
    if (!args.active) {
      await invalidateSessions(ctx, { userId: args.userId });
    }
    return true;
  },
});

/** Comprobación de rol para las acciones (no tienen acceso directo a la BD). */
export const getAdminActor = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user || user.role !== ROLES.ADMIN) {
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
  args: { userId: v.id("users"), active: v.boolean() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.userId, { active: args.active });
  },
});

/**
 * Usuarios que pueden recibir el trabajo (coordinador/admin al asignar una
 * incidencia). No confundir con `list`, que es solo para administradores.
 */
export const listAssignable = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUser(ctx);
    const me = await ctx.db.get(userId);
    if (!me || !(await hasCapability(ctx, me, "manageIncidents"))) {
      throw new ConvexError(
        "Solo el coordinador puede asignar incidencias a otros técnicos.",
      );
    }
    const users = await ctx.db.query("users").collect();
    return users
      .filter((user) => user.role !== undefined && user.active !== false)
      .map((user) => ({
        _id: user._id,
        name: user.name?.trim() || user.email?.trim() || "Usuario del taller",
        email: user.email ?? null,
        role: user.role,
        position: user.position ?? null,
      }))
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
      .map((user) => ({
        _id: user._id,
        name: user.name ?? null,
        email: user.email ?? null,
        role: user.role ?? null,
        position: user.position ?? null,
        location: user.location ?? null,
        phone: user.phone ?? null,
        active: user.active !== false,
        isAnonymous: user.isAnonymous ?? false,
      }))
      .sort((a, b) => (a.email ?? "").localeCompare(b.email ?? ""));
  },
});

/** Cambia el rol de un usuario (solo administrador, nunca el propio). */
export const setRole = mutation({
  args: {
    userId: v.id("users"),
    role: roleValidator,
  },
  handler: async (ctx, args) => {
    const adminId = await requireAdmin(ctx);
    if (args.userId === adminId) {
      throw new ConvexError("No puedes cambiar tu propio rol.");
    }
    const target = await ctx.db.get(args.userId);
    if (!target) throw new ConvexError("El usuario ya no existe.");
    if (!(await roleExists(ctx, args.role))) {
      throw new ConvexError("El rol indicado no existe.");
    }
    if (target.role === args.role) return;

    await ctx.db.patch(args.userId, { role: args.role });
  },
});
