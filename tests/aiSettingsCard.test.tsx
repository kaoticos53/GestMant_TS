// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AiSettingsPublicView } from "@/lib/ai";
import { settle } from "./settle";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const { mockUseQuery, mockUseMutation, mockUseAction, mockToastSuccess, mockToastError } =
  vi.hoisted(() => ({
    mockUseQuery: vi.fn(),
    mockUseMutation: vi.fn(),
    mockUseAction: vi.fn(),
    mockToastSuccess: vi.fn(),
    mockToastError: vi.fn(),
  }));

vi.mock("convex/react", () => ({
  useQuery: mockUseQuery,
  useMutation: mockUseMutation,
  useAction: mockUseAction,
}));

vi.mock("sonner", () => ({
  toast: {
    success: mockToastSuccess,
    error: mockToastError,
  },
}));

import { AiSettingsCard } from "@/pages/dashboard/settings/AiSettingsCard";

function makeSettings(overrides: Partial<AiSettingsPublicView> = {}): AiSettingsPublicView {
  return {
    enabled: true,
    baseUrl: "https://api.deepseek.com",
    visionModel: "deepseek-chat",
    chatModel: "deepseek-chat",
    hasKey: true,
    keyHint: "sk-••••••1234",
    keySource: "guardada",
    envConfigured: false,
    updatedAt: 1_700_000_000_000,
    updatedBy: "admin@taller.es",
    lastTestAt: null,
    lastTestOk: null,
    lastTestError: null,
    ...overrides,
  };
}

describe("AiSettingsCard", () => {
  let container: HTMLDivElement;
  let root: Root;
  let saveMock: ReturnType<typeof vi.fn>;
  let testConnMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    saveMock = vi.fn().mockResolvedValue(makeSettings());
    testConnMock = vi.fn().mockResolvedValue({ ok: true });
    mockUseMutation.mockReturnValue(saveMock);
    mockUseAction.mockReturnValue(testConnMock);
    mockToastSuccess.mockClear();
    mockToastError.mockClear();
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("muestra estado de carga cuando settings aún no llega", async () => {
    mockUseQuery.mockReturnValue(undefined);
    await act(async () => {
      root.render(<AiSettingsCard />);
    });
    await settle();
    expect(container.textContent).toContain("Cargando configuración de IA");
  });

  it("muestra la pista enmascarada de la clave y permite guardar cambios", async () => {
    mockUseQuery.mockReturnValue(makeSettings({ keyHint: "sk-••••••9876", keySource: "guardada" }));
    await act(async () => {
      root.render(<AiSettingsCard />);
    });
    await settle();

    expect(container.textContent).toContain("sk-••••••9876");
    expect(container.textContent).toContain("Guardada en base de datos");

    const apiKeyInput = container.querySelector<HTMLInputElement>("#ai-api-key");
    expect(apiKeyInput).not.toBeNull();
    await act(async () => {
      if (apiKeyInput) {
        const setter = Object.getOwnPropertyDescriptor(
          HTMLInputElement.prototype,
          "value",
        )?.set;
        setter?.call(apiKeyInput, "sk-nueva-clave-1234");
        apiKeyInput.dispatchEvent(new Event("input", { bubbles: true }));
      }
    });

    const saveBtn = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Guardar configuración"),
    );
    expect(saveBtn).not.toBeUndefined();

    await act(async () => {
      saveBtn?.click();
    });
    await settle();

    expect(saveMock).toHaveBeenCalledWith(
      expect.objectContaining({
        enabled: true,
        baseUrl: "https://api.deepseek.com",
        visionModel: "deepseek-chat",
        chatModel: "deepseek-chat",
        apiKey: "sk-nueva-clave-1234",
        clearApiKey: false,
      }),
    );
    expect(mockToastSuccess).toHaveBeenCalled();
  });

  it("ejecuta la prueba de conexión con DeepSeek y muestra el resultado", async () => {
    mockUseQuery.mockReturnValue(makeSettings());
    testConnMock.mockResolvedValue({ ok: true });
    await act(async () => {
      root.render(<AiSettingsCard />);
    });
    await settle();

    const testBtn = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Probar conexión"),
    );
    expect(testBtn).not.toBeUndefined();

    await act(async () => {
      testBtn?.click();
    });
    await settle();

    expect(testConnMock).toHaveBeenCalledWith({});
    expect(mockToastSuccess).toHaveBeenCalled();
  });

  it("muestra error cuando la prueba de conexión falla", async () => {
    mockUseQuery.mockReturnValue(
      makeSettings({
        hasKey: false,
        keyHint: "",
        keySource: "ninguna",
        lastTestAt: 1_700_000_001_000,
        lastTestOk: false,
        lastTestError: "HTTP 401 Unauthorized",
      }),
    );
    testConnMock.mockResolvedValue({ ok: false, error: "HTTP 401 Unauthorized" });
    await act(async () => {
      root.render(<AiSettingsCard />);
    });
    await settle();

    expect(container.textContent).toContain("HTTP 401 Unauthorized");

    const testBtn = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Probar conexión"),
    );
    await act(async () => {
      testBtn?.click();
    });
    await settle();

    expect(mockToastError).toHaveBeenCalledWith("HTTP 401 Unauthorized");
  });
});
