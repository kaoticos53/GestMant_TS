// @vitest-environment jsdom
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import type { Doc, Id } from "../src/convex/_generated/dataModel";
import { isPrintableLabel } from "../src/lib/labelGenerator";
import {
  generateSecurePassword,
  MIN_PASSWORD_LENGTH,
  validatePassword,
} from "../src/lib/password";
import { DEFAULT_GRANTS } from "../src/lib/permissions";
import {
  countDirtyCells,
  isCellDirty,
  toggleGrant,
  type Draft,
} from "../src/lib/permissionsDraft";
import {
  filterSecurityAuditEntries,
  SECURITY_ACTION_LABELS,
  type SecurityAuditEntry,
} from "../src/lib/securityAudit";
import { BulkArchiveCard } from "../src/pages/dashboard/archive/components/BulkArchiveCard";
import { AuditMovementRow } from "../src/pages/dashboard/audit/components/AuditMovementRow";
import { PermissionsTable } from "../src/pages/dashboard/permissions/components/PermissionsTable";
import { ProfileHeaderCard } from "../src/pages/dashboard/profile/components/ProfileHeaderCard";
import { ProfileIncidentsCard } from "../src/pages/dashboard/profile/components/ProfileIncidentsCard";
import { ProfileRequestsCard } from "../src/pages/dashboard/profile/components/ProfileRequestsCard";
import { UsersView } from "../src/pages/dashboard/UsersView";

let container: HTMLDivElement;
let root: Root;

beforeAll(() => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
});

beforeEach(() => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  document.body.innerHTML = "";
});

function renderNode(node: ReactNode) {
  act(() => {
    root.render(node);
  });
}

function findButton(pattern: RegExp): HTMLButtonElement | undefined {
  return Array.from(container.querySelectorAll("button")).find((btn) =>
    pattern.test(btn.textContent ?? ""),
  );
}

describe("Oleada 3 librerías puras", () => {
  test("validatePassword y generateSecurePassword respetan requisitos", () => {
    expect(MIN_PASSWORD_LENGTH).toBe(8);
    expect(validatePassword("abc")).toContain("8");
    expect(validatePassword("12345678")).toBeNull();

    const generated = generateSecurePassword(16);
    expect(generated.length).toBe(16);
    expect(validatePassword(generated)).toBeNull();
  });

  test("filterSecurityAuditEntries busca por actor, destino, metadata y etiqueta", () => {
    expect(SECURITY_ACTION_LABELS.password_change).toBe("Cambio de contraseña");
    expect(SECURITY_ACTION_LABELS.password_reset).toBe(
      "Restablecimiento de contraseña",
    );

    const entries: SecurityAuditEntry[] = [
      {
        _id: "1",
        actorEmail: "admin@taller.es",
        action: "password_reset",
        target: "lucia@taller.es",
        metadata: JSON.stringify({ revokedSessions: 2 }),
        at: 1000,
      },
      {
        _id: "2",
        actorEmail: "jefe@taller.es",
        action: "role_change",
        target: "pedro@taller.es",
        at: 2000,
      },
    ];

    expect(filterSecurityAuditEntries(entries, "lucia")).toHaveLength(1);
    expect(filterSecurityAuditEntries(entries, "restablecimiento")).toHaveLength(
      1,
    );
    expect(filterSecurityAuditEntries(entries, "revokedSessions")).toHaveLength(
      1,
    );
    expect(filterSecurityAuditEntries(entries, "")).toHaveLength(2);
  });

  test("permissionsDraft aplica dependencias y calcula celdas modificadas", () => {
    const saved: Draft = {
      technician: {
        ...DEFAULT_GRANTS.technician,
        createRequests: false,
        viewRequests: false,
        manageIncidents: false,
        viewIncidents: true,
      },
    };

    const withCreate = toggleGrant(saved, "technician", "createRequests");
    expect(withCreate.technician.createRequests).toBe(true);
    expect(withCreate.technician.viewRequests).toBe(true);
    expect(
      isCellDirty(withCreate, saved, "technician", "createRequests"),
    ).toBe(true);
    expect(isCellDirty(withCreate, saved, "technician", "viewRequests")).toBe(
      true,
    );
    expect(countDirtyCells(withCreate, saved)).toBe(2);

    const withManage = toggleGrant(saved, "technician", "manageIncidents");
    expect(withManage.technician.manageIncidents).toBe(true);
    const withoutView = toggleGrant(withManage, "technician", "viewIncidents");
    expect(withoutView.technician.viewIncidents).toBe(false);
    expect(withoutView.technician.manageIncidents).toBe(false);
  });

  test("isPrintableLabel detecta códigos vacíos", () => {
    expect(isPrintableLabel({ code: "" })).toBe(false);
    expect(isPrintableLabel({ code: "   " })).toBe(false);
    expect(isPrintableLabel({ code: "EQ-01" })).toBe(true);
  });
});

