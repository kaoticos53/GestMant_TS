import { Button } from "@/components/ui/button";
import { DestructiveConfirmDialog } from "@/components/ui/destructive-confirm-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { api } from "@/convex/_generated/api";
import {
  MAIL_CACHE_DEFAULT_LIMIT_BYTES,
  MAIL_CACHE_DEFAULT_RETENTION_DAYS,
  MAIL_CACHE_MAX_LIMIT_BYTES,
  MAIL_CACHE_MAX_RETENTION_DAYS,
  MAIL_CACHE_MIN_LIMIT_BYTES,
  MAIL_CACHE_MIN_RETENTION_DAYS,
  MAIL_SERVER_URL,
} from "@/lib/mailClient/account";
import { cn } from "@/lib/utils";
import {
  formatDateTime,
  formatFileSize,
  getErrorMessage,
} from "@/lib/workshop";
import { useAction, useMutation, useQuery } from "convex/react";
import { CheckCircle2, Mail, ShieldAlert } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  MailboxFoldersCard,
  type MailboxFolderItem,
} from "./mailbox/MailboxFoldersCard";
import { MailboxTagRulesCard } from "./mailbox/MailboxTagRulesCard";
import { MailIndexSection } from "./MailIndexSection";

const MIB = 1024 * 1024;

function statusLabel(status: string): string {
  switch (status) {
    case "connected":
      return "Conectado";
    case "reauthRequired":
      return "Credenciales caducadas";
    case "error":
      return "Error de conexión";
    default:
      return "Sin conectar";
  }
}

function statusClass(status: string): string {
  if (status === "connected") {
    return "border-emerald-600/25 bg-emerald-600/10 text-emerald-700 dark:text-emerald-300";
  }
  if (status === "reauthRequired" || status === "error") {
    return "border-destructive/30 bg-destructive/5 text-destructive";
  }
  return "border-border bg-muted/60 text-muted-foreground";
}

interface MailboxForm {
  email: string;
  password: string;
  enabled: boolean;
  cacheLimitMiB: number;
  cacheRetentionDays: number;
}

const EMPTY_FORM: MailboxForm = {
  email: "",
  password: "",
  enabled: true,
  cacheLimitMiB: MAIL_CACHE_DEFAULT_LIMIT_BYTES / MIB,
  cacheRetentionDays: MAIL_CACHE_DEFAULT_RETENTION_DAYS,
};

type MailboxAccount = NonNullable<
  (typeof api.mailAccounts.account)["_returnType"]
>;
type MailboxFolder = MailboxFolderItem;

function formFromAccount(account: MailboxAccount | null): MailboxForm {
  if (account === null) return EMPTY_FORM;
  return {
    email: account.email,
    password: "",
    enabled: account.enabled,
    cacheLimitMiB: Math.round(account.cacheLimitBytes / MIB),
    cacheRetentionDays: account.cacheRetentionDays,
  };
}

/**
 * «Mi buzón»: la cuenta personal de Zimbra. No hay pantalla de buzones ajenos;
 * el servidor es fijo y la contraseña solo viaja hacia el backend, nunca vuelve.
 */
export function MailboxCard() {
  const account = useQuery(api.mailAccounts.account);
  const folders = useQuery(api.mailAccounts.folders, { includeHidden: true });

  if (account === undefined) {
    return (
      <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
        <div className="h-5 w-40 animate-pulse rounded bg-muted" />
        <div className="mt-4 h-24 animate-pulse rounded bg-muted/60" />
      </div>
    );
  }

  // El editor solo se remonta al crear/eliminar la cuenta o cambiar su correo:
  // así las actualizaciones en segundo plano (p. ej. updatedAt o estado de caché)
  // no borran cambios locales sin guardar.
  return (
    <MailboxEditor
      key={account === null ? "empty" : account.email}
      account={account}
      folders={folders}
    />
  );
}

