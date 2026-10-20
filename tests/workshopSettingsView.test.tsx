// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { settle } from "./settle";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/pages/dashboard/settings/CatalogsCard", () => ({
  CatalogsCard: () => <div data-testid="card-catalogs">CatalogsCard</div>,
}));
vi.mock("@/pages/dashboard/settings/EquipmentModelsCard", () => ({
  EquipmentModelsCard: () => (
    <div data-testid="card-equipment-models">EquipmentModelsCard</div>
  ),
}));
vi.mock("@/pages/dashboard/settings/WorkAlertSettingsCard", () => ({
  WorkAlertSettingsCard: () => (
    <div data-testid="card-work-alert">WorkAlertSettingsCard</div>
  ),
}));
vi.mock("@/pages/dashboard/settings/AuditAlertSettingsCard", () => ({
  AuditAlertSettingsCard: () => (
    <div data-testid="card-audit-alert">AuditAlertSettingsCard</div>
  ),
}));
vi.mock("@/pages/dashboard/settings/AutomaticArchiveCard", () => ({
  AutomaticArchiveCard: () => (
    <div data-testid="card-archive">AutomaticArchiveCard</div>
  ),
}));
vi.mock("@/pages/dashboard/settings/TrashCard", () => ({
  TrashCard: () => <div data-testid="card-trash">TrashCard</div>,
}));
vi.mock("@/pages/dashboard/settings/UnusedUploadsCard", () => ({
  UnusedUploadsCard: () => (
    <div data-testid="card-unused-uploads">UnusedUploadsCard</div>
  ),
}));
vi.mock("@/pages/dashboard/settings/StorageCleanupCard", () => ({
  StorageCleanupCard: () => (
    <div data-testid="card-storage-cleanup">StorageCleanupCard</div>
  ),
}));
vi.mock("@/pages/dashboard/settings/MailServerCard", () => ({
  MailServerCard: () => <div data-testid="card-mail-server">MailServerCard</div>,
}));
vi.mock("@/pages/dashboard/settings/MailAudienceCard", () => ({
  MailAudienceCard: () => (
    <div data-testid="card-mail-audience">MailAudienceCard</div>
  ),
}));
vi.mock("@/pages/dashboard/settings/WorkshopDataCard", () => ({
  WorkshopDataCard: () => (
    <div data-testid="card-workshop-data">WorkshopDataCard</div>
  ),
}));

import { WorkshopSettingsView } from "@/pages/dashboard/WorkshopSettingsView";

describe("WorkshopSettingsView — navegación por pestañas", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("muestra solo Catálogos cuando no se tienen permisos especiales", async () => {
    await act(async () => {
      root.render(<WorkshopSettingsView />);
    });
    await settle();

    const tabButtons = container.querySelectorAll("[role='tab']");
    expect(tabButtons.length).toBe(1);
    expect(tabButtons[0]?.textContent).toContain("Catálogos");

    expect(container.querySelector("[data-testid='card-catalogs']")).not.toBeNull();
    expect(container.querySelector("[data-testid='card-mail-server']")).toBeNull();
    expect(container.querySelector("[data-testid='card-archive']")).toBeNull();
    expect(container.querySelector("[data-testid='card-work-alert']")).toBeNull();
  });

  it("muestra todas las pestañas cuando se tienen todos los permisos", async () => {
    await act(async () => {
      root.render(
        <WorkshopSettingsView
          canManageArchive={true}
          canManageAlert={true}
          canManageAudit={true}
          canPurgeUploads={true}
          canManageData={true}
          canManageMail={true}
        />,
      );
    });
    await settle();

    const tabButtons = Array.from(container.querySelectorAll("[role='tab']"));
    const labels = tabButtons.map((btn) => btn.textContent?.trim());

    expect(labels).toContain("Catálogos");
    expect(labels).toContain("Avisos");
    expect(labels).toContain("Almacén y archivo");
    expect(labels).toContain("Correo");
    expect(labels).toContain("Datos del taller");
  });

  it("permite cambiar de pestaña activando su contenido", async () => {
    await act(async () => {
      root.render(
        <WorkshopSettingsView
          canManageArchive={true}
          canManageAlert={true}
          canManageAudit={true}
          canPurgeUploads={true}
          canManageData={true}
          canManageMail={true}
        />,
      );
    });
    await settle();

    // Inicialmente está en Catálogos
    expect(container.querySelector("[data-testid='card-catalogs']")).not.toBeNull();

    // Buscamos la pestaña "Correo"
    const mailTab = Array.from(container.querySelectorAll("[role='tab']")).find(
      (btn) => btn.textContent?.includes("Correo"),
    );
    expect(mailTab).toBeDefined();

    await act(async () => {
      mailTab!.dispatchEvent(
        new MouseEvent("pointerdown", { bubbles: true, cancelable: true, button: 0 }),
      );
      mailTab!.dispatchEvent(
        new MouseEvent("mousedown", { bubbles: true, cancelable: true, button: 0 }),
      );
      mailTab!.dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }),
      );
      mailTab!.focus();
      mailTab!.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
      );
    });
    await settle();

    expect(container.querySelector("[data-testid='card-mail-server']")).not.toBeNull();
    expect(container.querySelector("[data-testid='card-mail-audience']")).not.toBeNull();
  });

  it("respeta la prop defaultTab si está disponible", async () => {
    await act(async () => {
      root.render(
        <WorkshopSettingsView
          canManageMail={true}
          defaultTab="mail"
        />,
      );
    });
    await settle();

    expect(container.querySelector("[data-testid='card-mail-server']")).not.toBeNull();
  });

  it("muestra la pestaña Avisos con sus tarjetas según los permisos", async () => {
    await act(async () => {
      root.render(
        <WorkshopSettingsView
          canManageAlert={true}
          canManageAudit={false}
          defaultTab="alerts"
        />,
      );
    });
    await settle();

    expect(container.querySelector("[data-testid='card-work-alert']")).not.toBeNull();
    expect(container.querySelector("[data-testid='card-audit-alert']")).toBeNull();
  });

  it("muestra la pestaña Almacén y archivo con sus tarjetas según los permisos", async () => {
    await act(async () => {
      root.render(
        <WorkshopSettingsView
          canManageArchive={true}
          canPurgeUploads={false}
          defaultTab="storage"
        />,
      );
    });
    await settle();

    expect(container.querySelector("[data-testid='card-archive']")).not.toBeNull();
    expect(container.querySelector("[data-testid='card-trash']")).toBeNull();
  });
});
