// @vitest-environment jsdom
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { ApiAddressAlert } from "@/components/ApiAddressNotice";
import { apiAddressTrouble } from "@/lib/apiAddress";

/**
 * El aviso que sale al arrancar la app cuando la dirección pública de la API no
 * responde desde el navegador. Se pinta con la avería ya decidida —la regla que
 * la decide tiene sus propias pruebas en `apiAddress.test.ts`—, y lo que se mira
 * aquí es lo que de verdad importa: que se lea qué pasa, con qué dirección, y que
 * se pueda volver a comprobar sin recargar.
 */

let roots: Root[] = [];

beforeEach(() => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  document.body.innerHTML = "";
  roots = [];
});

afterEach(async () => {
  await act(async () => {
    for (const root of roots) root.unmount();
  });
  roots = [];
  document.body.innerHTML = "";
});

async function mount(node: ReactNode): Promise<HTMLElement> {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  roots.push(root);
  await act(async () => {
    root.render(<>{node}</>);
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  return container;
}

/** La avería del caso más común: la dirección no contesta a nada. */
const sinRespuesta = apiAddressTrouble({
  apiUrl: "https://api.tudominio.com",
  pageProtocol: "https:",
  waitedMs: 20000,
  answers: false,
});

describe("el aviso de la dirección de la API", () => {
  test("sin avería no se pinta nada", async () => {
    const container = await mount(
      <ApiAddressAlert trouble={null} onRecheck={() => {}} />,
    );
    expect(container.textContent).toBe("");
    expect(container.querySelector('[role="alert"]')).toBeNull();
  });

  test("cuenta qué pasa, con la dirección delante y el motivo en el titular", async () => {
    expect(sinRespuesta).not.toBeNull();
    const container = await mount(
      <ApiAddressAlert trouble={sinRespuesta} onRecheck={() => {}} />,
    );

    expect(container.querySelector('[role="alert"]')).not.toBeNull();
    expect(container.textContent).toContain(
      "No se puede hablar con la API del taller",
    );
    expect(container.textContent).toContain("No responde");
    expect(container.textContent).toContain("https://api.tudominio.com");
    // La explicación entera, no solo el motivo en corto.
    expect(container.textContent).toContain("CONVEX_CLOUD_ORIGIN");
  });

  test("«Volver a comprobar» vuelve a preguntar, sin recargar la página", async () => {
    const onRecheck = vi.fn();
    const container = await mount(
      <ApiAddressAlert trouble={sinRespuesta} onRecheck={onRecheck} />,
    );

    const button = [...container.querySelectorAll("button")].find(
      (candidate) => candidate.textContent?.trim() === "Volver a comprobar",
    );
    expect(button).not.toBeUndefined();
    await act(async () => {
      button!.dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }),
      );
    });

    expect(onRecheck).toHaveBeenCalledTimes(1);
  });
});
