import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { getErrorMessage, looksLikeIncidentReference } from "@/lib/workshop";
import {
  confusablePublicCodeChars,
  normalizePublicCode,
} from "@/lib/publicCode";
import type { LookupOutcome, Tracking } from "../types";

/**
 * Hook que gestiona el ciclo de vida de consulta pública de incidencias por código,
 * con prevención de condiciones de carrera (latest ref) y control de rate-limiting.
 */
export function useIncidentLookup(initialCode?: string | null) {
  const [typed, setTyped] = useState(initialCode ?? "");
  const [asked, setAsked] = useState<string | null>(initialCode ?? null);
  const [tracking, setTracking] = useState<Tracking | null | undefined>(
    undefined,
  );
  const [arrivedAt, setArrivedAt] = useState(0);
  const [failure, setFailure] = useState<string | null>(null);

  const latest = useRef(0);
  const consultar = useMutation(api.incidents.byCode);
  const code = asked === null ? null : normalizePublicCode(asked);

  const pedir = useCallback(
    async (found: string): Promise<LookupOutcome> => {
      try {
        return { ok: true, tracking: await consultar({ code: found }) };
      } catch (error) {
        return { ok: false, error: getErrorMessage(error) };
      }
    },
    [consultar],
  );

  const guardar = useCallback((request: number, outcome: LookupOutcome) => {
    if (latest.current !== request) return;
    if (outcome.ok) {
      setTracking(outcome.tracking);
      setArrivedAt(Date.now());
    } else {
      setFailure(outcome.error);
      setTracking(null);
    }
  }, []);

  const buscar = useCallback(
    async (value: string) => {
      const found = normalizePublicCode(value);
      if (found === null) return;
      setTracking(undefined);
      setFailure(null);
      latest.current += 1;
      const request = latest.current;
      guardar(request, await pedir(found));
    },
    [guardar, pedir],
  );

  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const found = normalizePublicCode(initialCode);
    if (found === null) return;
    latest.current += 1;
    const request = latest.current;
    void pedir(found).then((outcome) => guardar(request, outcome));
  }, [guardar, initialCode, pedir]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = typed.trim();
    setAsked(value === "" ? null : value);
    setFailure(null);
    setTracking(undefined);
    if (value !== "") void buscar(value);
  };

  const confusables = asked === null ? "" : confusablePublicCodeChars(asked);
  const referenceTyped =
    asked !== null && code === null && looksLikeIncidentReference(asked);

  return {
    typed,
    setTyped,
    code,
    tracking,
    arrivedAt,
    failure,
    confusables,
    referenceTyped,
    handleSubmit,
  };
}
