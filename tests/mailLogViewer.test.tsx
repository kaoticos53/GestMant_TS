// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { settle } from "./settle";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

const { mockRetryOne, mockRetryAllFailed, mockDiscard } = vi.hoisted(() => ({
  mockRetryOne: vi.fn(),
  mockRetryAllFailed: vi.fn(),
  mockDiscard: vi.fn(),
}));

vi.mock("@/convex/_generated/api", () => ({
  api: {
    mailOutbox: {
      retryOne: { name: "mailOutbox.retryOne" },
      retryAllFailed: { name: "mailOutbox.retryAllFailed" },
      discard: { name: "mailOutbox.discard" },
    },
  },
}));

vi.mock("convex/react", async () => {
  const { api } = await import("@/convex/_generated/api");
  return {
    useMutation: (ref: unknown) => {
      if (ref === api.mailOutbox.retryOne) return mockRetryOne;
      if (ref === api.mailOutbox.retryAllFailed) return mockRetryAllFailed;
      if (ref === api.mailOutbox.discard) return mockDiscard;
      return vi.fn();
    },
  };
});

import {
  MailLogViewer,
  type MailOutboxEntry,
} from "@/pages/dashboard/settings/mail/components/MailLogViewer";

describe("MailLogViewer (Fase 3)", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRetryOne.mockResolvedValue(undefined);
    mockRetryAllFailed.mockResolvedValue({ scheduled: 2 });
    mockDiscard.mockResolvedValue(undefined);
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

  it("muestra la cola de fallidos y permite reintentar o descartar", async () => {
    const outbox: MailOutboxEntry[] = [
      {
        _id: "out_1" as never,
        origin: "incidencia",
        what: "el aviso a quien notificó",
        to: ["usuario@empresa.es"],
        subject: "INC-001",
        status: "failed",
        attempts: 4,
        maxAttempts: 4,
        lastError: "HTTP 503 Service Unavailable",
        lastAttemptAt: Date.now(),
        createdAt: Date.now(),
      },
      {
        _id: "out_2" as never,
        origin: "equipo",
        what: "el aviso al equipo",
        to: ["taller@empresa.es"],
        subject: "INC-002",
        status: "failed",
        attempts: 1,
        maxAttempts: 4,
        lastError: "Correo apagado",
        lastAttemptAt: Date.now(),
        createdAt: Date.now(),
      },
    ];

    await act(async () => {
      root.render(<MailLogViewer history={[]} outbox={outbox} />);
      await settle();
    });

    const text = document.body.textContent ?? "";
    expect(text).toContain("Cola de reintentos y fallidos (2)");
    expect(text).toContain("INC-001");
    expect(text).toContain("HTTP 503 Service Unavailable");

    const retryAllBtn = Array.from(document.body.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("Reintentar todos"),
    );
    expect(retryAllBtn).toBeDefined();
    await act(async () => {
      retryAllBtn?.click();
      await settle();
    });
    expect(mockRetryAllFailed).toHaveBeenCalledTimes(1);

    const retryOneBtn = Array.from(document.body.querySelectorAll("button")).find(
      (b) => b.textContent?.trim() === "Reintentar",
    );
    await act(async () => {
      retryOneBtn?.click();
      await settle();
    });
    expect(mockRetryOne).toHaveBeenCalledWith({ outboxId: "out_1" });

    const discardBtn = Array.from(document.body.querySelectorAll("button")).find(
      (b) => b.textContent?.trim() === "Descartar",
    );
    await act(async () => {
      discardBtn?.click();
      await settle();
    });
    expect(mockDiscard).toHaveBeenCalledWith({ outboxId: "out_1" });
  });
});
