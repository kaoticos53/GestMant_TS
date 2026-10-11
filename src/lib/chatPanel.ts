/**
 * Estado del panel de mensajería (lista de conversaciones, chat abierto y
 * diálogo de «nuevo mensaje»). Vive fuera del componente para poder probar las
 * transiciones sin navegador: el fallo que arregla es que, al cerrar el chat,
 * la lista de conversaciones se quedaba cerrada y no había forma de volver.
 */

/** Conversación abierta: contacto y nombre visible. */
export interface ChatThread<TId extends string = string> {
  id: TId;
  name: string;
}

export interface ChatPanelState<TId extends string = string> {
  /** Lista de conversaciones desplegada bajo el icono del sobre. */
  listOpen: boolean;
  /** Conversación abierta en el panel lateral (`null` = ninguna). */
  thread: ChatThread<TId> | null;
  /** Diálogo de «nuevo mensaje» abierto. */
  composerOpen: boolean;
}

export type ChatPanelAction<TId extends string = string> =
  | { type: "toggle-list" }
  | { type: "dismiss" }
  | { type: "open-thread"; thread: ChatThread<TId> }
  | { type: "close-thread" }
  | { type: "open-composer" }
  | { type: "close-composer" }
  | { type: "sent"; thread: ChatThread<TId> };

/** Estado inicial: todo cerrado. */
export function initialChatPanel<TId extends string = string>(): ChatPanelState<TId> {
  return { listOpen: false, thread: null, composerOpen: false };
}

/** ¿Hay alguna ventana abierta (chat o alta de mensaje)? */
export function isModalOpen(state: ChatPanelState): boolean {
  return state.thread !== null || state.composerOpen;
}

/**
 * ¿Un clic fuera del panel debe cerrar la lista? Solo cuando no hay ninguna
 * ventana abierta: con el chat en pantalla, el clic que se lleva por delante el
 * chat (su velo o el botón de cerrar) no debe cerrar además la lista, porque es
 * la forma de volver a la conversación.
 */
export function closesListOnOutsideClick(state: ChatPanelState): boolean {
  return state.listOpen && !isModalOpen(state);
}

export function chatPanelReducer<TId extends string>(
  state: ChatPanelState<TId>,
  action: ChatPanelAction<TId>,
): ChatPanelState<TId> {
  switch (action.type) {
    case "toggle-list":
      return { ...state, listOpen: !state.listOpen };

    case "dismiss":
      // Solo cierra la lista: el chat abierto no se toca.
      return { ...state, listOpen: false };

    case "open-thread":
      // La lista se queda abierta debajo del chat para poder volver a ella.
      return {
        ...state,
        listOpen: true,
        composerOpen: false,
        thread: action.thread,
      };

    case "close-thread":
      // Al cerrar el chat, la lista vuelve a estar a la vista.
      return { ...state, listOpen: true, thread: null };

    case "open-composer":
      return { ...state, composerOpen: true };

    case "close-composer":
      return { ...state, composerOpen: false };

    case "sent":
      return {
        ...state,
        listOpen: true,
        composerOpen: false,
        thread: action.thread,
      };
  }
}
