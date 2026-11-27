import type { Id } from "@/convex/_generated/dataModel";

/** Proyección de usuario que devuelve `members.list`. */
export interface Member {
  _id: Id<"users">;
  name: string | null;
  email: string | null;
  /** Clave principal del rol (compatibilidad). */
  role: string | null;
  /** Todos los roles asignados al usuario. */
  roles?: string[];
  position: string | null;
  location: string | null;
  phone: string | null;
  active: boolean;
  isAnonymous: boolean;
}

/** Opción de rol del sistema o personalizado. */
export interface RoleOption {
  key: string;
  label: string;
  description?: string;
}
