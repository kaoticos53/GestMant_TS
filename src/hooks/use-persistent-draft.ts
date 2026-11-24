import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type StorageType = "local" | "session";

export interface PersistentDraftOptions<T> {
  /** Clave única en almacenamiento, ej: "pulso:draft:incident-123-workpart" */
  key: string;
  /** Valor inicial predeterminado cuando no existe un borrador guardado */
  initialValue: T;
  /** Tipo de almacenamiento: "local" (permanente) o "session" (se borra al cerrar pestaña). Por defecto: "local" */
  storageType?: StorageType;
  /** Tiempo de espera en milisegundos para sincronizar a storage. Por defecto: 400ms */
  debounceMs?: number;
  /** Comparador personalizado para cambios sin guardar (por defecto compara JSON) */
  isEqual?: (a: T, b: T) => boolean;
}

export interface PersistentDraftReturn<T> {
  draft: T;
  setDraft: React.Dispatch<React.SetStateAction<T>>;
  hasUnsavedChanges: boolean;
  clearDraft: () => void;
  resetToInitial: () => void;
  isRestored: boolean;
}

function getStorage(type: StorageType): Storage | null {
  try {
    if (typeof window === "undefined") return null;
    return type === "session" ? window.sessionStorage : window.localStorage;
  } catch {
    return null;
  }
}

function defaultIsEqual<T>(a: T, b: T): boolean {
  if (a === b) return true;
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}

/**
 * Hook para persistir borradores de formularios y partes de trabajo en el almacenamiento
 * del navegador de forma reactiva y con debounce. Protege al usuario frente a recargas
 * o cierres accidentales mediante `beforeunload` cuando hay cambios no guardados.
 */
export function usePersistentDraft<T>({
  key,
  initialValue,
  storageType = "local",
  debounceMs = 400,
  isEqual = defaultIsEqual,
}: PersistentDraftOptions<T>): PersistentDraftReturn<T> {
  const storage = getStorage(storageType);

  // Se lee el almacén una sola vez al montar para evitar doble getItem + JSON.parse.
  const [initialRead] = useState<{ value: T; restored: boolean }>(() => {
    if (!storage) return { value: initialValue, restored: false };
    try {
      const raw = storage.getItem(key);
      if (raw !== null) {
        const parsed = JSON.parse(raw) as T;
        return { value: parsed, restored: !isEqual(parsed, initialValue) };
      }
    } catch (error) {
      console.warn(
        `[usePersistentDraft] No se pudo leer el borrador para "${key}":`,
        error,
      );
    }
    return { value: initialValue, restored: false };
  });

  const [isRestored, setIsRestored] = useState(initialRead.restored);
  const [draft, setDraft] = useState<T>(initialRead.value);

  // `clearDraft` declara "ya guardado" el borrador actual sin tocarlo: se guarda
  // su referencia, y en cuanto `draft` cambie vuelve a contar como pendiente.
  const [clearedDraft, setClearedDraft] = useState<{ value: T } | null>(null);

  const isDirty = useMemo(
    () => !isEqual(draft, initialValue),
    [draft, initialValue, isEqual],
  );

  // Estado derivado: no necesita useState ni useEffect.
  const hasUnsavedChanges =
    !(clearedDraft !== null && Object.is(clearedDraft.value, draft)) && isDirty;

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sincronización debounced con el almacenamiento
  useEffect(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    timerRef.current = setTimeout(() => {
      if (!storage) return;
      try {
        if (isDirty) {
          storage.setItem(key, JSON.stringify(draft));
        } else {
          storage.removeItem(key);
        }
      } catch (error) {
        console.warn(`[usePersistentDraft] No se pudo persistir el borrador para "${key}":`, error);
      }
    }, debounceMs);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [draft, isDirty, key, storage, debounceMs]);

  // Alerta de recarga o navegación accidental cuando hay cambios pendientes
  useEffect(() => {
    if (!hasUnsavedChanges || typeof window === "undefined") return;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      // En navegadores modernos este valor activa el diálogo estándar del sistema
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [hasUnsavedChanges]);

  const clearDraft = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    if (storage) {
      try {
        storage.removeItem(key);
      } catch {
        // Ignorar fallo de almacenamiento
      }
    }
    setClearedDraft({ value: draft });
    setIsRestored(false);
  }, [key, storage, draft]);

  const resetToInitial = useCallback(() => {
    clearDraft();
    setDraft(initialValue);
  }, [clearDraft, initialValue]);

  return {
    draft,
    setDraft,
    hasUnsavedChanges,
    clearDraft,
    resetToInitial,
    isRestored,
  };
}
