import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { getErrorMessage } from "@/lib/workshop";
import { useAction, useMutation } from "convex/react";
import { useState } from "react";
import { toast } from "sonner";
import type { Member } from "../types";

interface UseUsersOperationsOptions {
  roleLabelOf: (key: string | null) => string;
}

/**
 * Hook para gestionar las operaciones de usuario: cambio de roles, baja y reactivación.
 */
export function useUsersOperations({ roleLabelOf }: UseUsersOperationsOptions) {
  const setRoles = useMutation(api.members.setRoles);
  const setActive = useAction(api.members.setActive);
  const [deactivating, setDeactivating] = useState<Member | null>(null);

  const handleChangeRoles = async (userId: Id<"users">, roles: string[]) => {
    try {
      await setRoles({ userId, roles });
      const labels = roles.map((key) => roleLabelOf(key)).join(", ");
      toast.success(`Roles actualizados: ${labels}`);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const handleToggleActive = async (member: Member) => {
    if (member.active) {
      setDeactivating(member);
      return;
    }
    try {
      await setActive({ userId: member._id, active: true });
      toast.success(`${member.name ?? "Usuario"} reactivado`);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const handleConfirmDeactivate = async () => {
    if (!deactivating) return;
    try {
      await setActive({ userId: deactivating._id, active: false });
      toast.success(`${deactivating.name ?? "Usuario"} dado de baja`);
      setDeactivating(null);
    } catch (error) {
      toast.error(getErrorMessage(error));
      throw error;
    }
  };

  return {
    deactivating,
    setDeactivating,
    handleChangeRoles,
    handleToggleActive,
    handleConfirmDeactivate,
  };
}
