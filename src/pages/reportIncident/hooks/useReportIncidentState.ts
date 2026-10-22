import { useAuth } from "@/hooks/use-auth";
import { api } from "@/convex/_generated/api";
import { getErrorMessage } from "@/lib/workshop";
import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { getTodayInputDate, validateReportIncidentForm } from "../helpers";

export function useReportIncidentState() {
  const { user, isAuthenticated } = useAuth();
  const report = useMutation(api.incidents.report);
  const inventoryModels = useQuery(api.equipment.uniqueModels, {}) ?? [];
  const catalogPositions =
    useQuery(api.catalogs.listPublic, { kind: "position" }) ?? [];
  const catalogLocations =
    useQuery(api.catalogs.listPublic, { kind: "equipmentLocation" }) ?? [];

  // Lo que la persona ha escrito en cada campo de contacto (`null` = sin tocar).
  // Su perfil llega después de pintar la página, así que lo que enseña el campo
  // se deriva aquí: no se copia a un estado que se quedaría con la primera
  // versión y no habría forma de vaciar del todo.
  const [name, setName] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [location, setLocation] = useState<string | null>(null);
  const nameValue = name ?? user?.name ?? "";
  const emailValue = email ?? user?.email ?? "";
  const roleValue = role ?? user?.position ?? "";
  const locationValue = location ?? user?.location ?? "";

  const [equipmentKind, setEquipmentKind] = useState("");
  const [model, setModel] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [reportedAt, setReportedAt] = useState(getTodayInputDate);
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // El código con el que se sigue el caso: lo único que se lleva quien notifica
  // (la referencia interna se queda en el taller).
  const [code, setCode] = useState<string | null>(null);
  // Y el correo al que se le ha mandado: se le dice que va en camino, para que
  // no dependa de haber copiado el código de esta pantalla.
  const [sentTo, setSentTo] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const validation = validateReportIncidentForm({
      name: nameValue,
      email: emailValue,
      role: roleValue,
      location: locationValue,
      reportedAt,
      equipmentKind,
      model,
      serialNumber,
      description,
    });

    if (!validation.isValid || !validation.payload) {
      setError(validation.error);
      return;
    }

    setBusy(true);
    try {
      const created = await report(validation.payload);
      setCode(created.code);
      setSentTo(validation.payload.reporterEmail ?? null);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setCode(null);
    setSentTo(null);
    setName(null);
    setEmail(null);
    setRole(null);
    setLocation(null);
    setEquipmentKind("");
    setModel("");
    setSerialNumber("");
    setReportedAt(getTodayInputDate());
    setDescription("");
    setError(null);
  };

  return {
    user,
    isAuthenticated,
    code,
    sentTo,
    nameValue,
    reset,
    busy,
    error,
    handleSubmit,
    reporterProps: {
      nameValue,
      onNameChange: setName,
      emailValue,
      onEmailChange: setEmail,
      roleValue,
      onRoleChange: setRole,
      locationValue,
      onLocationChange: setLocation,
      catalogPositions,
      catalogLocations,
      disabled: busy,
    },
    equipmentProps: {
      reportedAt,
      onReportedAtChange: setReportedAt,
      equipmentKind,
      onEquipmentKindChange: setEquipmentKind,
      model,
      onModelChange: setModel,
      serialNumber,
      onSerialNumberChange: setSerialNumber,
      inventoryModels,
      disabled: busy,
    },
    descriptionProps: {
      description,
      onDescriptionChange: setDescription,
      disabled: busy,
    },
  };
}
