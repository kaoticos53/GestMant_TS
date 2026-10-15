import { api } from "@/convex/_generated/api";
import {
  SIDEBAR_WIDTH_DEFAULT,
  SIDEBAR_WIDTH_STEP,
  clampSidebarWidth,
  readSidebarCollapsed,
  readSidebarWidth,
  safeLocalStorage,
  writeSidebarCollapsed,
  writeSidebarWidth,
} from "@/lib/sidebar";
import { useMutation } from "convex/react";
import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import type { SidebarLayoutProfile } from "../types";

/** Ancho de siempre, ya ajustado a la ventana actual. */
export function resetSidebarWidth(): number {
  return clampSidebarWidth(SIDEBAR_WIDTH_DEFAULT, window.innerWidth);
}

/**
 * Menú lateral en escritorio: ancho ajustable (se arrastra desde su borde o se
 * afina con las flechas del teclado) y plegable del todo.
 *
 * El perfil del usuario es la fuente de verdad: al entrar se adopta lo que allí
 * haya y cada cambio se guarda en él, así que la preferencia viaja con la
 * persona y no con el navegador. `localStorage` se mantiene como copia local
 * para pintar el ancho bueno en el primer render (antes de que llegue el
 * perfil) y para no perder el ajuste si la escritura falla.
 *
 * Devuelve el ancho a aplicar al `<aside>`, si está plegado, la referencia para
 * medir dónde empieza y las props del asa. Arg: el usuario firmado (o `null`
 * mientras no se sabe quién es).
 */
export function useSidebarPanel(profile: SidebarLayoutProfile | null | undefined) {
  const [width, setWidth] = useState(() =>
    clampSidebarWidth(
      readSidebarWidth(safeLocalStorage()) ?? SIDEBAR_WIDTH_DEFAULT,
      window.innerWidth,
    ),
  );
  const [collapsed, setCollapsed] = useState(() =>
    readSidebarCollapsed(safeLocalStorage()),
  );
  const [resizing, setResizing] = useState(false);
  const asideRef = useRef<HTMLElement | null>(null);
  // El arrastre se sigue en un ref: los eventos de puntero no deben depender de
  // que React haya vuelto a renderizar entre dos movimientos.
  const dragging = useRef(false);
  const saveLayout = useMutation(api.members.saveSidebarLayout);

  // El perfil llega después del primer render, así que se adopta una sola vez
  // por usuario (patrón de React para ajustar estado al aparecer una prop). Así
  // el arranque es instantáneo con la copia local, sin parpadeo.
  const [layoutOwner, setLayoutOwner] = useState<string | null>(null);
  if (profile && layoutOwner !== profile._id) {
    setLayoutOwner(profile._id);
    // Un perfil sin preferencia (cuenta nueva) conserva la copia local: es la
    // que el usuario acaba de elegir en este navegador, y se sube al perfil.
    if (profile.sidebarWidth !== undefined) {
      setWidth(clampSidebarWidth(profile.sidebarWidth, window.innerWidth));
    }
    if (profile.sidebarCollapsed !== undefined) {
      setCollapsed(profile.sidebarCollapsed);
    }
  }

  // La copia local se escribe al soltar, no en cada píxel del arrastre.
  useEffect(() => {
    if (resizing) return;
    writeSidebarWidth(safeLocalStorage(), width);
  }, [width, resizing]);

  useEffect(() => {
    writeSidebarCollapsed(safeLocalStorage(), collapsed);
  }, [collapsed]);

  useEffect(() => {
    // Durante el arrastre solo se pinta: al soltar (o al pulsar una flecha) es
    // cuando se manda una única escritura al perfil, no una por píxel.
    if (resizing || layoutOwner === null) return;
    saveLayout({ width, collapsed }).catch((error: unknown) => {
      console.warn("No se pudo guardar el menú en el perfil:", error);
    });
  }, [resizing, layoutOwner, width, collapsed, saveLayout]);

  // Si la ventana se estrecha, el panel se reajusta para no comerse el contenido.
  useEffect(() => {
    const handleWindowResize = () =>
      setWidth((current) => clampSidebarWidth(current, window.innerWidth));
    window.addEventListener("resize", handleWindowResize);
    return () => window.removeEventListener("resize", handleWindowResize);
  }, []);

  // Mientras se arrastra, el cursor y la selección de texto no deben cambiar.
  useEffect(() => {
    if (!resizing) return;
    const { cursor, userSelect } = document.body.style;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    return () => {
      document.body.style.cursor = cursor;
      document.body.style.userSelect = userSelect;
    };
  }, [resizing]);

  /** El asa viaja con el puntero, así que el ancho es la distancia al borde del menú. */
  const setFromPointer = (clientX: number) => {
    const left = asideRef.current?.getBoundingClientRect().left ?? 0;
    setWidth(clampSidebarWidth(clientX - left, window.innerWidth));
  };

  const stopDragging = () => {
    dragging.current = false;
    setResizing(false);
  };

  const resizeHandleProps = {
    onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      dragging.current = true;
      setResizing(true);
    },
    onPointerMove: (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!dragging.current) return;
      setFromPointer(event.clientX);
    },
    onPointerUp: () => {
      if (!dragging.current) return;
      stopDragging();
    },
    onPointerCancel: () => {
      if (!dragging.current) return;
      stopDragging();
    },
    onDoubleClick: () => setWidth(resetSidebarWidth()),
    onKeyDown: (event: ReactKeyboardEvent<HTMLDivElement>) => {
      if (event.key === "ArrowLeft") {
        setWidth((current) =>
          clampSidebarWidth(current - SIDEBAR_WIDTH_STEP, window.innerWidth),
        );
      } else if (event.key === "ArrowRight") {
        setWidth((current) =>
          clampSidebarWidth(current + SIDEBAR_WIDTH_STEP, window.innerWidth),
        );
      } else if (event.key === "Home") {
        setWidth(resetSidebarWidth());
      } else {
        return;
      }
      event.preventDefault();
    },
  };

  const toggleCollapsed = () => setCollapsed((current) => !current);

  return {
    width,
    resizing,
    collapsed,
    toggleCollapsed,
    asideRef,
    resizeHandleProps,
  };
}
