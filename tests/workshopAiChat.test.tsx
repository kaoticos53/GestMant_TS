// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { settle } from "./settle";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const { mockUseQuery, mockUseAction, mockToastError } = vi.hoisted(() => ({
  mockUseQuery: vi.fn(),
  mockUseAction: vi.fn(),
  mockToastError: vi.fn(),
}));

vi.mock("convex/react", () => ({
  useQuery: mockUseQuery,
  useAction: mockUseAction,
}));

vi.mock("sonner", () => ({
  toast: {
    error: mockToastError,
  },
}));

import { WorkshopAiChatButton } from "@/components/ai/WorkshopAiChatButton";

describe("WorkshopAiChatButton", () => {
  let container: HTMLDivElement;
  let root: Root;
  let askWorkshopMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    askWorkshopMock = vi.fn().mockResolvedValue({
      answer:
        "Resumen para **ALI-24015** y **INC-0010**:\n\n| Código | Estado |\n| --- | --- |\n| ALI-24015 | Bajo mínimo |",
      citedReferences: ["ALI-24015", "INC-0010"],
      usedTools: ["search_spare_parts", "search_incidents"],
      debugTrace: [
        {
          round: 1,
          endpoint: "https://api.deepseek.com/v1/chat/completions",
          model: "deepseek-chat",
          temperature: 0.2,
          maxTokens: 1200,
          toolNames: ["search_spare_parts"],
          messages: [{ role: "user", content: "¿Qué repuestos están bajo mínimo?" }],
          responseStatus: 200,
          finishReason: "stop",
          rawContent: '{"answer":"ok","citedReferences":[]}',
          durationMs: 120,
        },
      ],
    });
    mockUseAction.mockReturnValue(askWorkshopMock);
    mockUseQuery.mockReturnValue({
      available: true,
      tasks: { labelScanner: true, incidentQa: true, workshopChat: true },
    });
    mockToastError.mockClear();
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("no se renderiza si la IA no está disponible o workshopChat está desactivado", async () => {
    mockUseQuery.mockReturnValue({
      available: true,
      tasks: { labelScanner: true, incidentQa: true, workshopChat: false },
    });
    await act(async () => {
      root.render(<WorkshopAiChatButton />);
    });
    await settle();

    expect(container.querySelector("button")).toBeNull();
  });

  it("abre el chat global con la IA, envía la consulta y muestra la respuesta con referencias", async () => {
    await act(async () => {
      root.render(<WorkshopAiChatButton />);
    });
    await settle();

    const trigger = container.querySelector<HTMLButtonElement>(
      "button[aria-label='Asistente IA del taller']",
    );
    expect(trigger).not.toBeNull();

    await act(async () => {
      trigger?.click();
    });
    await settle();

    expect(document.body.textContent).toContain("Asistente IA del taller");

    // Activar modo depuración
    const debugBtn = document.body.querySelector<HTMLButtonElement>(
      "button[aria-label='Modo depuración']",
    );
    expect(debugBtn).not.toBeNull();
    await act(async () => {
      debugBtn?.click();
    });

    const textarea = document.body.querySelector<HTMLTextAreaElement>(
      "#workshop-ai-input",
    );
    expect(textarea).not.toBeNull();

    await act(async () => {
      if (textarea) {
        const setter = Object.getOwnPropertyDescriptor(
          HTMLTextAreaElement.prototype,
          "value",
        )?.set;
        setter?.call(textarea, "¿Qué repuestos están bajo mínimo?");
        textarea.dispatchEvent(new Event("input", { bubbles: true }));
      }
    });

    const sendBtn = Array.from(document.body.querySelectorAll("button")).find(
      (b) => b.getAttribute("aria-label") === "Enviar consulta",
    );
    expect(sendBtn).not.toBeUndefined();

    await act(async () => {
      sendBtn?.click();
    });
    await settle();

    expect(askWorkshopMock).toHaveBeenCalledWith({
      question: "¿Qué repuestos están bajo mínimo?",
      history: [],
      debug: true,
    });
    expect(document.body.textContent).toContain("Traza de depuración (1 ronda)");
    expect(document.body.textContent).toContain("ALI-24015");
    expect(document.body.textContent).toContain("INC-0010");
    expect(document.body.textContent).toContain("search_spare_parts");
    expect(document.body.querySelector("table")).not.toBeNull();
    expect(document.body.querySelector("strong")?.textContent).toBe("ALI-24015");

    // Insertar variable rápida en el input del chat
    const varChip = Array.from(document.body.querySelectorAll("button")).find(
      (b) => b.textContent?.trim() === "{{fecha_actual}}",
    );
    expect(varChip).not.toBeUndefined();
    await act(async () => {
      varChip?.click();
    });
    expect(textarea?.value).toContain("{{fecha_actual}}");

    // Plegar el panel lateral derecho y volver a desplegarlo conservando el historial
    const panel = document.body.querySelector("aside[aria-label='Asistente IA del taller']");
    expect(panel).not.toBeNull();

    const collapseBtn = document.body.querySelector<HTMLButtonElement>(
      "button[aria-label='Plegar panel de IA']",
    );
    expect(collapseBtn).not.toBeNull();

    await act(async () => {
      collapseBtn?.click();
    });
    expect(document.body.querySelector("aside[aria-label='Asistente IA del taller']")).toBeNull();

    await act(async () => {
      trigger?.click();
    });
    expect(document.body.querySelector("aside[aria-label='Asistente IA del taller']")).not.toBeNull();
    expect(document.body.textContent).toContain("ALI-24015");

    // Redimensionar el panel arrastrando el separador izquierdo
    const resizer = document.body.querySelector<HTMLDivElement>(
      "[role='separator'][aria-label='Redimensionar panel de IA']",
    );
    expect(resizer).not.toBeNull();

    Object.defineProperty(window, "innerWidth", {
      value: 1280,
      configurable: true,
    });

    await act(async () => {
      resizer?.dispatchEvent(
        new MouseEvent("mousedown", { bubbles: true, clientX: 860 }),
      );
      window.dispatchEvent(
        new MouseEvent("mousemove", { bubbles: true, clientX: 700 }),
      );
      window.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    });

    const resizedPanel = document.body.querySelector<HTMLElement>(
      "aside[aria-label='Asistente IA del taller']",
    );
    expect(resizedPanel?.style.width).toBe("580px");
  });
});
