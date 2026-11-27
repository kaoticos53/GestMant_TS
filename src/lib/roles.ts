/**
 * Claves de rol que nacen en el código (el resto son personalizadas y viven
 * en la tabla `roles` con su propia etiqueta y permisos).
 */
export type SystemRole = "admin" | "manager" | "technician" | "guest";

/** Las claves del sistema, en el orden en que se muestran. */
export const SYSTEM_ROLES: SystemRole[] = ["admin", "manager", "technician", "guest"];

/**
 * Los roles del sistema que se reparten entre las personas del taller, en el
 * orden en que se muestran: los que se asignan a una cuenta y a los que se
 * puede apuntar un aviso o un resumen. «Invitado» queda fuera a propósito: no
 * es un rol que se le dé a nadie —es la sesión anónima de consulta— y por eso no
 * sale en la matriz de permisos, en el alta de usuarios ni en los avisos.
 */
export const STAFF_ROLES: SystemRole[] = ["admin", "manager", "technician"];

/**
 * Roles que coordinan el taller: los que deciden sobre el día a día de todos.
 * Es el reparto de partida de los avisos que no se dirigen a una sola persona.
 */
export const COORDINATION_ROLES: SystemRole[] = ["admin", "manager"];

/**
 * Alias estrecho: los roles del sistema. Para claves dinámicas (incluidas las
 * personalizadas) usa `RoleKey`.
 */
export type Role = SystemRole;

/** Cualquier clave de rol: del sistema o creada por el administrador. */
export type RoleKey = string;

/** Correo inicial de administrador (si se define en inicialización). */
export const ADMIN_EMAIL = "admin@taller.es";

/** Rol que recibe quien se registra sin ser el administrador. */
export const DEFAULT_ROLE: SystemRole = "technician";
export const GUEST_ROLE: SystemRole = "guest";

export const ROLE_META: Record<
  SystemRole,
  {
    label: string;
    description: string;
    badgeClassName: string;
  }
> = {
  admin: {
    label: "Administrador",
    description: "Gestiona usuarios y roles, además de todo lo del responsable",
    badgeClassName: "border-signal/25 bg-signal/10 text-signal",
  },
  manager: {
    label: "Responsable de repuestos",
    description: "Aprueba peticiones y gestiona repuestos y equipos",
    badgeClassName:
      "border-emerald-600/25 bg-emerald-600/10 text-emerald-700 dark:text-emerald-300",
  },
  technician: {
    label: "Técnico",
    description: "Crea peticiones de repuestos y consulta su estado",
    badgeClassName: "border-border bg-muted text-muted-foreground",
  },
  guest: {
    label: "Invitado",
    description: "Sesión anónima de consulta sin permisos de gestión ni taller",
    badgeClassName: "border-border bg-muted/60 text-muted-foreground",
  },
};

/** Estilo de la píldora para un rol personalizado. */
export const CUSTOM_BADGE_CLASS =
  "border-sky-600/25 bg-sky-600/10 text-sky-700";

/** ¿Es una de las claves que nacen en el código? */
export function isSystemRole(
  key: string | null | undefined,
): key is SystemRole {
  return key === "admin" || key === "manager" || key === "technician" || key === "guest";
}

/** ¿Puede gestionar usuarios y roles? */
export function isAdmin(role: RoleKey | null | undefined): boolean {
  return role === "admin";
}

/** Origen mínimo para leer el rol o la lista de roles de un usuario. */
export interface UserRolesSource {
  role?: RoleKey | null;
  roles?: readonly RoleKey[] | null;
  isAnonymous?: boolean;
}

/** Normaliza una lista de roles: recorta, quita repetidos y prioriza `admin`. */
export function normalizeUserRoles(roles: readonly RoleKey[]): RoleKey[] {
  const seen = new Set<string>();
  const cleaned: RoleKey[] = [];
  for (const raw of roles) {
    const key = raw.trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    cleaned.push(key);
  }
  const adminIndex = cleaned.indexOf("admin");
  if (adminIndex > 0) {
    cleaned.splice(adminIndex, 1);
    cleaned.unshift("admin");
  }
  return cleaned;
}

/** Lista efectiva de roles asignados a un usuario (compatible con cuentas legacy de un solo rol). */
export function effectiveUserRoles(
  user: UserRolesSource | null | undefined,
): RoleKey[] {
  if (!user) return [];
  if (user.isAnonymous === true) return [GUEST_ROLE];
  if (user.roles && user.roles.length > 0) {
    return normalizeUserRoles(user.roles);
  }
  if (user.role) {
    return normalizeUserRoles([user.role]);
  }
  return [];
}

/** Rol principal derivado de la lista normalizada (`admin` si está presente, si no el primero). */
export function primaryUserRole(roles: readonly RoleKey[]): RoleKey {
  return normalizeUserRoles(roles)[0] ?? DEFAULT_ROLE;
}

/** ¿Tiene el usuario ese rol entre sus roles asignados? */
export function userHasRole(
  user: UserRolesSource | null | undefined,
  roleKey: RoleKey,
): boolean {
  return effectiveUserRoles(user).includes(roleKey);
}

/** ¿Tiene privilegios de administrador en cualquiera de sus roles? */
export function isAdminUser(
  user: UserRolesSource | null | undefined,
): boolean {
  return userHasRole(user, "admin");
}

/** ¿Coincide alguno de los roles del usuario con la lista objetivo? */
export function userMatchesAnyRole(
  user: UserRolesSource | null | undefined,
  targetRoles: readonly RoleKey[],
): boolean {
  if (targetRoles.length === 0) return false;
  const assigned = effectiveUserRoles(user);
  return assigned.some((key) => targetRoles.includes(key));
}

/** Compara dos listas de roles como conjuntos normalizados, sin importar el orden. */
export function areRoleListsEqual(
  a: readonly RoleKey[],
  b: readonly RoleKey[],
): boolean {
  const normA = normalizeUserRoles(a);
  const normB = normalizeUserRoles(b);
  if (normA.length !== normB.length) return false;
  const setB = new Set(normB);
  return normA.every((key) => setB.has(key));
}

/**
 * Etiqueta y estilo de un rol mientras no se tenga la fila de la base de
 * datos: los del sistema usan `ROLE_META` y los personalizados, la propia
 * clave con un estilo propio.
 */
export function fallbackRoleMeta(key: RoleKey): {
  label: string;
  description: string;
  badgeClassName: string;
} {
  if (isSystemRole(key)) return ROLE_META[key];
  return {
    label: key,
    description: "Rol personalizado del taller",
    badgeClassName: CUSTOM_BADGE_CLASS,
  };
}

/** Clase de la píldora de un rol (sistema → su estilo; personalizado → propio). */
export function roleBadgeClassName(key: RoleKey): string {
  return fallbackRoleMeta(key).badgeClassName;
}
