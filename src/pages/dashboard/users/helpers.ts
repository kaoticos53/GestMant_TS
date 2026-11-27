import { effectiveUserRoles, fallbackRoleMeta } from "@/lib/roles";
import type { Member, RoleOption } from "./types";

/**
 * Resuelve la etiqueta legible de un rol a partir de las opciones disponibles,
 * aplicando el fallback estándar del sistema si no se encuentra en las opciones.
 */
export function getRoleLabel(
  roleOptions: RoleOption[],
  roleKey: string | null,
): string {
  const match = roleOptions.find((option) => option.key === roleKey);
  if (match) return match.label;
  return fallbackRoleMeta(roleKey ?? "").label;
}

/** Claves efectivas de roles asignadas a un miembro. */
export function getMemberRoleKeys(
  member: Pick<Member, "role" | "roles">,
): string[] {
  return effectiveUserRoles(member);
}

/** Etiquetas de todos los roles del miembro separadas por coma. */
export function formatMemberRoles(
  roleOptions: RoleOption[],
  member: Pick<Member, "role" | "roles">,
): string {
  const keys = getMemberRoleKeys(member);
  if (keys.length === 0) return getRoleLabel(roleOptions, member.role);
  return keys.map((key) => getRoleLabel(roleOptions, key)).join(", ");
}

/**
 * Genera la configuración de columnas ordenables para la tabla de usuarios.
 */
export function createUserColumns(roleOptions: RoleOption[]) {
  return {
    member: {
      label: "Usuario",
      value: (member: Member) => member.name ?? member.email ?? "",
    },
    position: {
      label: "Puesto y ubicación",
      value: (member: Member) => member.position ?? "",
    },
    role: {
      label: "Roles",
      value: (member: Member) => formatMemberRoles(roleOptions, member),
    },
    state: {
      label: "Estado",
      value: (member: Member) => (member.active ? "Activo" : "Inactivo"),
    },
  } as const;
}

export type UserTableColumns = ReturnType<typeof createUserColumns>;
export type UserColumnKey = keyof UserTableColumns;

/**
 * Compone el texto informativo de usuarios activos y restricciones administrativas.
 */
export function formatActiveUsersDetail(activeCount: number): string {
  return `${activeCount} con acceso · el administrador no puede cambiar su propio rol ni darse de baja`;
}
