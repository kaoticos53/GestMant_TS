import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import {
  ArrowDown,
  ArrowUp,
  Pencil,
  Plus,
  RefreshCw,
  Sparkles,
  Tag,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DestructiveConfirmDialog } from "@/components/ui/destructive-confirm-dialog";
import { Switch } from "@/components/ui/switch";
import { api } from "@/convex/_generated/api";
import {
  MAIL_TAG_FIELD_LABELS,
  MAIL_TAG_META,
  MAIL_TAG_OPERATOR_LABELS,
  MAIL_TAG_RULE_PRESETS,
  type MailTagCondition,
  type MailTagId,
} from "@/lib/mailClient/tagging";
import { cn } from "@/lib/utils";
import { getErrorMessage } from "@/lib/workshop";
import { RuleEditorDialog, type EditableRule } from "./RuleEditorDialog";

function describeConditions(conditions: MailTagCondition[]): string {
  return conditions
    .map((c) => {
      const field = MAIL_TAG_FIELD_LABELS[c.field];
      const op = MAIL_TAG_OPERATOR_LABELS[c.operator];
      return c.field === "has_attachments"
        ? `${field}: ${op}`
        : `${field} ${op} «${c.value}»`;
    })
    .join(" · ");
}

/**
 * Constructor amigable de reglas rápidas para autoetiquetado de correo Zimbra.
 * Las reglas se evalúan antes de DeepSeek para ahorrar tokens y tiempo.
 */
