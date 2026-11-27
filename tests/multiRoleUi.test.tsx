// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest";

const { SET_ROLES_CALLS, UPDATE_USER_CALLS } = vi.hoisted(() => ({
  SET_ROLES_CALLS: [] as unknown[],
  UPDATE_USER_CALLS: [] as unknown[],
}));

vi.mock("@/convex/_generated/api", () => ({
  api: {
    members: {
      updateUser: { nombre: "members.updateUser" },
      setRoles: { nombre: "members.setRoles" },
    },
    catalogs: {
      list: { nombre: "catalogs.list" },
      ensureItem: { nombre: "catalogs.ensureItem" },
    },
  },
}));

vi.mock("convex/react", async () => {
  const { api } = await import("@/convex/_generated/api");
  return {
    useQuery: () => [],
    useMutation: (mutation: unknown) => async (args: unknown) => {
      if (mutation === api.members.setRoles) {
        SET_ROLES_CALLS.push(args);
        return undefined;
      }
      if (mutation === api.members.updateUser) {
        UPDATE_USER_CALLS.push(args);
        return true;
      }
      return undefined;
    },
  };
});

import type { Id } from "@/convex/_generated/dataModel";
import {
  RolesChecklist,
  UserRolesPopover,
} from "@/pages/dashboard/users/components/RolesMultiSelect";
import { EditUserDialog } from "@/pages/dashboard/users/dialogs/EditUserDialog";
import type { Member, RoleOption } from "@/pages/dashboard/users/types";

function installDomApis() {
  if (!("ResizeObserver" in window)) {
    (window as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
  const proto = Element.prototype as unknown as Record<string, unknown>;
  proto.hasPointerCapture ??= () => false;
  proto.setPointerCapture ??= () => {};
  proto.releasePointerCapture ??= () => {};
  proto.scrollIntoView ??= () => {};
}

let container: HTMLDivElement;
let root: Root;

beforeAll(() => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
});

beforeEach(() => {
  installDomApis();
  SET_ROLES_CALLS.length = 0;
  UPDATE_USER_CALLS.length = 0;
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  document.body.innerHTML = "";
});

const ROLE_OPTIONS: RoleOption[] = [
  { key: "admin", label: "Administrador" },
  { key: "manager", label: "Responsable de repuestos" },
  { key: "technician", label: "Técnico" },
  { key: "almacen", label: "Auxiliar de almacén" },
];

const SAMPLE_MEMBER: Member = {
  _id: "user-2" as Id<"users">,
  name: "Lucía Taller",
  email: "lucia@taller.es",
  role: "technician",
  roles: ["technician"],
  position: "Técnica AV",
  location: "Plató 1",
  phone: null,
  active: true,
  isAnonymous: false,
};

describe("gestión de múltiples roles en UI", () => {
  test("RolesChecklist permite marcar varios roles e impide desmarcar el último", () => {
    const onChange = vi.fn();
    act(() => {
      root.render(
        <RolesChecklist
          roleOptions={ROLE_OPTIONS}
          selectedRoles={["technician"]}
          onChange={onChange}
          idPrefix="test-role"
        />,
      );
    });

    const techBox = document.querySelector("#test-role-technician") as HTMLButtonElement;
    const managerBox = document.querySelector("#test-role-manager") as HTMLButtonElement;
    expect(techBox.disabled).toBe(true);
    expect(managerBox.disabled).toBe(false);

    act(() => {
      managerBox.click();
    });
    expect(onChange).toHaveBeenCalledWith(["technician", "manager"]);
  });

  test("UserRolesPopover guarda varios roles seleccionados en una sola llamada", async () => {
    const onSaveRoles = vi.fn(async () => {});
    act(() => {
      root.render(
        <UserRolesPopover
          memberRoles={["technician"]}
          roleOptions={ROLE_OPTIONS}
          memberName="lucia@taller.es"
          onSaveRoles={onSaveRoles}
        />,
      );
    });

    const trigger = document.querySelector(
      'button[aria-label="Cambiar roles de lucia@taller.es"]',
    ) as HTMLButtonElement;
    act(() => {
      trigger.click();
    });

    const almacenCheckbox = document.querySelector(
      "#row-luciatalleres-almacen",
    ) as HTMLButtonElement;
    expect(almacenCheckbox).not.toBeNull();
    act(() => {
      almacenCheckbox.click();
    });

    const saveBtn = Array.from(document.querySelectorAll("button")).find((btn) =>
      btn.textContent?.includes("Guardar roles"),
    ) as HTMLButtonElement;
    await act(async () => {
      saveBtn.click();
    });

    expect(onSaveRoles).toHaveBeenCalledWith(["technician", "almacen"]);
  });

  test("EditUserDialog envía setRoles con los múltiples roles marcados", async () => {
    const onClose = vi.fn();
    act(() => {
      root.render(
        <EditUserDialog
          member={SAMPLE_MEMBER}
          roleOptions={ROLE_OPTIONS}
          onClose={onClose}
        />,
      );
    });

    const managerCheckbox = document.querySelector(
      "#edit-user-role-manager",
    ) as HTMLButtonElement;
    act(() => {
      managerCheckbox.click();
    });

    const form = document.querySelector("form") as HTMLFormElement;
    await act(async () => {
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });

    expect(UPDATE_USER_CALLS).toHaveLength(1);
    expect(SET_ROLES_CALLS).toEqual([
      { userId: "user-2", roles: ["technician", "manager"] },
    ]);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
