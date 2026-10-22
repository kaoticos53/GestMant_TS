import type { Grants } from "@/lib/permissionsDraft";

/** Fila que devuelve `permissions.listRoles`. */
export interface RoleInfo {
  key: string;
  label: string;
  description: string;
  kind: "system" | "custom";
  grants: Grants;
  userCount: number;
}

export type DialogState = {
  mode: "new" | "edit";
  role?: RoleInfo;
  template?: RoleInfo;
} | null;
