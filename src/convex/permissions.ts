import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import {
  CAPABILITIES,
  DEFAULT_GRANTS,
  isKnownCapability,
  type Capability,
} from "../lib/permissions";
import { DEFAULT_ROLE, ROLE_META, STAFF_ROLES, type Role } from "../lib/roles";
import { Doc, Id } from "./_generated/dataModel";
import {
  MutationCtx,
  QueryCtx,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { ROLES, roleValidator } from "./schema";

type Ctx = QueryCtx | MutationCtx;

/** Longitud máxima del nombre visible de un rol. */
const MAX_LABEL = 60;

/** Claves que nacen en el código: no se crean ni se borran. */
export function isSystemKey(key: string): key is Role {
  return (
    key === ROLES.ADMIN ||
    key === ROLES.MANAGER ||
    key === ROLES.TECHNICIAN ||
    key === ROLES.GUEST
  );
}

/**
 * Clave única a partir del nombre: sin acentos, minúsculas y guiones,
 * p. ej. «Auxiliar de almacén» → «auxiliar-de-almacen».
 */
function slugify(label: string): string {
  return label
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Fila guardada de un rol (los del sistema existen aunque no tengan fila). */
async function getRoleRow(ctx: Ctx, key: string) {
  return await ctx.db
    .query("roles")
    .withIndex("by_key", (q) => q.eq("key", key))
    .first();
}

/** ¿Se puede asignar esa clave de rol a un usuario? */
export async function roleExists(ctx: Ctx, key: string): Promise<boolean> {
  if (isSystemKey(key)) return true;
  return (await getRoleRow(ctx, key)) !== null;
}

/** Una opción de rol para los ajustes que se reparten por rol (los avisos). */
export interface SettingsRoleOption {
  key: string;
  label: string;
  description: string;
}

/**
 * Roles a los que se puede apuntar un aviso: los del taller y los propios, con
 * la etiqueta que tienen hoy. Los personalizados van por nombre, para que la
 * lista no cambie de orden según se vayan creando. Lo comparten los ajustes de
 * los avisos (trabajo sin constancia, expediente y resumen semanal), que si no
 * repetirían la misma consulta y acabarían enseñando cosas distintas. El
 * invitado no está: a una sesión anónima no se le manda nada.
 */
export async function settingsRoleOptions(
  ctx: Ctx,
): Promise<SettingsRoleOption[]> {
  const rows = await ctx.db.query("roles").collect();
  const customs = rows
    .filter((row) => row.kind === "custom")
    .sort((a, b) => a.label.localeCompare(b.label, "es"));
  return [
    ...STAFF_ROLES.map((key) => ({
      key: key as string,
      label: ROLE_META[key].label,
      description: ROLE_META[key].description,
    })),
    ...customs.map((row) => ({
      key: row.key,
      label: row.label,
      description: row.description,
    })),
  ];
}

/**
 * Claves de rol listas para guardar en unos ajustes de aviso: sin repetidos y
 * solo con roles que existan hoy. Un rol borrado no se queda en la lista dando
 * a entender que alguien lo recibe.
 */
export async function normalizeSettingsRoleKeys(
  ctx: Ctx,
  roleKeys: readonly string[],
): Promise<string[]> {
  const unique = [...new Set(roleKeys)];
  const unknown: string[] = [];
  for (const key of unique) {
    if (!(await roleExists(ctx, key))) unknown.push(key);
  }
  if (unknown.length > 0) {
    throw new ConvexError(`Esos roles ya no existen: ${unknown.join(", ")}.`);
  }
  return unique;
}

/** Todos los permisos en false (base de un rol personalizado). */
function emptyGrants(): Record<Capability, boolean> {
  const grants = {} as Record<Capability, boolean>;
  for (const item of CAPABILITIES) grants[item.id] = false;
  return grants;
}

/** Defaults: del código para los roles del sistema; vacíos para personalizados. */
function baseGrants(roleKey: string): Record<Capability, boolean> {
  if (isSystemKey(roleKey)) return { ...DEFAULT_GRANTS[roleKey] };
  return emptyGrants();
}

/**
 * Permisos efectivos: lo guardado se superpone a los defaults, las
 * capacidades bloqueadas nunca se conceden y las claves ajenas se descartan.
 */
function effectiveGrants(
  roleKey: string,
  stored: Partial<Record<Capability, boolean>> | null | undefined,
): Record<Capability, boolean> {
  const grants = baseGrants(roleKey);
  for (const item of CAPABILITIES) {
    const value = stored?.[item.id];
    if (value === undefined || item.locked === true) continue;
    grants[item.id] = value;
  }
  return grants;
}

/** Permisos efectivos de una clave (fail-closed si es un rol personalizado huérfano). */
export async function grantsForRole(
  ctx: Ctx,
  roleKey: string,
): Promise<Record<Capability, boolean>> {
  const row = await getRoleRow(ctx, roleKey);
  return effectiveGrants(roleKey, row?.grants ?? null);
}

/** ¿Tiene esa capacidad esa clave de rol? (la del administrador, siempre). */
export async function roleCan(
  ctx: Ctx,
  roleKey: string,
  capability: Capability,
): Promise<boolean> {
  if (roleKey === ROLES.ADMIN) return true;
  return (await grantsForRole(ctx, roleKey))[capability] === true;
}

/**
 * ¿Puede el usuario esa capacidad? El administrador siempre; el resto según
 * la configuración de roles (sin configuración → defaults del sistema).
 */
export async function hasCapability(
  ctx: Ctx,
  user: Doc<"users">,
  capability: Capability,
): Promise<boolean> {
  if (user.active === false || user.isAnonymous === true) {
    return false;
  }
  return await roleCan(ctx, user.role ?? DEFAULT_ROLE, capability);
}

/**
 * ¿Tiene alguna de esas capacidades? Para las lecturas que sirven a más de un
 * flujo (el catálogo se lee desde su módulo y desde las peticiones).
 */
export async function hasAnyCapability(
  ctx: Ctx,
  user: Doc<"users">,
  capabilities: Capability[],
): Promise<boolean> {
  for (const capability of capabilities) {
    if (await hasCapability(ctx, user, capability)) return true;
  }
  return false;
}

/**
 * La persona de la sesión, o `null` si no es del taller: sin sesión, invitado o
 * cuenta dada de baja. Es para las lecturas que el panel pide al montar y que
 * deben degradar a vacío en vez de lanzar: un error ahí tumbaba la entrada como
 * invitado —y a una cuenta desactivada— en vez de dejar el panel sin datos.
 * Las escrituras no usan esto: siguen exigiendo una cuenta con su capacidad.
 */
export async function memberOrNull(ctx: Ctx): Promise<Doc<"users"> | null> {
  const userId = await getAuthUserId(ctx);
  const user = userId === null ? null : await ctx.db.get(userId);
  if (!user || user.active === false || user.isAnonymous === true) return null;
  return user;
}

/** Usuario autenticado o error. */
async function requireActor(ctx: Ctx): Promise<Doc<"users">> {
  const userId = await getAuthUserId(ctx);
  const user = userId === null ? null : await ctx.db.get(userId);
  if (!user || user.active === false) {
    throw new ConvexError(
      user?.active === false
        ? "Esta cuenta ha sido dada de baja o no está activa."
        : "Debes iniciar sesión para ver los permisos.",
    );
  }
  return user;
}

/**
 * Mensaje único de «esto es de los mandos del taller». Vive aquí porque lo usan
 * tanto las consultas y mutaciones como las acciones, que no pueden consultar
 * los permisos por su cuenta y comprueban la sesión a mano.
 */
export function coordinatorOnlyMessage(what: string): string {
  return `Solo quien coordina las incidencias o decide las peticiones puede ${what}. Revisa la configuración de tu rol con el administrador.`;
}

/**
 * Quien coordina las incidencias o decide las peticiones: los mandos del
 * taller. Lo comparten los ajustes que afectan a toda la cola —el archivo y el
 * resumen semanal—, para que el permiso que abre uno abra el otro.
 */
export async function requireCoordinator(
  ctx: Ctx,
  what: string,
): Promise<Doc<"users">> {
  const user = await requireActor(ctx);
  if (!(await canCoordinate(ctx, user))) {
    throw new ConvexError(coordinatorOnlyMessage(what));
  }
  return user;
}

/** ¿Es esta persona uno de los mandos del taller? */
export async function canCoordinate(
  ctx: Ctx,
  user: Doc<"users">,
): Promise<boolean> {
  return await hasAnyCapability(ctx, user, ["manageIncidents", "decideRequests"]);
}

/**
 * Los mandos del taller en activo, para los avisos que son cosa suya y no de una
 * ficha concreta: el de la limpieza del almacén, que avisa antes de llevarse las
 * fotos que el formulario público dejó sin usar. Es el puesto, no una lista que
 * se configure: quien coordina las incidencias o decide las peticiones es quien
 * ve el panel de limpieza y quien rescata de la papelera, así que es quien tiene
 * que enterarse. El administrador entra siempre, como en todo lo demás.
 */
export async function coordinatorIds(ctx: Ctx): Promise<Id<"users">[]> {
  const users = await ctx.db.query("users").collect();
  const ids: Id<"users">[] = [];
  for (const user of users) {
    if (user.active === false) continue;
    if (await canCoordinate(ctx, user)) ids.push(user._id);
  }
  return ids;
}

/** Solo el administrador puede consultar o cambiar roles y permisos. */
async function requireAdmin(ctx: Ctx): Promise<Doc<"users">> {
  const user = await requireActor(ctx);
  if (user.role !== ROLES.ADMIN) {
    throw new ConvexError(
      "Solo el administrador puede gestionar roles y permisos.",
    );
  }
  return user;
}

/** Etiqueta visible de una clave mientras no haya fila guardada. */
function fallbackLabel(key: string): { label: string; description: string } {
  if (isSystemKey(key)) {
    return { label: ROLE_META[key].label, description: ROLE_META[key].description };
  }
  return { label: key, description: "Rol personalizado del taller" };
}

/** Permisos y etiqueta del rol del usuario actual (menú y vistas). */
export const myPermissions = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireActor(ctx);
    // El invitado no tiene permisos de taller: se le responde con los del rol
    // guest aunque el backend todavía no se lo haya asignado, para que el menú
    // no enseñe módulos que luego no puede abrir.
    const key =
      user.isAnonymous === true ? ROLES.GUEST : (user.role ?? DEFAULT_ROLE);
    const row = await getRoleRow(ctx, key);
    const fallback = fallbackLabel(key);
    return {
      role: key,
      kind: row?.kind ?? (isSystemKey(key) ? "system" : "custom"),
      label: row?.label ?? fallback.label,
      description: row?.description ?? fallback.description,
      grants: await grantsForRole(ctx, key),
    };
  },
});

