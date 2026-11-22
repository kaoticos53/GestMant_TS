// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { settle } from "./settle";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const { mockUseMutation } = vi.hoisted(() => ({
  mockUseMutation: vi.fn(),
}));

vi.mock("convex/react", () => ({
  useMutation: mockUseMutation,
}));

import {
  MailboxFoldersCard,
  type MailboxFolderItem,
} from "@/pages/dashboard/settings/mailbox/MailboxFoldersCard";

const SAMPLE_FOLDERS: MailboxFolderItem[] = [
  {
    remoteId: "2",
    parentRemoteId: "1",
    name: "Bandeja de entrada",
    path: "/Inbox",
    kind: "inbox",
    isMail: true,
    unread: 4,
    total: 12,
    size: 100,
    sortOrder: 0,
    hidden: false,
  },
  {
    remoteId: "5",
    parentRemoteId: "1",
    name: "Enviados",
    path: "/Sent",
    kind: "sent",
    isMail: true,
    unread: 0,
    total: 5,
    size: 40,
    sortOrder: 1,
    hidden: true,
  },
];

describe("MailboxFoldersCard", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.clearAllMocks();
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

  it("muestra carpetas visibles/ocultas y dispara reorderFolders y setFolderVisibility", async () => {
    const mockSetVisibility = vi.fn().mockResolvedValue(undefined);
    const mockReorder = vi.fn().mockResolvedValue(undefined);

    let callIdx = 0;
    mockUseMutation.mockImplementation(() => {
      callIdx += 1;
      return callIdx % 2 === 1 ? mockSetVisibility : mockReorder;
    });

    await act(async () => {
      root.render(<MailboxFoldersCard folders={SAMPLE_FOLDERS} />);
      await settle();
    });

    expect(container.textContent).toContain("1 visible de 2");
    expect(container.textContent).toContain("Oculta");

    const moveDownBtn = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Bajar carpeta Bandeja de entrada"]',
    );
    expect(moveDownBtn).not.toBeNull();
    await act(async () => {
      moveDownBtn?.click();
      await settle();
    });
    expect(mockReorder).toHaveBeenCalledWith({
      orderedRemoteIds: ["5", "2"],
    });

    const showBtn = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Mostrar carpeta Enviados"]',
    );
    expect(showBtn).not.toBeNull();
    await act(async () => {
      showBtn?.click();
      await settle();
    });
    expect(mockSetVisibility).toHaveBeenCalledWith({
      remoteId: "5",
      hidden: false,
    });
  });
});
