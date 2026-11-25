import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  Folder,
  Loader2,
  Mail,
  Mailbox,
  RefreshCw,
  Settings2,
  ShieldAlert,
  WifiOff,
} from "lucide-react";
import { MessageListSkeleton } from "../MessageList";
import type { MailboxAccount } from "../types";

export function MailboxAlert({
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

export function MailboxWithoutAccount({
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

export function MailboxWithoutFolders({
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

export function MailboxLoading() {
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

export function MessageAreaSkeleton() {
  return (
    <div className="flex-1 space-y-3 p-4">
      <div className="h-7 w-1/3 animate-pulse rounded bg-muted" />
      <MessageListSkeleton />
    </div>
  );
}
