// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { MemoryRouter } from "react-router";
import ReportIncident from "@/pages/ReportIncident";

const { MOCK_AUTH } = vi.hoisted(() => ({
  MOCK_AUTH: {
    user: null as Record<string, unknown> | null,
    isAuthenticated: false,
    isLoading: false,
  },
}));

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({
    user: MOCK_AUTH.user,
    isAuthenticated: MOCK_AUTH.isAuthenticated,
    isLoading: MOCK_AUTH.isLoading,
    signIn: vi.fn(),
    signOut: vi.fn(),
  }),
}));

vi.mock("convex/react", () => ({
  useQuery: () => [],
  useMutation: () => vi.fn(),
}));

// Mock para RichTextEditor si usa canvas o DOM específico
vi.mock("@/components/RichTextEditor", () => ({
  RichTextEditor: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <textarea
      data-testid="rich-editor"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));

describe("ReportIncident - Autocompletado de datos del notificador", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeAll(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  });

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    MOCK_AUTH.user = null;
    MOCK_AUTH.isAuthenticated = false;
  });

  test("sin sesión iniciada los campos de contacto empiezan vacíos", async () => {
    MOCK_AUTH.user = null;
    MOCK_AUTH.isAuthenticated = false;

    await act(async () => {
      root.render(
        <MemoryRouter>
          <ReportIncident />
        </MemoryRouter>,
      );
    });

    const nameInput = container.querySelector("#inc-name") as HTMLInputElement;
    const emailInput = container.querySelector("#inc-email") as HTMLInputElement;
    const roleInput = container.querySelector("#inc-role") as HTMLInputElement;
    const locationInput = container.querySelector("#inc-location") as HTMLInputElement;

    expect(nameInput.value).toBe("");
    expect(emailInput.value).toBe("");
    expect(roleInput.value).toBe("");
    expect(locationInput.value).toBe("");
    expect(container.textContent).not.toContain("Sesión iniciada");
  });

  test("con sesión iniciada se autorrellenan nombre, correo, puesto y ubicación desde el perfil", async () => {
    MOCK_AUTH.user = {
      _id: "user_test_123",
      name: "Laura Peña",
      email: "laura.pena@taller.es",
      position: "Responsable de Realización",
      location: "Plató 1 · Control",
    };
    MOCK_AUTH.isAuthenticated = true;

    await act(async () => {
      root.render(
        <MemoryRouter>
          <ReportIncident />
        </MemoryRouter>,
      );
    });

    const nameInput = container.querySelector("#inc-name") as HTMLInputElement;
    const emailInput = container.querySelector("#inc-email") as HTMLInputElement;
    const roleInput = container.querySelector("#inc-role") as HTMLInputElement;
    const locationInput = container.querySelector("#inc-location") as HTMLInputElement;

    expect(nameInput.value).toBe("Laura Peña");
    expect(emailInput.value).toBe("laura.pena@taller.es");
    expect(roleInput.value).toBe("Responsable de Realización");
    expect(locationInput.value).toBe("Plató 1 · Control");
    expect(container.textContent).toContain("Sesión iniciada: datos de contacto autocompletados");
  });
});
