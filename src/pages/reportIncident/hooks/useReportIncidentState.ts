import { useAuth } from "@/hooks/use-auth";
import { useNetworkStatus } from "@/hooks/use-network-status";
import { api } from "@/convex/_generated/api";
import {
  OFFLINE_DRAFT_SAVED_NOTICE,
  clientDraftId,
  countOfflineDrafts,
  deleteOfflineDraft,
  listOfflineDrafts,
  saveOfflineDraft,
  type OfflineDraftPayload,
} from "@/lib/offlineDrafts";
import { getErrorMessage } from "@/lib/workshop";
import { useMutation, useQuery } from "convex/react";
import { useCallback, useEffect, useState } from "react";
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

  // Avisos guardados en el dispositivo esperando red, y lo que hay que contarle
  // a quien está rellenando el formulario sobre ellos.
  const online = useNetworkStatus();
  const [pendingDrafts, setPendingDrafts] = useState(0);
  const [offlineNotice, setOfflineNotice] = useState<string | null>(null);

  /**
   * Guarda el aviso en el navegador para mandarlo cuando vuelva la red.
   *
   * El formulario se vacía como si se hubiera enviado: el aviso ya no vive en la
   * pantalla, vive en el dispositivo, y así el técnico puede seguir escribiendo
   * el siguiente sin perder el que acaba de redactar. `reset` no toca el aviso
   * de guardado, que es lo que se lee después.
   */
  const stashDraft = useCallback(
    async (payload: OfflineDraftPayload): Promise<boolean> => {
      const saved = await saveOfflineDraft({
        id: clientDraftId(),
        payload,
        savedAt: Date.now(),
      });
      if (!saved) {
        setError(
          "Sin conexión y sin sitio donde guardar el aviso en este dispositivo. No cierres esta pestaña: inténtalo de nuevo en unos segundos.",
        );
        return false;
      }
      setOfflineNotice(OFFLINE_DRAFT_SAVED_NOTICE);
      setPendingDrafts(await countOfflineDrafts());
      return true;
    },
    [],
  );

  /**
   * La cola del dispositivo: al montar se cuenta lo que espera y, si hay red,
   * sale sola. Cada aviso viaja con su `clientDraftId`, así que un envío que
   * llegó al servidor pero perdió la respuesta no se duplica al reintentarlo.
   *
   * Si uno falla se deja para la próxima vez —no se borra nada que no haya
   * entrado—, y lo que quede se cuenta en el aviso de la pantalla. Lo que se
   * escribe aquí llega después de leer el almacén, no antes: el estado se
   * actualiza cuando el dato existe.
   */
  useEffect(() => {
    let active = true;

    void (async () => {
      if (online) {
        const drafts = await listOfflineDrafts();
        for (const draft of drafts) {
          try {
            await report({ ...draft.payload, clientDraftId: draft.id });
            await deleteOfflineDraft(draft.id);
          } catch (err) {
            // Sin red otra vez —o el taller rechaza el aviso por ahora (el
            // freno de dos avisos seguidos)—: se queda guardado y se
            // reintenta en la próxima ocasión.
            if (active) setError(getErrorMessage(err));
            break;
          }
        }
      }
      const pending = await countOfflineDrafts();
      if (active) setPendingDrafts(pending);
    })();

    return () => {
      active = false;
    };
  }, [online, report]);

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

    // Sin red no se llama al servidor: el aviso se guarda aquí y sale cuando
    // vuelva la cobertura. Se vacía el formulario como si se hubiera enviado.
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setBusy(true);
      const saved = await stashDraft(validation.payload);
      setBusy(false);
      if (saved) reset();
      return;
    }

    setBusy(true);
    try {
      const created = await report({
        ...validation.payload,
        clientDraftId: clientDraftId(),
      });
      setCode(created.code);
      setSentTo(validation.payload.reporterEmail ?? null);
      setOfflineNotice(null);
    } catch (err) {
      // Si el envío falla porque la conexión se ha ido en mitad de la petición,
      // se hace lo mismo que si nunca hubiera habido red.
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        const saved = await stashDraft(validation.payload);
        if (saved) reset();
      } else {
        setError(getErrorMessage(err));
      }
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
    setOfflineNotice(null);
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
    connectivity: {
      online,
      pending: pendingDrafts,
      notice: offlineNotice,
    },
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
