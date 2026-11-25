import { TablePagination } from "@/components/TablePagination";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { isActiveJobStatus } from "@/lib/backgroundJobs";
import {
  type MailSortDirection,
  type MailSortField,
} from "@/lib/mailClient/listView";
import { type MailTagId } from "@/lib/mailClient/tagging";
import { pageWindow } from "@/lib/pagination";
import { cn } from "@/lib/utils";
import { getErrorMessage } from "@/lib/workshop";
import { api } from "@/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import { useEffect, useRef, useState } from "react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { toast } from "sonner";
import { MailboxSidebar, type MobilePane } from "./mailbox/components/MailboxSidebar";
import {
  MailboxAlert,
  MailboxLoading,
  MailboxWithoutAccount,
  MailboxWithoutFolders,
  MessageAreaSkeleton,
} from "./mailbox/components/MailboxStates";
import { MailboxToolbar } from "./mailbox/components/MailboxToolbar";
import { MAILBOX_PAGE_SIZE } from "./mailbox/helpers";
import { MessageList, MessageListSkeleton } from "./mailbox/MessageList";
import {
  MessageViewer,
  MessageViewerPlaceholder,
} from "./mailbox/MessageViewer";
import type { MailboxFolder, MailboxHeader } from "./mailbox/types";

interface PageState {
  /** Carpeta + búsqueda a la que pertenece la página. */
  key: string;
  page: number;
}

/**
 * El módulo «Correo»: carpetas a la izquierda y cabeceras sincronizadas a la
 * derecha. En el móvil se ve un panel cada vez para que la lista conserve el
 * ancho útil; el botón «Carpetas» vuelve al selector.
 */
