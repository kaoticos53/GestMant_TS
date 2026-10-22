import { useState } from "react";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { richDocToStore } from "@/lib/richDoc";
import { getErrorMessage, type MaintenanceKind } from "@/lib/workshop";
import { dateToInput } from "@/pages/dashboard/equipment/helpers";
import { validateMaintenanceForm } from "../helpers";
import type { UseMaintenanceFormParams, UseMaintenanceFormReturn } from "../types";

const TODAY_INPUT = dateToInput(Date.now());

export function useMaintenanceForm({
  item,
  record,
  onClose,
}: UseMaintenanceFormParams): UseMaintenanceFormReturn {
  const create = useMutation(api.maintenance.create);
  const update = useMutation(api.maintenance.update);

  const isEdit = record !== null;
  const [kind, setKind] = useState<MaintenanceKind>(record?.kind ?? "repair");
  const [title, setTitle] = useState(record?.title ?? "");
  const [date, setDate] = useState(
    record ? dateToInput(record.performedAt) : TODAY_INPUT,
  );
  const [technician, setTechnician] = useState(record?.technician ?? "");
  const [description, setDescription] = useState(record?.description ?? "");
  const [requestId, setRequestId] = useState<Id<"partRequests"> | "">(
    record?.requestId ?? "",
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setError(null);
    const validation = validateMaintenanceForm(title, date);
    if (!validation.isValid) {
      setError(validation.error ?? "Datos de intervención inválidos");
      return;
    }
    const performedAt = validation.performedAt!;

    setBusy(true);
    try {
      const payload = {
        equipmentId: item._id,
        kind,
        title: title.trim(),
        description: richDocToStore(description),
        performedAt,
        technician: technician.trim(),
        requestId: requestId === "" ? undefined : requestId,
      };

      if (isEdit && record) {
        await update({ id: record._id, ...payload });
        toast.success("Intervención actualizada");
      } else {
        await create(payload);
        toast.success(`${title.trim()} añadida al historial`);
      }
      onClose();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return {
    kind,
    setKind,
    title,
    setTitle,
    date,
    setDate,
    technician,
    setTechnician,
    description,
    setDescription,
    requestId,
    setRequestId,
    busy,
    error,
    isEdit,
    handleSubmit,
  };
}
