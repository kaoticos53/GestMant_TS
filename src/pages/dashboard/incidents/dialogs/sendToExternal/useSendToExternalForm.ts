import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { richDocToPlainText } from "@/lib/richDoc";
import { getErrorMessage } from "@/lib/workshop";
import type { IncidentDoc } from "../../types";
import { buildSendToExternalArgs, validateSendToExternalForm } from "./helpers";

export interface UseSendToExternalFormProps {
  incident: IncidentDoc;
  onClose: () => void;
}

export function useSendToExternalForm({
  incident,
  onClose,
}: UseSendToExternalFormProps) {
  const sendExternal = useMutation(api.incidents.sendToExternalRepair);
  const ensureCatalogItem = useMutation(api.catalogs.ensureItem);
  const catalogWorkshops =
    useQuery(api.catalogs.list, { kind: "externalWorkshop" }) ?? [];

  const [companyName, setCompanyName] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [includedAccessories, setIncludedAccessories] = useState("");
  const [defectNotes, setDefectNotes] = useState(() =>
    richDocToPlainText(incident.description) || "",
  );
  const [dispatchNotes, setDispatchNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationError = validateSendToExternalForm({
      companyName,
      defectNotes,
    });
    if (validationError) {
      setError(validationError);
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await sendExternal(
        buildSendToExternalArgs(incident._id, {
          companyName,
          contactName,
          contactPhone,
          includedAccessories,
          defectNotes,
          dispatchNotes,
        }),
      );

      // Registro transparente en catálogo maestro para futuros autocompletados
      void ensureCatalogItem({
        kind: "externalWorkshop",
        name: companyName.trim(),
      }).catch(() => {});

      toast.success(
        `${incident.reference} enviada a reparación externa (${companyName.trim()})`,
      );
      onClose();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return {
    companyName,
    setCompanyName,
    contactName,
    setContactName,
    contactPhone,
    setContactPhone,
    includedAccessories,
    setIncludedAccessories,
    defectNotes,
    setDefectNotes,
    dispatchNotes,
    setDispatchNotes,
    busy,
    error,
    catalogWorkshops,
    handleSubmit,
  };
}
