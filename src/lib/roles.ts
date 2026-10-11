/**
 * Claves de rol que nacen en el código (el resto son personalizadas y viven
 * en la tabla `roles` con su propia etiqueta y permisos).
 */
export type SystemRole = "admin" | "manager" | "technician" | "guest";

/** Las claves del sistema, en el orden en que se muestran. */
export const SYSTEM_ROLES: SystemRole[] = ["admin", "manager", "technician", "guest"];

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
    badgeClassName: "border-emerald-600/25 bg-emerald-600/10 text-emerald-700",
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

/** Puede gestionar usuarios y roles. */
export function isAdmin(role: RoleKey | null | undefined): boolean {
  return role === "admin";
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