/** ¿Existe esa clave de rol? (para las acciones, que no leen la BD). */
export const roleKeyExists = internalQuery({
  args: { key: v.string() },
  handler: async (ctx, args) => await roleExists(ctx, args.key),
});

/**
 * Matriz de roles y permisos (solo administrador): los del sistema que se
 * reparten entre el taller más los personalizados, con el número de personas
 * que tienen cada uno. El invitado no sale: no se asigna ni tiene permisos que
 * configurar (solo puede consultar una incidencia por su referencia).
 */
export const listRoles = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const rows = await ctx.db.query("roles").collect();
    const users = await ctx.db.query("users").collect();
    const counts = new Map<string, number>();
    for (const user of users) {
      const key = user.role ?? DEFAULT_ROLE;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }

    const roles: {
      key: string;
      label: string;
      description: string;
      kind: "system" | "custom";
      grants: Record<Capability, boolean>;
      userCount: number;
    }[] = [];
    for (const key of STAFF_ROLES) {
      const row = rows.find((item) => item.key === key);
      const fallback = fallbackLabel(key);
      roles.push({
        key,
        label: row?.label ?? fallback.label,
        description: row?.description ?? fallback.description,
        kind: "system",
        grants: await grantsForRole(ctx, key),
        userCount: counts.get(key) ?? 0,
      });
    }
    const customs = rows
      .filter((row) => row.kind === "custom")
      .sort((a, b) => a.label.localeCompare(b.label, "es"));
    for (const row of customs) {
      roles.push({
        key: row.key,
        label: row.label,
        description: row.description,
        kind: "custom",
        grants: await grantsForRole(ctx, row.key),
        userCount: counts.get(row.key) ?? 0,
      });
    }
    return roles;
  },
});

