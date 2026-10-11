import { DEFAULT_GRANTS, type Capability } from "./permissions";
import { isSystemRole } from "./roles";

/**
 * Borrador de la matriz de permisos: qué cambia cada interruptor, qué queda
 * pendiente de guardar y qué se revierte a los valores de código. Vive fuera
 * del componente para poder probarlo sin navegador.
 */

/** Permisos de un rol, tal y como los devuelve `permissions.listRoles`. */
export type Grants = Record<Capability, boolean>;

/** Permisos editables por clave de rol (el administrador no se edita). */
export type Draft = Record<string, Grants>;

/** Clave del administrador: siempre los tiene todos y no se guarda aquí. */
export const ADMIN_KEY = "admin";

/** Permisos de cada rol editable (el administrador se queda fuera). */
export function editableGrants(roles: { key: string; grants: Grants }[]): Draft {
  const draft: Draft = {};
  for (const role of roles) {
    if (role.key !== ADMIN_KEY) draft[role.key] = role.grants;
  }
  return draft;
}

/** Defaults de código de un rol del sistema (los personalizados no tienen). */
export function systemDefaults(key: string): Grants | null {
  return isSystemRole(key) ? { ...DEFAULT_GRANTS[key] } : null;
}

/**
 * ¿Los dos juegos de permisos son iguales? Se compara capacidad a capacidad:
 * el orden de las claves que devuelve la base de datos no influye.
 */
export function sameGrants(a: Grants, b: Grants): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) {
    if (a[key as Capability] !== b[key as Capability]) return false;
  }
  return true;
}

/**
 * Lo que muestra la matriz: lo guardado con los cambios locales encima. Si un
 * rol se crea mientras hay cambios sin guardar, su columna aparece con sus
 * permisos reales en vez de en blanco, y sigue siendo editable. Solo mandan
 * los roles que existen ahora: uno borrado no vuelve al borrador.
 */
export function mergeDraft(saved: Draft, draft: Draft | null): Draft {
  if (draft === null) return saved;
  const merged: Draft = { ...saved };
  for (const key of Object.keys(saved)) {
    if (draft[key]) merged[key] = draft[key];
  }
  return merged;
}

/**
 * Invierte una capacidad en el borrador. Si el rol no estaba en él (acaba de
 * crearse) se parte de sus permisos guardados en vez de quedarse sin base.
 * Como la matriz ya viene de `mergeDraft`, el resultado solo contiene roles
 * existentes: un borrador viejo nunca resucita un rol borrado.
 */
export function toggleGrant(
  current: Draft,
  roleKey: string,
  id: Capability,
): Draft {
  const base = current[roleKey];
  if (!base) return current;
  const next: Draft = {};
  for (const key of Object.keys(current)) next[key] = { ...current[key] };
  next[roleKey][id] = !base[id];
  return next;
}

/** Revierte los roles del sistema a sus permisos de código; deja el resto. */
export function restoreSystemDefaults(current: Draft): Draft {
  const next: Draft = {};
  for (const key of Object.keys(current)) {
    next[key] = systemDefaults(key) ?? { ...current[key] };
  }
  return next;
}

/** ¿Hay algún rol del sistema con permisos distintos a los de código? */
export function canRestoreDefaults(current: Draft): boolean {
  return Object.keys(current).some((key) => {
    const defaults = systemDefaults(key);
    return defaults !== null && !sameGrants(current[key], defaults);
  });
}

/** Quita un rol del borrador (p. ej. al borrarlo). Sin cambios → el mismo. */
export function dropRole(draft: Draft, roleKey: string): Draft | null {
  if (!(roleKey in draft)) return draft;
  const next: Draft = {};
  for (const key of Object.keys(draft)) {
    if (key !== roleKey) next[key] = draft[key];
  }
  return Object.keys(next).length > 0 ? next : null;
}

/** Un cambio pendiente: el rol y los permisos que se van a guardar. */
export interface PendingChange {
  key: string;
  grants: Grants;
}

/**
 * Roles con cambios pendientes respecto a lo guardado. Solo se comparan los
 * roles que existen ahora mismo: uno borrado con el borrador abierto no se
 * guarda ni deja la pantalla en estado «sucio».
 */
export function pendingChanges(draft: Draft, saved: Draft): PendingChange[] {
  const changes: PendingChange[] = [];
  for (const key of Object.keys(saved)) {
    if (key === ADMIN_KEY) continue;
    const grants = draft[key];
    if (!grants || sameGrants(grants, saved[key])) continue;
    changes.push({ key, grants });
  }
  return changes;
}

/** ¿Hay cambios sin guardar? (mismo criterio que `pendingChanges`). */
export function isDirty(draft: Draft, saved: Draft): boolean {
  return pendingChanges(draft, saved).length > 0;
}
