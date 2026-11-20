// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DetailTitleButton } from "@/components/DetailTitleButton";
import { ArchiveEntryCard } from "@/pages/dashboard/archive/components/list/ArchiveEntryCard";
import { RequestCardBody } from "@/pages/dashboard/requests/components/card/RequestCardBody";
import { settle } from "./settle";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("DetailTitleButton y títulos clicables (Fase 1)", () => {
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

  it("ejecuta onClick al pulsar DetailTitleButton", async () => {
    const onClick = vi.fn();
    await act(async () => {
      root.render(
        <DetailTitleButton onClick={onClick}>Compresor Atlas</DetailTitleButton>,
      );
      await settle();
    });

    const btn = container.querySelector("button");
    expect(btn?.textContent).toBe("Compresor Atlas");
    await act(async () => {
      btn?.click();
      await settle();
    });
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("abre el detalle al pulsar el título en ArchiveEntryCard", async () => {
    const onOpenEntry = vi.fn();
    await act(async () => {
      root.render(
        <ArchiveEntryCard
          entry={{
            kind: "incident",
            id: "inc_1" as never,
            reference: "INC-2026-001",
            title: "Fuga en bomba hidráulica",
            subtitle: "Revisar junta",
            statusLabel: "Cerrada",
            statusClassName: "",
            date: Date.now(),
            archivedBy: "Admin",
          }}
          compact={false}
          canRestore={false}
          busy={false}
          onOpenEntry={onOpenEntry}
          onRestore={vi.fn()}
        />,
      );
      await settle();
    });

    const titleBtn = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Fuga en bomba hidráulica"),
    );
    expect(titleBtn).toBeDefined();
    await act(async () => {
      titleBtn?.click();
      await settle();
    });
    expect(onOpenEntry).toHaveBeenCalledWith({ kind: "incident", id: "inc_1" });
  });

  it("abre el detalle al pulsar el título en RequestCardBody", async () => {
    const onOpen = vi.fn();
    await act(async () => {
      root.render(
        <RequestCardBody
          requesterName="Carlos Técnico"
          requesterTeam="Turno M"
          equipment="Torno CNC"
          status="pending"
          decisionText="Pendiente"
          compact={false}
          onOpen={onOpen}
        />,
      );
      await settle();
    });

    const titleBtn = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Carlos Técnico"),
    );
    expect(titleBtn).toBeDefined();
    await act(async () => {
      titleBtn?.click();
      await settle();
    });
    expect(onOpen).toHaveBeenCalledTimes(1);
  });
});