/** Guarda los permisos de un rol (solo administrador; su rol no se toca). */
export const setRolePermissions = mutation({
  args: {
    role: roleValidator,
    grants: v.record(v.string(), v.boolean()),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    if (args.role === ROLES.ADMIN) {
      throw new ConvexError(
        "El administrador siempre tiene todos los permisos.",
      );
    }
    if (!(await roleExists(ctx, args.role))) {
      throw new ConvexError("Ese rol ya no existe.");
    }
    const unknown = Object.keys(args.grants).filter(
      (key) => !isKnownCapability(key),
    );
    if (unknown.length > 0) {
      throw new ConvexError(`Capacidad desconocida: ${unknown.join(", ")}.`);
    }

    const grants = effectiveGrants(args.role, args.grants);
    const now = Date.now();
    const existing = await getRoleRow(ctx, args.role);
    if (existing) {
      await ctx.db.patch(existing._id, {
        grants,
        updatedAt: now,
        updatedBy: admin._id,
      });
    } else {
      // Un rol del sistema sin fila: se materializa con sus datos de código.
      const fallback = fallbackLabel(args.role);
      await ctx.db.insert("roles", {
        key: args.role,
        label: fallback.label,
        description: fallback.description,
        kind: "system",
        grants,
        createdAt: now,
        updatedAt: now,
        updatedBy: admin._id,
      });
    }
    return true;
  },
});

