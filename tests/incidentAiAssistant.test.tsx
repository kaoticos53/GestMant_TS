// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { settle } from "./settle";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const { mockUseAction, mockToastError } = vi.hoisted(() => ({
  mockUseAction: vi.fn(),
  mockToastError: vi.fn(),
}));

vi.mock("convex/react", () => ({
  useAction: mockUseAction,
}));

vi.mock("sonner", () => ({
  toast: {
    error: mockToastError,
  },
}));

import { IncidentAiAssistantDialog } from "@/pages/dashboard/incidents/components/IncidentAiAssistantDialog";

describe("IncidentAiAssistantDialog", () => {
  let container: HTMLDivElement;
  let root: Root;
  let askMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    askMock = vi.fn().mockResolvedValue({
      answer: "Se detectaron 2 averías en fuentes de alimentación (INC-0042 y INC-0055).",
      citedReferences: ["INC-0042", "INC-0055"],
    });
    mockUseAction.mockReturnValue(askMock);
    mockToastError.mockClear();
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("envía la consulta a DeepSeek y muestra la respuesta con citas clicables", async () => {
    const onOpenIncident = vi.fn();
    const onOpenChange = vi.fn();

    await act(async () => {
      root.render(
        <IncidentAiAssistantDialog
          open={true}
          onOpenChange={onOpenChange}
          onOpenIncident={onOpenIncident}
        />,
      );
    });
    await settle();

    const textarea = document.body.querySelector<HTMLTextAreaElement>(
      "#incident-ai-question",
    );
    expect(textarea).not.toBeNull();

    await act(async () => {
      if (textarea) {
        const setter = Object.getOwnPropertyDescriptor(
          HTMLTextAreaElement.prototype,
          "value",
        )?.set;
        setter?.call(textarea, "¿Qué fallos repetidos hubo en fuentes?");
        textarea.dispatchEvent(new Event("input", { bubbles: true }));
      }
    });

    const submitBtn = Array.from(document.body.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("Consultar historial"),
    );
    expect(submitBtn).not.toBeUndefined();

    await act(async () => {
      submitBtn?.click();
    });
    await settle();

    expect(askMock).toHaveBeenCalledWith({
      question: "¿Qué fallos repetidos hubo en fuentes?",
    });
    expect(document.body.textContent).toContain(
      "Se detectaron 2 averías en fuentes de alimentación",
    );

    const citeBtn = Array.from(document.body.querySelectorAll("button")).find(
      (b) => b.textContent?.trim() === "INC-0042",
    );
    expect(citeBtn).not.toBeUndefined();
    await act(async () => {
      citeBtn?.click();
    });

    expect(onOpenIncident).toHaveBeenCalledWith("INC-0042");
  });
});
