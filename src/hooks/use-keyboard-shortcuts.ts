import { useEffect, useRef } from "react";

export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") {
    return true;
  }
  return Boolean(target.closest("[contenteditable='true']"));
}

export interface KeyboardShortcut {
  /** Tecla exacta (`event.key`, ej. `"/"`, `"j"`, `"?"`, `"Escape"`). */
  key: string;
  /** Solo activa si `enabled !== false`. */
  enabled?: boolean;
  /** Permite disparar incluso dentro de campos editables (ej. `Escape`). */
  allowInEditable?: boolean;
  /** Manejador invocado tras `preventDefault()`. */
  onTrigger: (event: KeyboardEvent) => void;
}

export interface ChordShortcut {
  /** Prefijo inicial (ej. `"g"`). */
  prefix: string;
  /** Segunda tecla tras el prefijo (en minúscula). */
  key: string;
  enabled?: boolean;
  onTrigger: () => void;
}

/**
 * Registra atajos de teclado globales o de vista manteniendo una única
 * suscripción `keydown` y respetando entradas editables y modificadores.
 */
export function useKeyboardShortcuts({
  shortcuts = [],
  chords = [],
  active = true,
  chordTimeoutMs = 900,
}: {
  shortcuts?: KeyboardShortcut[];
  chords?: ChordShortcut[];
  active?: boolean;
  chordTimeoutMs?: number;
}) {
  const handlersRef = useRef({ shortcuts, chords });

  useEffect(() => {
    handlersRef.current = { shortcuts, chords };
  });

  useEffect(() => {
    if (!active) return;

    let pendingPrefix: string | null = null;
    let chordTimer: number | null = null;

    const clearChord = () => {
      pendingPrefix = null;
      if (chordTimer !== null) {
        window.clearTimeout(chordTimer);
        chordTimer = null;
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (event.metaKey || event.ctrlKey || event.altKey) {
        clearChord();
        return;
      }

      const editable = isEditableTarget(event.target);
      const { shortcuts: currentShortcuts, chords: currentChords } =
        handlersRef.current;

      if (pendingPrefix !== null && !editable) {
        const lowerKey = event.key.toLowerCase();
        const matchedChord = currentChords.find(
          (chord) =>
            chord.enabled !== false &&
            chord.prefix.toLowerCase() === pendingPrefix &&
            chord.key.toLowerCase() === lowerKey,
        );
        clearChord();
        if (matchedChord) {
          event.preventDefault();
          matchedChord.onTrigger();
          return;
        }
      }

      const matchedShortcut = currentShortcuts.find(
        (shortcut) =>
          shortcut.enabled !== false &&
          shortcut.key === event.key &&
          (!editable || shortcut.allowInEditable),
      );
      if (matchedShortcut) {
        clearChord();
        event.preventDefault();
        matchedShortcut.onTrigger(event);
        return;
      }

      if (!editable && currentChords.length > 0) {
        const lowerKey = event.key.toLowerCase();
        const hasPrefix = currentChords.some(
          (chord) =>
            chord.enabled !== false &&
            chord.prefix.toLowerCase() === lowerKey,
        );
        if (hasPrefix) {
          clearChord();
          pendingPrefix = lowerKey;
          chordTimer = window.setTimeout(clearChord, chordTimeoutMs);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      clearChord();
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [active, chordTimeoutMs]);
}
