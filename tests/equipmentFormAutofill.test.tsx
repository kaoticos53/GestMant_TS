// @vitest-environment jsdom
import { settle } from "./settle";
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const { CATALOGO } = vi.hoisted(() => ({
  CATALOGO: [
    {
      _id: "modelo_hdc3500",
      _creationTime: 1,
      model: "HDC-3500",
      name: "Cámara de estudio",
      brand: "Sony",
      defaultSupplier: "Sony España",
      defaultMaintenanceIntervalDays: 180,
    },
  ],
}));

vi.mock("convex/react", async () => {
  const { getFunctionName } = await import("convex/server");
  return {
    // Las consultas se reconocen por su nombre: `api` devuelve una referencia
    // nueva en cada acceso.
    useQuery: (query: unknown) => {
      const nombre = getFunctionName(query as never);
      if (nombre === "equipmentModels:list") return CATALOGO;
      if (nombre === "equipment:list") return [];
      if (nombre === "equipment:uniqueModels") return [];
      if (nombre === "equipment:nextCode") return "EQ-004";
      return undefined;
    },
    useMutation: () => async () => {},
    useAction: () => async () => "",
  };
});

import { EquipmentFormDialog } from "@/pages/dashboard/equipment/dialogs/EquipmentFormDialog";

/**
 * La ficha de un equipo nuevo nace con los datos de la plantilla de su modelo
 * —lo que el taller ya sabe de ese modelo—, y lo que venga escrito de fuera
 * sigue mandando sobre la plantilla. Es lo que antes se copiaba a los campos
 * desde un efecto; ahora los campos se calculan al nacer, así que la prueba
 * mira lo que queda en el formulario tal cual se abre.
 */

let roots: Root[] = [];

beforeEach(() => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  // Lo que Radix y el editor dan por hecho y jsdom todavía no trae.
  Element.prototype.setPointerCapture ??= () => {};
  Element.prototype.releasePointerCapture ??= () => {};
  Element.prototype.hasPointerCapture ??= () => false;
  Range.prototype.getClientRects ??= () => [] as unknown as DOMRectList;
  Range.prototype.getBoundingClientRect ??= () => new DOMRect();
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

async function mount(node: ReactNode) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  roots.push(root);
  await act(async () => {
    root.render(<>{node}</>);
  });
  await settle();
  return container;
}

const campo = (id: string) =>
  document.querySelector<HTMLInputElement>(`#${id}`)?.value;

/** Escribe en un campo como el navegador: valor nativo y después el evento. */
async function escribir(id: string, value: string) {
  const input = document.querySelector<HTMLInputElement>(`#${id}`);
  expect(input, `no hay un campo «${id}»`).not.toBeNull();
  const setter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value",
  )?.set;
  await act(async () => {
    setter?.call(input, value);
    input!.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await settle();
}

describe("la ficha del equipo nuevo", () => {
  test("nace con la plantilla del modelo que trae la incidencia", async () => {
    await mount(
      <EquipmentFormDialog
        item={null}
        initialValues={{ model: "HDC-3500", serialNumber: "FX888D-2505" }}
        onClose={() => {}}
      />,
    );

    expect(campo("eq-name")).toBe("Cámara de estudio");
    expect(campo("eq-brand")).toBe("Sony");
    expect(campo("eq-supplier")).toBe("Sony España");
    expect(campo("eq-interval")).toBe("180");
    // Y el código libre que propone el taller se ve sin escribirlo.
    expect(campo("eq-code")).toBe("EQ-004");
    expect(campo("eq-serial")).toBe("FX888D-2505");
  });

  test("lo que ya venía escrito no lo pisa la plantilla", async () => {
    await mount(
      <EquipmentFormDialog
        item={null}
        initialValues={{
          model: "HDC-3500",
          name: "Cámara del plató 2",
          brand: "Sony",
        }}
        onClose={() => {}}
      />,
    );

    expect(campo("eq-name")).toBe("Cámara del plató 2");
    expect(campo("eq-brand")).toBe("Sony");
    // Lo que venía vacío sí se rellena con la plantilla.
    expect(campo("eq-supplier")).toBe("Sony España");
  });

  test("al escribir el modelo se aplica su plantilla", async () => {
    await mount(<EquipmentFormDialog item={null} onClose={() => {}} />);

    expect(campo("eq-name")).toBe("");
    await escribir("eq-model", "HDC-3500");

    expect(campo("eq-name")).toBe("Cámara de estudio");
    expect(campo("eq-brand")).toBe("Sony");
    expect(campo("eq-supplier")).toBe("Sony España");
  });

  test("un modelo sin plantilla deja la ficha en blanco", async () => {
    await mount(
      <EquipmentFormDialog
        item={null}
        initialValues={{ model: "SIN-PLANTILLA" }}
        onClose={() => {}}
      />,
    );

    expect(campo("eq-name")).toBe("");
    expect(campo("eq-brand")).toBe("");
    expect(campo("eq-supplier")).toBe("");
    expect(campo("eq-interval")).toBe("");
    expect(campo("eq-code")).toBe("EQ-004");
  });
});
