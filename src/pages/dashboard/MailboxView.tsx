import { TablePagination } from "@/components/TablePagination";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/convex/_generated/api";
import {
  MAIL_SORT_LABELS,
  type MailSortDirection,
  type MailSortField,
} from "@/lib/mailClient/listView";
import {
  MAIL_TAG_IDS,
  MAIL_TAG_META,
  type MailTagId,
} from "@/lib/mailClient/tagging";
import { pageWindow } from "@/lib/pagination";
import { cn } from "@/lib/utils";
import { isActiveJobStatus } from "@/lib/backgroundJobs";
import { formatDateTime, getErrorMessage } from "@/lib/workshop";
import { useMutation, useQuery } from "convex/react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import {
  AlertTriangle,
  Archive,
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  FileText,
  Folder,
  Inbox,
  Loader2,
  Mail,
  Mailbox,
  MessagesSquare,
  RefreshCw,
  Search,
  Send,
  Settings2,
  ShieldAlert,
  Sparkles,
  Trash2,
  WifiOff,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { countLabel, MAILBOX_PAGE_SIZE } from "./mailbox/helpers";
import { MessageList, MessageListSkeleton } from "./mailbox/MessageList";
import {
  MessageViewer,
  MessageViewerPlaceholder,
} from "./mailbox/MessageViewer";
import type {
  MailboxAccount,
  MailboxFolder,
  MailboxHeader,
} from "./mailbox/types";

type MobilePane = "folders" | "messages" | "message";

interface PageState {
  /** Carpeta + búsqueda a la que pertenece la página. */
  key: string;
  page: number;
}

function folderIcon(kind: string | null) {
  switch (kind) {
    case "inbox":
      return Inbox;
    case "sent":
      return Send;
    case "drafts":
      return FileText;
    case "trash":
      return Trash2;
    case "junk":
      return Archive;
    default:
      return Folder;
  }
}

