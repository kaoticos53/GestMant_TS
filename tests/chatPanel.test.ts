import { describe, expect, test } from "vitest";
import {
  chatPanelReducer,
  closesListOnOutsideClick,
  initialChatPanel,
  isModalOpen,
  type ChatPanelAction,
  type ChatPanelState,
} from "../src/lib/chatPanel";

const ELENA = { id: "u1", name: "Elena Vidal" };
const IVAN = { id: "u2", name: "Iván Torres" };

/** Aplica una secuencia de acciones desde el estado inicial. */
function run(...actions: ChatPanelAction[]): ChatPanelState {
  return actions.reduce(chatPanelReducer, initialChatPanel());
}

/** Secuencia habitual: abrir la lista y entrar en una conversación. */
function inThread(thread = ELENA): ChatPanelState {
  return run(
    { type: "toggle-list" },
    { type: "open-thread", thread },
  );
}

describe("panel de mensajería — abrir y cerrar", () => {
  test("el icono alterna la lista", () => {
    expect(run({ type: "toggle-list" })).toMatchObject({ listOpen: true });
    expect(
      run({ type: "toggle-list" }, { type: "toggle-list" }),
    ).toMatchObject({ listOpen: false });
  });

  test("abrir un hilo mantiene la lista debajo y cierra el alta de mensaje", () => {
    const state = run(
      { type: "toggle-list" },
      { type: "open-composer" },
      { type: "open-thread", thread: ELENA },
    );

    expect(state.listOpen).toBe(true);
    expect(state.composerOpen).toBe(false);
    expect(state.thread).toEqual(ELENA);
    expect(isModalOpen(state)).toBe(true);
  });

  test("el clic fuera cierra la lista pero no el chat abierto", () => {
    const state = chatPanelReducer(inThread(), { type: "dismiss" });

    expect(state.listOpen).toBe(false);
    expect(state.thread).toEqual(ELENA);
  });

  test("cerrar el alta de mensaje no toca la conversación abierta", () => {
    const state = run(
      { type: "open-thread", thread: ELENA },
      { type: "open-composer" },
      { type: "close-composer" },
    );

    expect(state.composerOpen).toBe(false);
    expect(state.thread).toEqual(ELENA);
  });

  test("el reducer no muta el estado que recibe", () => {
    const before = inThread();
    const snapshot = { ...before };

    chatPanelReducer(before, { type: "close-thread" });

    expect(before).toEqual(snapshot);
    expect(before.thread).toEqual(ELENA);
  });
});

describe("cerrar el chat siempre deja forma de volver", () => {
  test("al cerrar el chat la lista queda a la vista y sin ventanas abiertas", () => {
    const closed = chatPanelReducer(inThread(), { type: "close-thread" });

    expect(closed.thread).toBeNull();
    expect(closed.listOpen).toBe(true);
    expect(isModalOpen(closed)).toBe(false);
    // Y el clic fuera vuelve a comportarse como siempre
    expect(closesListOnOutsideClick(closed)).toBe(true);
  });

  test("se puede reabrir la misma conversación u otra", () => {
    const closed = chatPanelReducer(inThread(), { type: "close-thread" });

    const again = chatPanelReducer(closed, {
      type: "open-thread",
      thread: ELENA,
    });
    expect(again.thread).toEqual(ELENA);

    const other = chatPanelReducer(closed, {
      type: "open-thread",
      thread: IVAN,
    });
    expect(other.thread).toEqual(IVAN);
    expect(other.listOpen).toBe(true);
  });

  test("con el chat en pantalla, el clic que lo cierra no cierra la lista", () => {
    // El oyente de clic-fuera ni se registra en este estado
    expect(closesListOnOutsideClick(inThread())).toBe(false);
    expect(
      closesListOnOutsideClick(run({ type: "toggle-list" }, { type: "open-composer" })),
    ).toBe(false);
  });

  test("cerrada la lista y sin chat, un clic fuera no hace nada raro", () => {
    expect(closesListOnOutsideClick(initialChatPanel())).toBe(false);
  });

  test("secuencia completa: lista → chat → cerrar → lista → chat", () => {
    let state = run({ type: "toggle-list" });
    expect(state.listOpen).toBe(true);

    state = chatPanelReducer(state, { type: "open-thread", thread: IVAN });
    expect(state.listOpen).toBe(true);
    expect(state.thread).toEqual(IVAN);

    state = chatPanelReducer(state, { type: "close-thread" });
    expect(state.listOpen).toBe(true);
    expect(state.thread).toBeNull();

    state = chatPanelReducer(state, { type: "open-thread", thread: IVAN });
    expect(state.thread).toEqual(IVAN);
  });
});

describe("alta de mensaje nuevo", () => {
  test("al enviar se abre la conversación con ese contacto y queda la lista", () => {
    const state = run(
      { type: "toggle-list" },
      { type: "open-composer" },
      { type: "sent", thread: IVAN },
    );

    expect(state.thread).toEqual(IVAN);
    expect(state.composerOpen).toBe(false);
    expect(state.listOpen).toBe(true);
  });

  test("cerrar el chat tras enviar deja la lista disponible", () => {
    const state = chatPanelReducer(
      run({ type: "open-composer" }, { type: "sent", thread: IVAN }),
      { type: "close-thread" },
    );

    expect(state).toEqual({ listOpen: true, thread: null, composerOpen: false });
  });
});
