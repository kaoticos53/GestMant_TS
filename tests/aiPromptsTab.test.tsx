// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_AI_PROMPTS, type AiSettingsPublicView } from "@/lib/ai";
import { settle } from "./settle";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const { mockUseQuery, mockUseMutation, mockToastSuccess, mockToastError } =
  vi.hoisted(() => ({
    mockUseQuery: vi.fn(),
    mockUseMutation: vi.fn(),
    mockToastSuccess: vi.fn(),
    mockToastError: vi.fn(),
  }));

vi.mock("convex/react", () => ({
  useQuery: mockUseQuery,
  useMutation: mockUseMutation,
}));

vi.mock("sonner", () => ({
  toast: {
    success: mockToastSuccess,
    error: mockToastError,
  },
}));

import { AiPromptsCard } from "@/pages/dashboard/settings/AiPromptsCard";

function makeSettings(overrides: Partial<AiSettingsPublicView> = {}): AiSettingsPublicView {
  return {
    enabled: true,
    baseUrl: "https://api.deepseek.com/v1",
    visionModel: "deepseek-flash",
    chatModel: "deepseek-chat",
    hasKey: true,
    keyHint: "…1234",
    keySource: "guardada",
    envConfigured: false,
    updatedAt: 1_700_000_000_000,
    updatedBy: "admin@taller.es",
    lastTestAt: null,
    lastTestOk: null,
    lastTestError: null,
    tasks: { labelScanner: true, incidentQa: true, workshopChat: true },
    rateLimitPerHour: 40,
    allowedRoles: [],
    enabledModules: ["equipment", "incidents", "requests", "purchasing", "parts", "manuals"],
    taskParams: {
      label_scanner: { temperature: 0.1, maxTokens: 1600 },
      incident_qa: { temperature: 0.1, maxTokens: 900 },
      workshop_chat: { temperature: 0.2, maxTokens: 1200 },
    },
    ...overrides,
  };
}

describe("AiPromptsCard (Fase 3 TDD)", () => {
  let container: HTMLDivElement;
  let root: Root;
  let saveMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    saveMock = vi.fn().mockResolvedValue(makeSettings());
    mockUseQuery.mockReturnValue(makeSettings());
    mockUseMutation.mockReturnValue(saveMock);
    mockToastSuccess.mockClear();
    mockToastError.mockClear();
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("muestra el prompt por defecto, variables insertables, contrato JSON protegido y permite guardar y restaurar", async () => {
    await act(async () => {
      root.render(<AiPromptsCard />);
    });
    await settle();

    // Por defecto muestra la tarea del chat global o permite seleccionarla
    const chatTaskBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("Chat global"),
    );
    expect(chatTaskBtn).not.toBeUndefined();
    await act(async () => {
      chatTaskBtn?.click();
    });

    const promptArea = container.querySelector<HTMLTextAreaElement>("#ai-prompt-editor");
    expect(promptArea).not.toBeNull();
    expect(promptArea?.value).toContain(DEFAULT_AI_PROMPTS.workshop_chat);

    // Contrato JSON protegido visible
    expect(container.textContent).toContain("Contrato JSON protegido");
    expect(container.textContent).toContain('"citedReferences"');

    // Insertar variable desde chip
    const varChip = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("{{usuario_nombre}}"),
    );
    expect(varChip).not.toBeUndefined();
    await act(async () => {
      varChip?.click();
    });
    expect(promptArea?.value).toContain("{{usuario_nombre}}");

    // Guardar
    const saveBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("Guardar prompts"),
    );
    await act(async () => {
      saveBtn?.click();
    });
    await settle();

    expect(saveMock).toHaveBeenCalledWith(
      expect.objectContaining({
        taskParams: expect.objectContaining({
          workshop_chat: expect.objectContaining({
            customPrompt: expect.stringContaining("{{usuario_nombre}}"),
          }),
        }),
      }),
    );

    // Restaurar por defecto
    const restoreBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("Restaurar por defecto"),
    );
    await act(async () => {
      restoreBtn?.click();
    });
    expect(promptArea?.value).toBe(DEFAULT_AI_PROMPTS.workshop_chat);
  });
});