export function MailboxView({
  onOpenSettings,
}: {
  onOpenSettings: () => void;
}) {
  const account = useQuery(api.mailAccounts.account);
  const folders = useQuery(api.mailAccounts.folders, {});
  const jobs = useQuery(api.backgroundJobs.listMine, {}) ?? [];
  const startSyncNow = useMutation(api.mailSync.startSyncNow);
  const startAutoTagFolder = useMutation(api.mailTagging.startAutoTagFolder);

  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [tagFilter, setTagFilter] = useState<MailTagId | "all">("all");
  const [sortBy, setSortBy] = useState<MailSortField>("date");
  const [sortDir, setSortDir] = useState<MailSortDirection>("desc");
  const [groupByConversation, setGroupByConversation] = useState(false);
  const [mobilePane, setMobilePane] = useState<MobilePane>("messages");
  const [selectedMessage, setSelectedMessage] = useState<MailboxHeader | null>(
    null,
  );
  const [startingSync, setStartingSync] = useState(false);
  const [startingTag, setStartingTag] = useState(false);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const activeSyncJob = jobs.find(
    (j) => j.type === "mail_sync" && isActiveJobStatus(j.status),
  );
  const activeTagJob = jobs.find(
    (j) => j.type === "mail_auto_tag" && isActiveJobStatus(j.status),
  );
  const syncing = startingSync || Boolean(activeSyncJob);
  const tagging = startingTag || Boolean(activeTagJob);
  const taggingCount = activeTagJob?.processed ?? 0;
  const [pageState, setPageState] = useState<PageState>({
    key: "",
    page: 1,
  });

  useEffect(() => {
    const next = search.trim();
    const timer = window.setTimeout(
      () => {
        setDebouncedSearch(next);
      },
      next ? 200 : 0,
    );
    return () => window.clearTimeout(timer);
  }, [search]);

  const effectiveSearch = search.trim() ? debouncedSearch : "";

  const activeFolder =
    folders?.find((folder) => folder.remoteId === selectedFolderId) ??
    folders?.[0] ??
    null;
  const activeFolderId = activeFolder?.remoteId ?? null;
  const pageKey = `${activeFolderId ?? "sin-carpeta"}|${effectiveSearch}|${tagFilter}|${sortBy}|${sortDir}|${groupByConversation}`;

  // Al cambiar de carpeta o de búsqueda se vuelve a la primera página en el
  // mismo render. Así la consulta siguiente ya pide `offset: 0` y no llega a
  // verse un instante la página de la lista anterior.
  let page = pageState.page;
  if (pageState.key !== pageKey) {
    page = 1;
    setPageState({ key: pageKey, page: 1 });
  }

  const headersResult = useQuery(
    api.mailHeaders.list,
    activeFolderId
      ? {
          folderRemoteId: activeFolderId,
          search: effectiveSearch || undefined,
          tag: tagFilter === "all" ? undefined : tagFilter,
          sortBy,
          sortDir,
          groupByConversation,
          limit: MAILBOX_PAGE_SIZE,
          offset: (page - 1) * MAILBOX_PAGE_SIZE,
        }
      : "skip",
  );
  const paging = pageWindow(headersResult?.total ?? 0, page, MAILBOX_PAGE_SIZE);

  // El total puede encoger entre dos pasadas —una sincronización, un borrado—.
  // Si la página ya no existe, se corrige en el mismo render: la siguiente
  // consulta pide el offset de la última página válida, no uno vacío.
  const pageOutOfRange = headersResult !== undefined && paging.page !== page;
  if (pageOutOfRange) {
    page = paging.page;
    setPageState({ key: pageKey, page });
  }

  const handlePageChange = (nextPage: number) => {
    setSelectedMessage(null);
    setPageState({ key: pageKey, page: nextPage });
  };

  const handleSelectFolder = (folder: MailboxFolder) => {
    setSelectedFolderId(folder.remoteId);
    setSearch("");
    setSelectedMessage(null);
    setMobilePane("messages");
  };

  const handleSelectMessage = (header: MailboxHeader) => {
    setSelectedMessage(header);
    setMobilePane("message");
  };

  const handleCloseMessage = () => {
    setSelectedMessage(null);
    setMobilePane("messages");
  };

  const handleAutoTag = async () => {
    if (!activeFolderId) return;
    setStartingTag(true);
    try {
      const res = await startAutoTagFolder({ folderRemoteId: activeFolderId });
      toast.info(
        res.reused
          ? "Ya hay un autoetiquetado en curso en segundo plano."
          : "Autoetiquetado iniciado en segundo plano. Puedes cambiar de menú sin perder el progreso.",
      );
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setStartingTag(false);
    }
  };

  const handleSync = async () => {
    setStartingSync(true);
    try {
      const res = await startSyncNow({});
      toast.info(
        res.reused
          ? "Ya hay una sincronización en curso en segundo plano."
          : "Sincronización iniciada en segundo plano.",
      );
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setStartingSync(false);
    }
  };

  const visibleHeaders = headersResult?.headers ?? [];

  useKeyboardShortcuts({
    active: Boolean(account && activeFolder),
    shortcuts: [
      {
        key: "/",
        onTrigger: () => {
          searchInputRef.current?.focus();
        },
      },
      {
        key: "j",
        onTrigger: () => {
          if (visibleHeaders.length === 0) return;
          const idx = selectedMessage
            ? visibleHeaders.findIndex(
                (h) => h.messageId === selectedMessage.messageId,
              )
            : -1;
          const nextIdx =
            idx < 0 ? 0 : Math.min(idx + 1, visibleHeaders.length - 1);
          handleSelectMessage(visibleHeaders[nextIdx]);
        },
      },
      {
        key: "k",
        onTrigger: () => {
          if (visibleHeaders.length === 0) return;
          const idx = selectedMessage
            ? visibleHeaders.findIndex(
                (h) => h.messageId === selectedMessage.messageId,
              )
            : -1;
          const prevIdx = idx < 0 ? 0 : Math.max(idx - 1, 0);
          handleSelectMessage(visibleHeaders[prevIdx]);
        },
      },
      {
        key: "Escape",
        allowInEditable: true,
        onTrigger: () => {
          if (selectedMessage) {
            handleCloseMessage();
            return;
          }
          if (document.activeElement === searchInputRef.current) {
            if (search !== "") {
              setSearch("");
            } else {
              searchInputRef.current?.blur();
            }
          }
        },
      },
    ],
  });

  if (account === undefined) {
    return <MailboxLoading />;
  }

  if (account === null) {
    return <MailboxWithoutAccount onOpenSettings={onOpenSettings} />;
  }

  const activeSelectedMessage = selectedMessage
    ? (headersResult?.headers.find(
        (h) => h.messageId === selectedMessage.messageId,
      ) ?? selectedMessage)
    : null;

  return (
    <div className="flex min-h-[32rem] flex-col overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm lg:h-[calc(100dvh_-_17rem)] lg:max-h-[calc(100dvh_-_11rem)] lg:min-h-[24rem] lg:flex-row">
      <MailboxSidebar
        account={account}
        folders={folders}
        activeFolderId={activeFolderId}
        mobilePane={mobilePane}
        syncing={syncing}
        onSelectFolder={handleSelectFolder}
        onSync={() => void handleSync()}
        onOpenSettings={onOpenSettings}
      />

      <PanelGroup
        direction="horizontal"
        className={cn(
          "min-h-0 min-w-0 flex-1",
          mobilePane === "folders" ? "hidden lg:flex" : "flex",
        )}
      >
        <Panel
          defaultSize={52}
          minSize={30}
          className={cn(
            "min-w-0 flex-col",
            mobilePane === "messages" ? "flex" : "hidden lg:flex",
          )}
        >
          <section className="flex min-h-0 min-w-0 flex-1 flex-col">
            {activeFolder === null ? (
              folders === undefined ? (
                <MessageAreaSkeleton />
              ) : (
                <MailboxWithoutFolders
                  syncing={syncing}
                  onSync={() => void handleSync()}
                />
              )
            ) : (
              <>
                <MailboxToolbar
                  activeFolder={activeFolder}
                  total={headersResult?.total ?? 0}
                  unread={headersResult?.unread ?? 0}
                  loadingHeaders={headersResult === undefined}
                  sortBy={sortBy}
                  onSortByChange={setSortBy}
                  sortDir={sortDir}
                  onToggleSortDir={() =>
                    setSortDir((prev) => (prev === "desc" ? "asc" : "desc"))
                  }
                  groupByConversation={groupByConversation}
                  onToggleGroupByConversation={() =>
                    setGroupByConversation((prev) => !prev)
                  }
                  tagging={tagging}
                  taggingCount={taggingCount}
                  onAutoTag={() => void handleAutoTag()}
                  search={search}
                  onSearchChange={(value) => {
                    setSearch(value);
                    setSelectedMessage(null);
                  }}
                  searchInputRef={searchInputRef}
                  syncing={syncing}
                  onSync={() => void handleSync()}
                  tagFilter={tagFilter}
                  onTagFilterChange={setTagFilter}
                  onBackToFolders={() => setMobilePane("folders")}
                />

                <MailboxAlert
                  account={account}
                  syncing={syncing}
                  onSync={() => void handleSync()}
                  onOpenSettings={onOpenSettings}
                />

                {headersResult === undefined || pageOutOfRange ? (
                  <MessageListSkeleton />
                ) : (
                  <MessageList
                    headers={headersResult.headers}
                    folderName={activeFolder.name}
                    folderRemoteId={activeFolder.remoteId}
                    page={page}
                    search={search}
                    syncing={syncing}
                    selectedMessageId={selectedMessage?.messageId ?? null}
                    onSelectMessage={handleSelectMessage}
                    onSync={() => void handleSync()}
                    onClearSearch={() => {
                      setSearch("");
                      setSelectedMessage(null);
                    }}
                  />
                )}
                {headersResult !== undefined && !pageOutOfRange && (
                  <TablePagination
                    paging={{ ...paging, setPage: handlePageChange }}
                    singular="mensaje"
                    plural="mensajes"
                    detail={
                      search.trim() === ""
                        ? activeFolder.name
                        : `con la búsqueda «${search.trim()}»`
                    }
                  />
                )}
              </>
            )}
          </section>
        </Panel>

        <PanelResizeHandle className="hidden w-1 shrink-0 bg-border/70 transition-colors hover:bg-signal/40 lg:block" />

        <Panel
          defaultSize={48}
          minSize={28}
          className={cn(
            "min-w-0 flex-col",
            mobilePane === "message" ? "flex" : "hidden lg:flex",
          )}
        >
          {activeSelectedMessage ? (
            <MessageViewer
              key={activeSelectedMessage.messageId}
              header={activeSelectedMessage}
              folderName={activeFolder?.name ?? "Correo"}
              onSelectMessage={handleSelectMessage}
              onClose={handleCloseMessage}
              onOpenSettings={onOpenSettings}
            />
          ) : (
            <MessageViewerPlaceholder />
          )}
        </Panel>
      </PanelGroup>
    </div>
  );
}