/** Valida el nombre visible de un rol y lo devuelve recortado. */
function validLabel(label: string): string {
  const trimmed = label.trim();
  if (!trimmed) throw new ConvexError("Indica el nombre del rol.");
  if (trimmed.length > MAX_LABEL) {
    throw new ConvexError(
      `El nombre del rol no puede superar los ${MAX_LABEL} caracteres.`,
    );
  }
  return trimmed;
}

/**
 * Crea un rol personalizado a partir de una plantilla (otro rol). Devuelve
 * la clave generada a partir del nombre.
 */
export const createRole = mutation({
  args: {
    label: v.string(),
    description: v.optional(v.string()),
    templateKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const label = validLabel(args.label);
    const key = slugify(label);
    if (!key) {
      throw new ConvexError("El nombre del rol debe contener letras o números.");
    }
    if (isSystemKey(key)) {
      throw new ConvexError(
        `«${key}» es una clave reservada del sistema: elige otro nombre.`,
      );
    }
    if (await getRoleRow(ctx, key)) {
      throw new ConvexError(
        "Ya existe un rol con un nombre similar. Elige otro.",
      );
    }

    let grants: Record<Capability, boolean>;
    if (args.templateKey !== undefined) {
      if (args.templateKey === ROLES.ADMIN) {
        throw new ConvexError(
          "El administrador siempre tiene todos los permisos: elige otro rol de partida.",
        );
      }
      if (!(await roleExists(ctx, args.templateKey))) {
        throw new ConvexError("El rol de partida ya no existe.");
      }
      grants = await grantsForRole(ctx, args.templateKey);
    } else {
      grants = await grantsForRole(ctx, DEFAULT_ROLE);
    }

    const now = Date.now();
    await ctx.db.insert("roles", {
      key,
      label,
      description: args.description?.trim() ?? "",
      kind: "custom",
      grants,
      createdAt: now,
      updatedAt: now,
      updatedBy: admin._id,
    });
    return key;
  },
});

/** Renombra un rol personalizado (la clave, que es la que se guarda, no cambia). */
export const updateRole = mutation({
  args: {
    key: v.string(),
    label: v.string(),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    if (isSystemKey(args.key)) {
      throw new ConvexError(
        "Los roles del sistema no se pueden renombrar.",
      );
    }
    const row = await getRoleRow(ctx, args.key);
    if (!row) throw new ConvexError("Ese rol ya no existe.");
    const label = validLabel(args.label);
    await ctx.db.patch(row._id, {
      label,
      // Argumento omitido = no tocar; cadena vacía = limpiar la descripción.
      ...(args.description !== undefined
        ? { description: args.description.trim() }
        : {}),
      updatedAt: Date.now(),
      updatedBy: admin._id,
    });
    return true;
  },
});

/**
 * Borra un rol personalizado. Solo si nadie lo tiene asignado: primero hay
 * que reasignar a esas personas desde el módulo de usuarios.
 */
export const deleteRole = mutation({
  args: { key: v.string() },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    if (isSystemKey(args.key)) {
      throw new ConvexError("Los roles del sistema no se pueden borrar.");
    }
    const row = await getRoleRow(ctx, args.key);
    if (!row) throw new ConvexError("Ese rol ya no existe.");

    const users = await ctx.db.query("users").collect();
    const assigned = users.filter((user) => user.role === args.key).length;
    if (assigned > 0) {
      throw new ConvexError(
        `Hay ${assigned} ${assigned === 1 ? "persona" : "personas"} con este rol: ` +
          "reasígnalas desde el módulo de usuarios antes de borrarlo.",
      );
    }
    await ctx.db.delete(row._id);
    return true;
  },
});

/** Catálogo de capacidades (etiquetas para pintar la matriz en el cliente). */
export const capabilities = query({
  args: {},
  handler: async (ctx) => {
    await requireActor(ctx);
    return CAPABILITIES.map((item) => ({
      id: item.id,
      group: item.group,
      label: item.label,
      description: item.description,
      locked: item.locked === true,
    }));
  },
});