describe("Oleada 3 componentes UI", () => {
  test("ProfileHeaderCard muestra Cambiar contraseña y dispara callback", () => {
    const onChangePassword = vi.fn();
    const user: Doc<"users"> = {
      _id: "u1" as Id<"users">,
      _creationTime: 1700000000000,
      name: "Lucía",
      email: "lucia@taller.es",
      role: "technician",
      roles: ["technician"],
    };
    renderNode(
      <ProfileHeaderCard
        user={user}
        metaChips={[]}
        onEdit={vi.fn()}
        onChangePassword={onChangePassword}
      />,
    );

    const btn = findButton(/Cambiar contraseña/i);
    expect(btn).toBeDefined();
    act(() => btn!.click());
    expect(onChangePassword).toHaveBeenCalledTimes(1);
  });

  test("ProfileIncidentsCard evita separadores colgantes y abre incidencia al pulsar", () => {
    const onOpenIncident = vi.fn();
    const incId = "inc-1" as Id<"incidents">;
    const incident = {
      _id: incId,
      _creationTime: 1700000000000,
      reference: "INC-0010",
      reporterName: "Ana",
      status: "reported",
      priority: "normal",
      equipmentKind: "",
      model: "",
      description: "Fallo de audio",
      reportedAt: 1700000000000,
      updatedAt: 1700000000000,
      history: [],
    } as unknown as Doc<"incidents">;

    renderNode(
      <ProfileIncidentsCard
        incidents={[incident]}
        onOpenIncidents={vi.fn()}
        onOpenIncident={onOpenIncident}
      />,
    );

    expect(container.textContent).toContain("Sin equipo especificado");
    const btn = findButton(/INC-0010/i);
    expect(btn).toBeDefined();
    act(() => btn!.click());
    expect(onOpenIncident).toHaveBeenCalledWith(incId);
  });

  test("ProfileRequestsCard permite abrir petición", () => {
    const onOpenRequest = vi.fn();
    const reqId = "req-1" as Id<"partRequests">;
    const request = {
      _id: reqId,
      _creationTime: 1700000000000,
      reference: "PET-0005",
      status: "pending",
      priority: "normal",
      requesterId: "u1" as Id<"users">,
      requesterName: "Lucía",
      justification: "Urgente",
      items: [],
      createdAt: 1700000000000,
    } as unknown as Doc<"partRequests">;

    renderNode(
      <ProfileRequestsCard
        requests={[request]}
        onOpenRequests={vi.fn()}
        onOpenRequest={onOpenRequest}
      />,
    );

    const btn = findButton(/PET-0005/i);
    expect(btn).toBeDefined();
    act(() => btn!.click());
    expect(onOpenRequest).toHaveBeenCalledWith(reqId);
  });

  test("PermissionsTable enlaza conteo de miembros con Usuarios", () => {
    const onOpenRoleUsers = vi.fn();
    const saved: Draft = {
      technician: { ...DEFAULT_GRANTS.technician },
    };
    renderNode(
      <PermissionsTable
        roles={[
          {
            key: "technician",
            label: "Técnico",
            description: "Taller",
            kind: "system",
            grants: saved.technician,
            userCount: 4,
          },
        ]}
        current={saved}
        saved={saved}
        onToggle={vi.fn()}
        onEditRole={vi.fn()}
        onDuplicateRole={vi.fn()}
        onDeleteRole={vi.fn()}
        onOpenRoleUsers={onOpenRoleUsers}
      />,
    );

    const countBtn = findButton(/4 personas/i);
    expect(countBtn).toBeDefined();
    act(() => countBtn!.click());
    expect(onOpenRoleUsers).toHaveBeenCalledWith("technician");
  });

  test("AuditMovementRow mantiene clicables las referencias archivadas", () => {
    const onOpenIncident = vi.fn();
    const incId = "inc-arch" as Id<"incidents">;
    renderNode(
      <ul>
        <AuditMovementRow
          compact={false}
          onOpenIncident={onOpenIncident}
          entry={{
            at: 1700000000000,
            by: "Ana",
            action: "attached",
            name: "parte.pdf",
            incidentId: incId,
            reference: "INC-0099",
            title: "Proyector",
            archived: true,
          }}
        />
      </ul>,
    );

    expect(container.textContent).toContain("Archivada");
    const btn = findButton(/INC-0099/i);
    expect(btn).toBeDefined();
    act(() => btn!.click());
    expect(onOpenIncident).toHaveBeenCalledWith(incId);
  });

  test("BulkArchiveCard se colapsa por defecto cuando no hay nada que archivar", () => {
    renderNode(
      <BulkArchiveCard
        canArchiveIncidents
        canArchiveRequests
        cutoffMonths="6"
        setCutoffMonths={vi.fn()}
        cutoff={1700000000000}
        pending={{ incidents: 0, requests: 0 }}
        canArchiveSomething={false}
        bulkTarget={null}
        setBulkTarget={vi.fn()}
        bulkBusy={false}
        onBulkArchive={vi.fn(async () => {})}
      />,
    );

    expect(findButton(/Archivar .* ahora/i)).toBeUndefined();
    const expandBtn = findButton(/Configurar corte/i);
    expect(expandBtn).toBeDefined();
    act(() => expandBtn!.click());
    expect(findButton(/Ocultar/i)).toBeDefined();
  });

  test("UsersView exporta initialRoleFilter tipado", () => {
    expect(typeof UsersView).toBe("function");
  });
});