export function MailboxTagRulesCard() {
  const rules = useQuery(api.mailTagging.listRules, {});
  const saveRule = useMutation(api.mailTagging.saveRule);
  const toggleRule = useMutation(api.mailTagging.toggleRule);
  const deleteRule = useMutation(api.mailTagging.deleteRule);
  const reorderRules = useMutation(api.mailTagging.reorderRules);
  const reapplyRules = useMutation(api.mailTagging.reapplyRulesToAccount);

  const [editorState, setEditorState] = useState<{
    open: boolean;
    rule: EditableRule | null;
  }>({ open: false, rule: null });
  const [busy, setBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{
    id: NonNullable<typeof rules>[number]["_id"];
    name: string;
  } | null>(null);

  const handleApplyPreset = async (
    preset: (typeof MAIL_TAG_RULE_PRESETS)[number],
  ) => {
    setBusy(true);
    try {
      await saveRule({
        name: preset.name,
        enabled: true,
        matchMode: preset.matchMode,
        conditions: preset.conditions,
        tags: preset.tags,
      });
      toast.success(`Plantilla «${preset.name}» añadida`);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const handleMove = async (index: number, direction: -1 | 1) => {
    if (!rules) return;
    const target = index + direction;
    if (target < 0 || target >= rules.length) return;
    const next = [...rules];
    const [moved] = next.splice(index, 1);
    next.splice(target, 0, moved);
    setBusy(true);
    try {
      await reorderRules({ orderedIds: next.map((r) => r._id) });
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const handleReapply = async () => {
    setBusy(true);
    try {
      const res = await reapplyRules({});
      toast.success(
        `Reglas aplicadas: ${res.updated} mensajes actualizados de ${res.scanned} revisados.`,
      );
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-4 grid gap-3 rounded-lg border border-border/60 px-3 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="flex items-center gap-1.5 text-sm font-medium">
            <Tag className="size-4" /> Reglas rápidas de autoetiquetado
          </p>
          <p className="text-xs text-muted-foreground">
            Se aplican primero por orden de prioridad; el resto lo clasifica
            DeepSeek automáticamente.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {rules && rules.length > 0 && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy}
              className="h-8 gap-1.5 text-xs"
              onClick={() => void handleReapply()}
              title="Reevaluar correos existentes (no manuales) con las reglas activas"
            >
              <RefreshCw className="size-3.5" />
              Reaplicar reglas
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 gap-1.5 text-xs"
            onClick={() => setEditorState({ open: true, rule: null })}
          >
            <Plus className="size-3.5" />
            Nueva regla
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
          <Sparkles className="size-3" /> Plantillas rápidas:
        </span>
        {MAIL_TAG_RULE_PRESETS.map((preset) => (
          <Button
            key={preset.name}
            type="button"
            variant="ghost"
            size="sm"
            disabled={busy}
            className="h-6 border border-dashed border-border/80 px-2 text-[11px]"
            onClick={() => void handleApplyPreset(preset)}
          >
            + {preset.name}
          </Button>
        ))}
      </div>

      {rules === undefined ? (
        <p className="text-xs text-muted-foreground">Cargando reglas...</p>
      ) : rules.length === 0 ? (
        <p className="rounded-md border border-dashed p-4 text-center text-xs text-muted-foreground">
          No hay reglas rápidas configuradas todavía. Usa una plantilla o crea
          una nueva regla.
        </p>
      ) : (
        <ul className="divide-y divide-border/60 rounded-md border border-border/60">
          {rules.map((rule, index) => (
            <li
              key={rule._id}
              className={cn(
                "flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-xs",
                !rule.enabled && "bg-muted/30 opacity-65",
              )}
            >
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="font-semibold">{rule.name}</span>
                  {rule.tags.map((tagId) => {
                    const meta = MAIL_TAG_META[tagId as MailTagId];
                    return (
                      <Badge
                        key={tagId}
                        variant="outline"
                        className={cn("text-[10px]", meta?.badgeClassName)}
                      >
                        {meta?.label ?? tagId}
                      </Badge>
                    );
                  })}
                </div>
                <p className="truncate text-muted-foreground">
                  {describeConditions(rule.conditions)}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-1">
                <Switch
                  checked={rule.enabled}
                  disabled={busy}
                  aria-label={`Activar regla ${rule.name}`}
                  onCheckedChange={(checked) => {
                    void (async () => {
                      try {
                        await toggleRule({ id: rule._id, enabled: checked });
                      } catch (err) {
                        toast.error(getErrorMessage(err));
                      }
                    })();
                  }}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  disabled={busy || index === 0}
                  aria-label={`Subir regla ${rule.name}`}
                  onClick={() => void handleMove(index, -1)}
                >
                  <ArrowUp className="size-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  disabled={busy || index === rules.length - 1}
                  aria-label={`Bajar regla ${rule.name}`}
                  onClick={() => void handleMove(index, 1)}
                >
                  <ArrowDown className="size-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  aria-label={`Editar regla ${rule.name}`}
                  onClick={() =>
                    setEditorState({
                      open: true,
                      rule: {
                        _id: rule._id,
                        name: rule.name,
                        enabled: rule.enabled,
                        matchMode: rule.matchMode,
                        conditions: rule.conditions,
                        tags: rule.tags as MailTagId[],
                      },
                    })
                  }
                >
                  <Pencil className="size-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-7 text-muted-foreground hover:text-destructive"
                  disabled={busy}
                  aria-label={`Eliminar regla ${rule.name}`}
                  onClick={() =>
                    setDeleteTarget({ id: rule._id, name: rule.name })
                  }
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {deleteTarget && (
        <DestructiveConfirmDialog
          onClose={() => setDeleteTarget(null)}
          busy={busy}
          title={`¿Borrar la regla «${deleteTarget.name}»?`}
          description="Dejará de aplicarse en futuras sincronizaciones del buzón. Esta acción no se puede deshacer."
          confirmLabel="Borrar regla"
          onConfirm={async () => {
            setBusy(true);
            try {
              await deleteRule({ id: deleteTarget.id });
              setDeleteTarget(null);
              toast.success("Regla de etiquetado eliminada.");
            } catch (err) {
              toast.error(getErrorMessage(err));
            } finally {
              setBusy(false);
            }
          }}
        />
      )}

      {editorState.open && (
        <RuleEditorDialog
          key={editorState.rule?._id ?? "new"}
          open={editorState.open}
          initialRule={editorState.rule}
          onClose={() => setEditorState({ open: false, rule: null })}
        />
      )}
    </div>
  );
}
