import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/workshop";
import {
  Archive,
  FileText,
  Folder,
  Inbox,
  Loader2,
  RefreshCw,
  Send,
  Settings2,
  Trash2,
} from "lucide-react";
import type { MailboxAccount, MailboxFolder } from "../types";

export type MobilePane = "folders" | "messages" | "message";

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

export function MailboxSidebar({
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

function FolderSkeleton() {
  return (
    <div className="space-y-1 px-0.5">
      {[0, 1, 2, 3, 4, 5].map((item) => (
        <div key={item} className="h-9 animate-pulse rounded-md bg-muted/70" />
      ))}
    </div>
  );
}
