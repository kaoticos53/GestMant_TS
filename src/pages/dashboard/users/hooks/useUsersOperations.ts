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
 * Hook para gestionar las operaciones de usuario: cambio de rol, baja y reactivación.
 */
export function useUsersOperations({ roleLabelOf }: UseUsersOperationsOptions) {
  const setRole = useMutation(api.members.setRole);
  const setActive = useAction(api.members.setActive);
  const [deactivating, setDeactivating] = useState<Member | null>(null);

  const handleChangeRole = async (userId: Id<"users">, role: string) => {
    try {
      await setRole({ userId, role });
      toast.success(`Rol actualizado a ${roleLabelOf(role)}`);
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
    }
  };

  return {
    deactivating,
    setDeactivating,
    handleChangeRole,
    handleToggleActive,
    handleConfirmDeactivate,
  };
}
