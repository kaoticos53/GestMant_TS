import { api } from "@/convex/_generated/api";
import { readStartedEmpty, writeStartedEmpty } from "@/lib/emptyWorkshop";
import { safeLocalStorage } from "@/lib/sidebar";
import {
  dismissalOf,
  isDismissed,
  readDismissal,
  writeDismissal,
  type WorkAlertDismissal,
} from "@/lib/workAlert";
import {
  DEFAULT_WORK_WITHOUT_TRACE_DAYS,
  DEFAULT_WORK_WITHOUT_TRACE_ROLES,
  alertReachesRole,
} from "@/lib/workshop";
import { useMutation, useQuery } from "convex/react";
import { useCallback, useEffect, useState } from "react";

export interface UserAlertSource {
  _id?: string;
  workAlertDismissal?: WorkAlertDismissal;
}

export function useWorkAlertState(
  user: UserAlertSource | null | undefined,
  role: string,
  totalParts: number,
  activeRequests: number,
  loading: boolean,
) {
  const alertSettings = useQuery(api.alerts.settings);
  const alertDays = alertSettings?.days ?? DEFAULT_WORK_WITHOUT_TRACE_DAYS;
  const summary = useQuery(api.dashboard.summary, { marginDays: alertDays });
  const saveWorkAlertDismissal = useMutation(api.members.saveWorkAlertDismissal);

  // «Empezar con el taller vacío»
  const [startedEmpty, setStartedEmpty] = useState(() =>
    readStartedEmpty(safeLocalStorage()),
  );

  const [alertDismissal, setAlertDismissal] = useState<WorkAlertDismissal | null>(() =>
    readDismissal(safeLocalStorage()),
  );

  const [alertOwner, setAlertOwner] = useState<string | null>(null);
  if (user?._id && alertOwner !== user._id) {
    setAlertOwner(user._id);
    if (user.workAlertDismissal !== undefined) {
      setAlertDismissal(user.workAlertDismissal);
    }
  }

  useEffect(() => {
    writeDismissal(safeLocalStorage(), alertDismissal);
  }, [alertDismissal]);

  const alertRoleKeys = alertSettings?.roleKeys ?? DEFAULT_WORK_WITHOUT_TRACE_ROLES;
  const seesAlert = alertReachesRole(role, alertRoleKeys);
  const staleWork = summary?.staleWork ?? [];
  const alertReferences = staleWork.map(({ incident }) => incident.reference);
  const alertDismissed = isDismissed(alertDismissal, alertReferences, alertDays);

  const dismissAlert = useCallback(() => {
    const dismissal = dismissalOf(alertReferences, alertDays);
    setAlertDismissal(dismissal);
    saveWorkAlertDismissal({ dismissal }).catch((error: unknown) => {
      console.warn("No se pudo guardar el aviso cerrado en el perfil:", error);
    });
  }, [alertReferences, alertDays, saveWorkAlertDismissal]);

  const restoreAlert = useCallback(() => {
    setAlertDismissal(null);
    saveWorkAlertDismissal({ dismissal: null }).catch((error: unknown) => {
      console.warn("No se pudo olvidar el aviso cerrado en el perfil:", error);
    });
  }, [saveWorkAlertDismissal]);

  const handleStartEmpty = useCallback(() => {
    setStartedEmpty(true);
    writeStartedEmpty(safeLocalStorage(), true);
  }, []);

  const markStartedEmpty = useCallback((value: boolean) => {
    setStartedEmpty(value);
    writeStartedEmpty(safeLocalStorage(), value);
  }, []);

  const isEmpty = !loading && totalParts === 0 && activeRequests === 0;
  const showEmptyNotice = isEmpty && !startedEmpty;

  return {
    summary,
    alertSettings,
    alertDays,
    alertRoleKeys,
    seesAlert,
    staleWork,
    alertReferences,
    alertDismissed,
    dismissAlert,
    restoreAlert,
    startedEmpty,
    handleStartEmpty,
    markStartedEmpty,
    isEmpty,
    showEmptyNotice,
  };
}
