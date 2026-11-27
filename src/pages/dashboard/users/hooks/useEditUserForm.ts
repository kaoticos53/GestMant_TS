import { api } from "@/convex/_generated/api";
import { areRoleListsEqual, effectiveUserRoles } from "@/lib/roles";
import { getErrorMessage } from "@/lib/workshop";
import { useMutation, useQuery } from "convex/react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import type { Member } from "../types";

export interface ValidateEditUserInput {
  name: string;
}

/**
 * Validador puro de datos de edición de usuario.
 */
export function validateEditUserData({ name }: ValidateEditUserInput): string | null {
  if (!name.trim()) {
    return "Indica tu nombre y apellidos.";
  }
  return null;
}

interface UseEditUserFormOptions {
  member: Member;
  isSelf?: boolean;
  onSuccess: () => void;
}

/**
 * Hook para gestionar el formulario de edición de perfil de usuario con múltiples roles.
 */
export function useEditUserForm({
  member,
  isSelf = false,
  onSuccess,
}: UseEditUserFormOptions) {
  const updateUser = useMutation(api.members.updateUser);
  const setUserRoles = useMutation(api.members.setRoles);
  const catalogPositions = useQuery(api.catalogs.list, { kind: "position" }) ?? [];
  const catalogLocations =
    useQuery(api.catalogs.list, { kind: "equipmentLocation" }) ?? [];
  const ensureCatalogItem = useMutation(api.catalogs.ensureItem);

  const initialRoles = effectiveUserRoles(member);

  const [name, setName] = useState(member.name ?? "");
  const [roles, setRoles] = useState<string[]>(initialRoles);
  const [position, setPosition] = useState(member.position ?? "");
  const [location, setLocation] = useState(member.location ?? "");
  const [phone, setPhone] = useState(member.phone ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const validationError = validateEditUserData({ name });
    if (validationError) {
      setError(validationError);
      return;
    }
    if (!isSelf && roles.length === 0) {
      setError("Asigna al menos un rol al usuario.");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await updateUser({
        userId: member._id,
        name: name.trim(),
        // Cadena vacía = limpiar el dato de la ficha.
        position,
        location,
        phone,
      });

      if (!isSelf && !areRoleListsEqual(roles, initialRoles)) {
        await setUserRoles({ userId: member._id, roles });
      }

      // Registro transparente en catálogos
      const catalogTasks: Promise<unknown>[] = [];
      if (position.trim()) {
        catalogTasks.push(
          ensureCatalogItem({ kind: "position", name: position.trim() }).catch(
            () => {},
          ),
        );
      }
      if (location.trim()) {
        catalogTasks.push(
          ensureCatalogItem({
            kind: "equipmentLocation",
            name: location.trim(),
          }).catch(() => {}),
        );
      }
      if (catalogTasks.length > 0) {
        await Promise.allSettled(catalogTasks);
      }

      toast.success("Perfil actualizado");
      onSuccess();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return {
    name,
    setName,
    roles,
    setRoles,
    position,
    setPosition,
    location,
    setLocation,
    phone,
    setPhone,
    busy,
    error,
    catalogPositions,
    catalogLocations,
    handleSubmit,
  };
}