function MailboxEditor({
  account,
  folders,
}: {
  account: MailboxAccount | null;
  folders: MailboxFolder[] | undefined;
}) {
  const save = useMutation(api.mailAccounts.save);
  const testConnection = useAction(api.mailAccounts.testConnection);
  const disconnect = useMutation(api.mailAccounts.disconnect);
  const remove = useMutation(api.mailAccounts.remove);
  const emptyCache = useMutation(api.mailCache.empty);

  const [form, setForm] = useState<MailboxForm>(() => formFromAccount(account));
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [clearingCache, setClearingCache] = useState(false);
  const [deleteCache, setDeleteCache] = useState(false);
  const [confirmAction, setConfirmAction] = useState<
    "disconnect" | "emptyCache" | "remove" | null
  >(null);

  const handleSave = async () => {
    setSaving(true);
    try {
      await save({
        email: form.email.trim(),
        ...(form.password.trim() === "" ? {} : { password: form.password }),
        enabled: form.enabled,
        cacheLimitBytes: Math.round(form.cacheLimitMiB * MIB),
        cacheRetentionDays: form.cacheRetentionDays,
      });
      setForm((prev) => ({ ...prev, password: "" }));
      toast.success("Cuenta del buzón guardada");
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      const result = await testConnection({});
      toast.success(
        `Conexión correcta: ${result.folderCount} ${
          result.folderCount === 1 ? "carpeta" : "carpetas"
        } de correo`,
      );
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setTesting(false);
    }
  };

  const handleDisconnect = async () => {
    setBusy(true);
    try {
      await disconnect({ deleteCache });
      setConfirmAction(null);
      toast.success("Buzón desconectado");
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const handleEmptyCache = async () => {
    setClearingCache(true);
    try {
      const result = await emptyCache({});
      setConfirmAction(null);
      toast.success(
        `Caché vaciada: ${result.messages} ${
          result.messages === 1 ? "mensaje" : "mensajes"
        } y ${formatFileSize(result.bytes)}.`,
      );
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setClearingCache(false);
    }
  };

  const handleRemove = async () => {
    setBusy(true);
    try {
      await remove({});
      setConfirmAction(null);
      toast.success("Cuenta del buzón borrada");
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const usage =
    account === null
      ? 0
      : Math.min(
          100,
          Math.round((account.cacheBytes / account.cacheLimitBytes) * 100),
        );

  return (
    <section className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <Mail className="size-4" /> Mi buzón
          </h2>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground">
            Tu cuenta personal de Zimbra. Solo tú puedes verla y configurarla;
            el administrador no tiene acceso a los buzones de otras personas.
          </p>
        </div>
        <span
          className={cn(
            "rounded-full border px-2.5 py-1 text-xs font-medium",
            statusClass(account?.status ?? "disconnected"),
          )}
        >
          {statusLabel(account?.status ?? "disconnected")}
        </span>
      </div>

      {account?.lastSyncError && (
        <p className="mt-3 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs leading-5 text-destructive">
          <ShieldAlert className="mt-0.5 size-4 shrink-0" />
          Último error: {account.lastSyncError}
        </p>
      )}

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="mailbox-server">Servidor</Label>
          <Input
            id="mailbox-server"
            value={MAIL_SERVER_URL}
            readOnly
            disabled
          />
          <p className="text-xs text-muted-foreground">
            Fijo por seguridad: no se puede cambiar desde aquí.
          </p>
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="mailbox-email">Cuenta de correo</Label>
          <Input
            id="mailbox-email"
            type="email"
            autoComplete="username"
            placeholder="nombre@rtva.es"
            maxLength={320}
            value={form.email}
            disabled={saving}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, email: event.target.value }))
            }
          />
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="mailbox-password">Contraseña de aplicación</Label>
          <Input
            id="mailbox-password"
            type="password"
            autoComplete="new-password"
            placeholder={
              account?.hasPassword
                ? `Guardada (${account.passwordHint}). Escribe otra para cambiarla.`
                : "Contraseña de aplicación de Zimbra"
            }
            maxLength={512}
            value={form.password}
            disabled={saving}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, password: event.target.value }))
            }
          />
          <p className="text-xs text-muted-foreground">
            Se guarda cifrada y nunca vuelve al navegador.
            {account?.hasPassword ? " Déjala vacía para conservarla." : ""}
          </p>
        </div>

        <div className="grid content-start gap-2 rounded-lg border border-border/60 px-3 py-2.5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium">Sincronización automática</p>
              <p className="text-xs text-muted-foreground">
                Cada hora, mientras la cuenta esté activa.
              </p>
            </div>
            <Switch
              checked={form.enabled}
              disabled={saving}
              onCheckedChange={(enabled) =>
                setForm((prev) => ({ ...prev, enabled }))
              }
              aria-label="Sincronización automática"
            />
          </div>
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="mailbox-cache-limit">Límite de caché (MiB)</Label>
          <Input
            id="mailbox-cache-limit"
            type="number"
            min={MAIL_CACHE_MIN_LIMIT_BYTES / MIB}
            max={MAIL_CACHE_MAX_LIMIT_BYTES / MIB}
            step={64}
            value={form.cacheLimitMiB}
            disabled={saving}
            onChange={(event) =>
              setForm((prev) => ({
                ...prev,
                cacheLimitMiB: Number(event.target.value),
              }))
            }
          />
          <p className="text-xs text-muted-foreground">
            Entre 128 MiB y 2 GiB. Por defecto, 512 MiB.
          </p>
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="mailbox-retention">Retención (días)</Label>
          <Input
            id="mailbox-retention"
            type="number"
            min={MAIL_CACHE_MIN_RETENTION_DAYS}
            max={MAIL_CACHE_MAX_RETENTION_DAYS}
            value={form.cacheRetentionDays}
            disabled={saving}
            onChange={(event) =>
              setForm((prev) => ({
                ...prev,
                cacheRetentionDays: Number(event.target.value),
              }))
            }
          />
          <p className="text-xs text-muted-foreground">
            Entre 7 y 365 días. Por defecto, 30.
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          type="button"
          className="gap-2"
          disabled={saving || form.email.trim() === ""}
          onClick={() => void handleSave()}
        >
          <CheckCircle2 className="size-4" />
          {saving ? "Guardando..." : "Guardar cuenta"}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="gap-2"
          disabled={testing || account === null}
          onClick={() => void handleTest()}
        >
          <Mail className="size-4" />
          {testing ? "Probando..." : "Probar conexión"}
        </Button>
      </div>

      {account && (
        <>
          <MailboxFoldersCard folders={folders} />
          <MailboxTagRulesCard />
          <MailIndexSection />

          <div className="mt-4 grid gap-2 rounded-lg border border-border/60 px-3 py-3">
            <p className="text-sm font-medium">Caché local</p>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-signal transition-[width]"
                style={{ width: `${usage}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {formatFileSize(account.cacheBytes)} de{" "}
              {formatFileSize(account.cacheLimitBytes)} ·{" "}
              {account.cacheRetentionDays} días de retención
            </p>
            <p className="text-xs text-muted-foreground">
              Cuerpo: {formatFileSize(account.cacheBodyBytes)} · Adjuntos:{" "}
              {formatFileSize(account.cacheAttachmentBytes)}
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-1 w-fit"
              disabled={clearingCache || account.cacheBytes === 0}
              onClick={() => setConfirmAction("emptyCache")}
            >
              {clearingCache ? "Vaciando..." : "Vaciar caché"}
            </Button>
            {account.lastSyncAt !== null && (
              <p className="text-xs text-muted-foreground">
                Última sincronización: {formatDateTime(account.lastSyncAt)}
              </p>
            )}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-3">
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={deleteCache}
                onChange={(event) => setDeleteCache(event.target.checked)}
                className="size-4 accent-destructive"
              />
              Borrar también la caché al desconectar
            </label>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => setConfirmAction("disconnect")}
              >
                Desconectar
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={busy}
                onClick={() => setConfirmAction("remove")}
              >
                Borrar cuenta
              </Button>
            </div>
          </div>
        </>
      )}

      {confirmAction && (
        <DestructiveConfirmDialog
          onClose={() => setConfirmAction(null)}
          busy={busy || clearingCache}
          title={
            confirmAction === "emptyCache"
              ? "¿Vaciar la caché local del buzón?"
              : confirmAction === "disconnect"
                ? "¿Desconectar el buzón de correo?"
                : "¿Borrar la cuenta de correo?"
          }
          description={
            confirmAction === "emptyCache"
              ? "Se borrarán los cuerpos y adjuntos descargados localmente. Las cabeceras y el buzón remoto no se tocan."
              : confirmAction === "disconnect"
                ? deleteCache
                  ? "Se cerrará la conexión y se eliminará también la caché local descargada."
                  : "Se cerrará la conexión del buzón. Las carpetas descargadas se conservarán salvo que marques el borrado de caché."
                : "Se borrarán la cuenta y sus carpetas locales de esta aplicación. Esta acción no se puede deshacer."
          }
          confirmLabel={
            confirmAction === "emptyCache"
              ? "Vaciar caché"
              : confirmAction === "disconnect"
                ? "Desconectar"
                : "Borrar cuenta"
          }
          busyLabel={
            confirmAction === "emptyCache"
              ? "Vaciando..."
              : confirmAction === "disconnect"
                ? "Desconectando..."
                : "Borrando..."
          }
          onConfirm={() =>
            confirmAction === "emptyCache"
              ? handleEmptyCache()
              : confirmAction === "disconnect"
                ? handleDisconnect()
                : handleRemove()
          }
        />
      )}
    </section>
  );
}
