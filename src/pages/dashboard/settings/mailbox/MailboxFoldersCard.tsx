import { useState } from "react";
import { useMutation } from "convex/react";
import { ArrowDown, ArrowUp, Eye, EyeOff, FolderTree, Inbox } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/utils";
import { getErrorMessage } from "@/lib/workshop";

export type MailboxFolderItem =
  (typeof api.mailAccounts.folders)["_returnType"][number];

export interface MailboxFoldersCardProps {
  folders: MailboxFolderItem[] | undefined;
}

/**
 * Gestión de orden y visibilidad de las carpetas de correo de Zimbra.
 * Permite reordenarlas con botones arriba/abajo y ocultar las que no se
 * necesitan en la ficha de Correo.
 */
export function MailboxFoldersCard({ folders }: MailboxFoldersCardProps) {
  const setFolderVisibility = useMutation(api.mailAccounts.setFolderVisibility);
  const reorderFolders = useMutation(api.mailAccounts.reorderFolders);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const visibleCount = folders
    ? folders.filter((folder) => !folder.hidden).length
    : 0;

  const handleToggleVisibility = async (folder: MailboxFolderItem) => {
    setBusyKey(`vis:${folder.remoteId}`);
    try {
      await setFolderVisibility({
        remoteId: folder.remoteId,
        hidden: !folder.hidden,
      });
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setBusyKey(null);
    }
  };

  const handleMove = async (index: number, direction: -1 | 1) => {
    if (!folders) return;
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= folders.length) return;

    const next = [...folders];
    const [moved] = next.splice(index, 1);
    next.splice(targetIndex, 0, moved);

    setBusyKey(`move:${moved.remoteId}`);
    try {
      await reorderFolders({
        orderedRemoteIds: next.map((folder) => folder.remoteId),
      });
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <div className="mt-4 grid gap-3 rounded-lg border border-border/60 px-3 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-sm font-medium">
          <FolderTree className="size-4" /> Carpetas de correo
        </p>
        <p className="text-xs text-muted-foreground">
          {folders === undefined
            ? "Cargando..."
            : `${visibleCount} ${
                visibleCount === 1 ? "visible" : "visibles"
              } de ${folders.length}`}
        </p>
      </div>

      {folders !== undefined && folders.length > 0 && (
        <>
          <p className="text-xs text-muted-foreground">
            Ordena las carpetas con las flechas y oculta las que no necesites ver
            en la ficha de Correo.
          </p>
          <ul className="divide-y divide-border/60 rounded-md border border-border/60">
            {folders.map((folder, index) => {
              const hidden = Boolean(folder.hidden);
              const isBusy = busyKey !== null;
              return (
                <li
                  key={folder.remoteId}
                  className={cn(
                    "flex items-center justify-between gap-2 px-2.5 py-2 text-xs transition-opacity",
                    hidden && "bg-muted/30 opacity-65",
                  )}
                >
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <Inbox className="size-3.5 shrink-0 text-muted-foreground" />
                    <span
                      className={cn(
                        "truncate font-medium",
                        hidden && "line-through text-muted-foreground",
                      )}
                      title={folder.path}
                    >
                      {folder.name}
                    </span>
                    {folder.unread > 0 && (
                      <span className="shrink-0 font-semibold text-signal tabular-nums">
                        {folder.unread}
                      </span>
                    )}
                    {hidden && (
                      <Badge variant="outline" className="text-[10px]">
                        Oculta
                      </Badge>
                    )}
                  </div>

                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-7"
                      disabled={isBusy || index === 0}
                      aria-label={`Subir carpeta ${folder.name}`}
                      title="Subir"
                      onClick={() => void handleMove(index, -1)}
                    >
                      <ArrowUp className="size-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-7"
                      disabled={isBusy || index === folders.length - 1}
                      aria-label={`Bajar carpeta ${folder.name}`}
                      title="Bajar"
                      onClick={() => void handleMove(index, 1)}
                    >
                      <ArrowDown className="size-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-7"
                      disabled={isBusy}
                      aria-label={
                        hidden
                          ? `Mostrar carpeta ${folder.name}`
                          : `Ocultar carpeta ${folder.name}`
                      }
                      title={hidden ? "Mostrar en Correo" : "Ocultar en Correo"}
                      onClick={() => void handleToggleVisibility(folder)}
                    >
                      {hidden ? (
                        <Eye className="size-3.5" />
                      ) : (
                        <EyeOff className="size-3.5" />
                      )}
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