/**
 * El módulo «Correo»: carpetas a la izquierda y cabeceras sincronizadas a la
 * derecha. En el móvil se ve un panel cada vez para que la lista conserve el
 * ancho útil; el botón «Carpetas» vuelve al selector.
 *
 * F3 no descarga cuerpos ni inventa un visor: la fila muestra lo que ya está en
 * `mailHeaders`, y el contenido del mensaje llegará con su propia fase.
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
  const [mobilePane, setMobilePane] = useState<MobilePane>("folders");
  const [selectedMessage, setSelectedMessage] = useState<MailboxHeader | null>(
    null,
  );
  const [startingSync, setStartingSync] = useState(false);
  const [startingTag, setStartingTag] = useState(false);

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

  if (account === undefined) {
    return <MailboxLoading />;
  }

  if (account === null) {
    return <MailboxWithoutAccount onOpenSettings={onOpenSettings} />;
  }

  return (
    <div className="flex min-h-[32rem] flex-col overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm lg:h-[calc(100dvh_-_20rem)] lg:min-h-[30rem] lg:flex-row">
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
                <div className="flex flex-wrap items-center gap-2 border-b border-border/70 px-3 py-2.5 sm:px-4">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="gap-1 lg:hidden"
                    onClick={() => setMobilePane("folders")}
                  >
                    <ChevronLeft className="size-4" />
                    Carpetas
                  </Button>
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate text-sm font-semibold">
                      {activeFolder.name}
                    </h2>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {headersResult === undefined
                        ? "Cargando mensajes..."
                        : headersResult.total === 0
                          ? "Sin mensajes"
                          : `${countLabel(
                              headersResult.total,
                              "mensaje",
                              "mensajes",
                            )}${
                              headersResult.unread > 0
                                ? ` · ${countLabel(
                                    headersResult.unread,
                                    "sin leer",
                                    "sin leer",
                                  )}`
                                : ""
                            }`}
                    </p>
                  </div>
                  <div className="flex w-full flex-wrap items-center gap-1.5 sm:w-auto">
                    <Select
                      value={sortBy}
                      onValueChange={(value) => setSortBy(value as MailSortField)}
                    >
                      <SelectTrigger
                        className="h-9 w-[135px] text-xs"
                        aria-label="Ordenar mensajes por"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.keys(MAIL_SORT_LABELS) as MailSortField[]).map(
                          (field) => (
                            <SelectItem key={field} value={field}>
                              {MAIL_SORT_LABELS[field]}
                            </SelectItem>
                          ),
                        )}
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="size-9 shrink-0"
                      aria-label={
                        sortDir === "desc"
                          ? "Cambiar a orden ascendente"
                          : "Cambiar a orden descendente"
                      }
                      title={
                        sortDir === "desc"
                          ? "Orden descendente (clic para ascendente)"
                          : "Orden ascendente (clic para descendente)"
                      }
                      onClick={() =>
                        setSortDir((prev) => (prev === "desc" ? "asc" : "desc"))
                      }
                    >
                      {sortDir === "desc" ? (
                        <ArrowDown className="size-3.5" />
                      ) : (
                        <ArrowUp className="size-3.5" />
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant={groupByConversation ? "secondary" : "outline"}
                      size="sm"
                      aria-pressed={groupByConversation}
                      className="h-9 shrink-0 gap-1.5 text-xs"
                      onClick={() => setGroupByConversation((prev) => !prev)}
                      title="Agrupar o desagrupar mensajes por conversación"
                    >
                      <MessagesSquare className="size-3.5" />
                      <span className="hidden md:inline">Conversaciones</span>
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-9 shrink-0 gap-1.5 text-xs"
                      disabled={tagging}
                      onClick={() => void handleAutoTag()}
                      title="Clasificar correos sin etiqueta usando reglas rápidas y DeepSeek"
                    >
                      {tagging ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Sparkles className="size-3.5" />
                      )}
                      <span className="hidden sm:inline">
                        {tagging
                          ? taggingCount > 0
                            ? `Etiquetando (${taggingCount})...`
                            : "Etiquetando..."
                          : "Autoetiquetar"}
                      </span>
                    </Button>
                    <div className="relative min-w-0 flex-1 sm:w-56 sm:flex-none">
                      <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        value={search}
                        onChange={(event) => {
                          setSearch(event.target.value);
                          setSelectedMessage(null);
                        }}
                        placeholder="Buscar asunto o remitente"
                        aria-label="Buscar en esta carpeta"
                        className="h-9 pl-8"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="shrink-0 gap-2"
                      disabled={syncing}
                      onClick={() => void handleSync()}
                    >
                      {syncing ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <RefreshCw className="size-4" />
                      )}
                      <span className="hidden sm:inline">
                        {syncing ? "Sincronizando..." : "Sincronizar"}
                      </span>
                    </Button>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-1 border-b border-border/60 bg-muted/15 px-3 py-1.5 sm:px-4">
                  <button
                    type="button"
                    onClick={() => setTagFilter("all")}
                    className={cn(
                      "rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors",
                      tagFilter === "all"
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-background text-muted-foreground hover:text-foreground",
                    )}
                  >
                    Todas
                  </button>
                  {MAIL_TAG_IDS.map((tagId) => {
                    const meta = MAIL_TAG_META[tagId];
                    const active = tagFilter === tagId;
                    return (
                      <button
                        key={tagId}
                        type="button"
                        onClick={() =>
                          setTagFilter((prev) =>
                            prev === tagId ? "all" : tagId,
                          )
                        }
                        className={cn(
                          "rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors",
                          active
                            ? meta.badgeClassName
                            : "border-border bg-background text-muted-foreground hover:text-foreground",
                        )}
                      >
                        {meta.label}
                      </button>
                    );
                  })}
                </div>

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
          {(() => {
            const activeSelectedMessage = selectedMessage
              ? (headersResult?.headers.find(
                  (h) => h.messageId === selectedMessage.messageId,
                ) ?? selectedMessage)
              : null;
            return activeSelectedMessage ? (
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
            );
          })()}
        </Panel>
      </PanelGroup>
    </div>
  );
}

function MailboxSidebar({
  account,
  folders,
  activeFolderId,
  mobilePane,
  syncing,
  onSelectFolder,
  onSync,
  onOpenSettings,
}: {
  account: MailboxAccount;
  folders: MailboxFolder[] | undefined;
  activeFolderId: string | null;
  mobilePane: MobilePane;
  syncing: boolean;
  onSelectFolder: (folder: MailboxFolder) => void;
  onSync: () => void;
  onOpenSettings: () => void;
}) {
  return (
    <aside
      className={cn(
        "min-h-0 w-full shrink-0 flex-1 flex-col border-b border-border/70 bg-muted/15 lg:w-64 lg:flex-none lg:border-b-0 lg:border-r",
        mobilePane === "folders" ? "flex" : "hidden lg:flex",
      )}
    >
      <div className="flex items-start justify-between gap-2 border-b border-border/60 px-3 py-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Mi buzón
          </p>
          <p
            className="mt-0.5 truncate text-sm font-medium"
            title={account.email}
          >
            {account.email}
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="shrink-0 gap-1.5 px-2 text-muted-foreground"
          onClick={onOpenSettings}
          title="Configurar el buzón en Ajustes"
        >
          <Settings2 className="size-4" />
          <span className="sr-only">Configurar buzón</span>
        </Button>
      </div>

      <nav
        aria-label="Carpetas de correo"
        className="min-h-0 flex-1 overflow-y-auto p-2"
      >
        {folders === undefined ? (
          <FolderSkeleton />
        ) : folders.length === 0 ? (
          <div className="px-2 py-4 text-center text-xs leading-5 text-muted-foreground">
            No hay carpetas de correo guardadas. Sincroniza para traerlas del
            servidor.
          </div>
        ) : (
          <ul className="space-y-0.5">
            {folders.map((folder) => {
              const Icon = folderIcon(folder.kind);
              const active = folder.remoteId === activeFolderId;
              return (
                <li key={folder.remoteId}>
                  <button
                    type="button"
                    aria-current={active ? "page" : undefined}
                    title={folder.path}
                    onClick={() => onSelectFolder(folder)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm transition-colors",
                      active
                        ? "bg-signal/10 font-medium text-foreground"
                        : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                    )}
                  >
                    <Icon
                      className={cn(
                        "size-4 shrink-0",
                        active ? "text-signal" : "text-muted-foreground",
                      )}
                    />
                    <span className="min-w-0 flex-1 truncate">
                      {folder.name}
                    </span>
                    {folder.unread > 0 && (
                      <span className="shrink-0 rounded-full bg-signal px-1.5 py-0.5 text-[10px] font-semibold leading-none text-primary-foreground">
                        {folder.unread > 99 ? "99+" : folder.unread}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </nav>

      <div className="border-t border-border/60 p-3">
        <p className="text-[11px] leading-4 text-muted-foreground">
          {account.lastSyncAt === null
            ? "Sin sincronizar todavía."
            : `Última sincronización: ${formatDateTime(account.lastSyncAt)}`}
        </p>
        <p className="mt-0.5 truncate text-[11px] leading-4 text-muted-foreground">
          {account.status === "connected"
            ? "Conectado a Zimbra"
            : account.status === "reauthRequired"
              ? "Credenciales caducadas"
              : account.status === "error"
                ? "Error de conexión"
                : "Buzón desconectado"}
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-2 w-full gap-2"
          disabled={syncing}
          onClick={onSync}
        >
          {syncing ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <RefreshCw className="size-4" />
          )}
          {syncing ? "Sincronizando..." : "Sincronizar ahora"}
        </Button>
      </div>
    </aside>
  );
}

function MailboxAlert({
  account,
  syncing,
  onSync,
  onOpenSettings,
}: {
  account: MailboxAccount;
  syncing: boolean;
  onSync: () => void;
  onOpenSettings: () => void;
}) {
  if (account.status === "reauthRequired") {
    return (
      <div className="flex flex-wrap items-start gap-3 border-b border-destructive/20 bg-destructive/5 px-4 py-2.5 text-xs text-destructive">
        <ShieldAlert className="mt-0.5 size-4 shrink-0" />
        <p className="min-w-0 flex-1 leading-5">
          Las credenciales del buzón han caducado. Vuelve a guardar la
          contraseña de aplicación para recuperar la sincronización.
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 shrink-0"
          onClick={onOpenSettings}
        >
          Revisar cuenta
        </Button>
      </div>
    );
  }

  if (account.status === "error") {
    return (
      <div className="flex flex-wrap items-start gap-3 border-b border-destructive/20 bg-destructive/5 px-4 py-2.5 text-xs text-destructive">
        <AlertTriangle className="mt-0.5 size-4 shrink-0" />
        <p className="min-w-0 flex-1 leading-5">
          {account.lastSyncError?.trim() ||
            "No se pudo conectar con el servidor de correo."}
        </p>
        <div className="flex shrink-0 gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 gap-1.5"
            disabled={syncing}
            onClick={onSync}
          >
            <RefreshCw className={cn("size-3.5", syncing && "animate-spin")} />
            Reintentar
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7"
            onClick={onOpenSettings}
          >
            Ajustes
          </Button>
        </div>
      </div>
    );
  }

  if (account.status === "disconnected") {
    return (
      <div className="flex flex-wrap items-start gap-3 border-b border-border/60 bg-muted/30 px-4 py-2.5 text-xs text-muted-foreground">
        <WifiOff className="mt-0.5 size-4 shrink-0" />
        <p className="min-w-0 flex-1 leading-5">
          El buzón está desconectado. Se muestra la copia local hasta que
          vuelvas a conectar la cuenta.
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 shrink-0"
          onClick={onOpenSettings}
        >
          Conectar
        </Button>
      </div>
    );
  }

  if (!account.enabled) {
    return (
      <div className="flex flex-wrap items-start gap-3 border-b border-border/60 bg-muted/30 px-4 py-2.5 text-xs text-muted-foreground">
        <Mail className="mt-0.5 size-4 shrink-0" />
        <p className="min-w-0 flex-1 leading-5">
          La sincronización automática está desactivada. Puedes actualizar la
          copia local manualmente con «Sincronizar».
        </p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 shrink-0"
          onClick={onOpenSettings}
        >
          Activar
        </Button>
      </div>
    );
  }

  return null;
}

function MailboxWithoutAccount({
  onOpenSettings,
}: {
  onOpenSettings: () => void;
}) {
  return (
    <section className="rounded-xl border border-dashed border-border bg-card p-8 text-center shadow-sm">
      <span className="mx-auto flex size-12 items-center justify-center rounded-xl bg-signal/10 text-signal">
        <Mailbox className="size-5" />
      </span>
      <h2 className="mt-4 text-lg font-semibold tracking-tight">
        Configura tu buzón de correo
      </h2>
      <p className="mx-auto mt-1 max-w-lg text-sm leading-6 text-muted-foreground">
        El correo del taller se lee desde tu cuenta personal de Zimbra. Guarda
        la dirección y la contraseña de aplicación en Ajustes; después podrás
        sincronizar las carpetas y ver sus cabeceras aquí.
      </p>
      <Button type="button" className="mt-5 gap-2" onClick={onOpenSettings}>
        <Settings2 className="size-4" />
        Abrir ajustes del taller
      </Button>
    </section>
  );
}

function MailboxWithoutFolders({
  syncing,
  onSync,
}: {
  syncing: boolean;
  onSync: () => void;
}) {
  return (
    <div className="flex min-h-64 flex-1 flex-col items-center justify-center px-6 py-12 text-center">
      <span className="flex size-11 items-center justify-center rounded-xl bg-muted text-muted-foreground">
        <Folder className="size-5" />
      </span>
      <h2 className="mt-4 text-sm font-semibold">Todavía no hay carpetas</h2>
      <p className="mt-1 max-w-sm text-xs leading-5 text-muted-foreground">
        La cuenta está guardada, pero el servidor aún no ha devuelto sus
        carpetas de correo. Ejecuta una sincronización para empezar.
      </p>
      <Button
        type="button"
        size="sm"
        className="mt-4 gap-2"
        disabled={syncing}
        onClick={onSync}
      >
        {syncing ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <RefreshCw className="size-4" />
        )}
        {syncing ? "Sincronizando..." : "Sincronizar ahora"}
      </Button>
    </div>
  );
}

function MailboxLoading() {
  return (
    <div className="flex min-h-[32rem] overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm">
      <div className="hidden w-64 shrink-0 space-y-2 border-r border-border/60 bg-muted/15 p-3 lg:block">
        <div className="h-10 animate-pulse rounded-md bg-muted" />
        {[0, 1, 2, 3, 4].map((item) => (
          <div
            key={item}
            className="h-9 animate-pulse rounded-md bg-muted/70"
          />
        ))}
      </div>
      <div className="flex-1 space-y-3 p-4">
        <div className="h-9 w-1/3 animate-pulse rounded bg-muted" />
        <div className="h-9 w-full animate-pulse rounded bg-muted/60" />
        <MessageListSkeleton />
      </div>
    </div>
  );
}

function MessageAreaSkeleton() {
  return (
    <div className="flex-1 space-y-3 p-4">
      <div className="h-7 w-1/3 animate-pulse rounded bg-muted" />
      <MessageListSkeleton />
    </div>
  );
}

function FolderSkeleton() {
  return (
    <div className="space-y-1 px-0.5">
      {[0, 1, 2, 3, 4, 5].map((item) => (
        <div key={item} className="h-9 animate-pulse rounded-md bg-muted/70" />
      ))}
    </div>
  );
}
