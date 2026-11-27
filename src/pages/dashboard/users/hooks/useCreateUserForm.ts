import { api } from "@/convex/_generated/api";
import { primaryUserRole } from "@/lib/roles";
import { getErrorMessage } from "@/lib/workshop";
import { useAction, useQuery } from "convex/react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

export interface ValidateCreateUserInput {
  name: string;
  email: string;
  password: string;
  roles?: string[];
}

/**
 * Validador puro de datos de alta de usuario.
 */
export function validateCreateUserData({
  name,
  email,
  password,
  roles,
}: ValidateCreateUserInput): string | null {
  if (!name.trim()) {
    return "Indica tu nombre y apellidos.";
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return "Indica un correo electrónico válido.";
  }
  if (password.length < 8) {
    return "La contraseña debe tener al menos 8 caracteres.";
  }
  if (roles !== undefined && roles.length === 0) {
    return "Asigna al menos un rol al usuario.";
  }
  return null;
}

interface UseCreateUserFormOptions {
  onSuccess: () => void;
}

/**
 * Hook para gestionar el formulario de alta de usuario con múltiples roles.
 */
export function useCreateUserForm({ onSuccess }: UseCreateUserFormOptions) {
  const createUser = useAction(api.members.createUser);
  const roleOptions = useQuery(api.permissions.listRoles);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [roles, setRoles] = useState<string[]>(["technician"]);
  const [position, setPosition] = useState("");
  const [location, setLocation] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const validationError = validateCreateUserData({
      name,
      email,
      password,
      roles,
    });
    if (validationError) {
      setError(validationError);
      return;
    }

    setBusy(true);
    try {
      await createUser({
        name: name.trim(),
        email: email.trim(),
        password,
        role: primaryUserRole(roles),
        roles,
        position: position.trim() || undefined,
        location: location.trim() || undefined,
        phone: phone.trim() || undefined,
      });
      toast.success(`Usuario creado: ${email.trim()}`);
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
    email,
    setEmail,
    password,
    setPassword,
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
    roleOptions,
    handleSubmit,
  };
}
