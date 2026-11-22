import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  MAIL_TAG_FIELD_LABELS,
  MAIL_TAG_IDS,
  MAIL_TAG_META,
  type MailTagCondition,
  type MailTagConditionField,
  type MailTagConditionOperator,
  type MailTagId,
  type MailTagMatchMode,
} from "@/lib/mailClient/tagging";
import { cn } from "@/lib/utils";
import { getErrorMessage } from "@/lib/workshop";

export interface EditableRule {
  _id?: Id<"mailTagRules">;
  name: string;
  enabled: boolean;
  matchMode: MailTagMatchMode;
  conditions: MailTagCondition[];
  tags: MailTagId[];
}

export interface RuleEditorDialogProps {
  open: boolean;
  initialRule: EditableRule | null;
  onClose: () => void;
}

const DEFAULT_CONDITION: MailTagCondition = {
  field: "subject_or_snippet",
  operator: "contains",
  value: "",
};

function availableOperators(
  field: MailTagConditionField,
): Array<{ value: MailTagConditionOperator; label: string }> {
  if (field === "has_attachments") {
    return [
      { value: "is_true", label: "Sí tiene adjuntos" },
      { value: "is_false", label: "No tiene adjuntos" },
    ];
  }
  if (field === "from_address" || field === "from_any") {
    return [
      { value: "contains", label: "contiene (palabras separadas por coma)" },
      { value: "domain_is", label: "pertenece al dominio (ej. empresa.es)" },
    ];
  }
  return [
    { value: "contains", label: "contiene (palabras separadas por coma)" },
  ];
}

export function RuleEditorDialog({
  open,
  initialRule,
  onClose,
}: RuleEditorDialogProps) {
  const saveRule = useMutation(api.mailTagging.saveRule);

  const [name, setName] = useState(initialRule?.name ?? "");
  const [matchMode, setMatchMode] = useState<MailTagMatchMode>(
    initialRule?.matchMode ?? "any",
  );
  const [conditions, setConditions] = useState<MailTagCondition[]>(
    initialRule?.conditions.length
      ? initialRule.conditions
      : [{ ...DEFAULT_CONDITION }],
  );
  const [tags, setTags] = useState<MailTagId[]>(initialRule?.tags ?? []);
  const [previewRequested, setPreviewRequested] = useState(false);
  const [saving, setSaving] = useState(false);

  const preview = useQuery(
    api.mailTagging.previewRuleMatches,
    previewRequested && conditions.length > 0
      ? {
          matchMode,
          conditions,
          tags: tags.length > 0 ? tags : ["informative"],
        }
      : "skip",
  );

  const updateCondition = (
    index: number,
    patch: Partial<MailTagCondition>,
  ) => {
    setPreviewRequested(false);
    setConditions((prev) =>
      prev.map((cond, idx) => {
        if (idx !== index) return cond;
        const next = { ...cond, ...patch };
        if (patch.field) {
          const ops = availableOperators(patch.field);
          if (!ops.some((o) => o.value === next.operator)) {
            next.operator = ops[0].value;
          }
          if (patch.field === "has_attachments") {
            next.value = "";
          }
        }
        return next;
      }),
    );
  };

  const toggleTag = (tagId: MailTagId) => {
    setTags((prev) => {
      if (prev.includes(tagId)) {
        return prev.filter((t) => t !== tagId);
      }
      if (prev.length >= 3) {
        toast.info("Puedes asignar hasta 3 etiquetas por regla.");
        return prev;
      }
      return [...prev, tagId];
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveRule({
        id: initialRule?._id,
        name,
        enabled: initialRule?.enabled ?? true,
        matchMode,
        conditions,
        tags,
      });
      toast.success(
        initialRule?._id ? "Regla actualizada" : "Regla rápida creada",
      );
      onClose();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {initialRule?._id ? "Editar regla rápida" : "Nueva regla rápida"}
          </DialogTitle>
          <DialogDescription>
            Define condiciones sencillas para etiquetar correos al instante sin
            consumir tokens de IA.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-1.5">
            <Label htmlFor="rule-name">Nombre de la regla</Label>
            <Input
              id="rule-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej. Avisos de avería o pedidos de proveedor"
            />
          </div>

          <div className="grid gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Label>Condiciones</Label>
              <Select
                value={matchMode}
                onValueChange={(v) => {
                  setPreviewRequested(false);
                  setMatchMode(v as MailTagMatchMode);
                }}
              >
                <SelectTrigger className="h-8 w-full sm:w-[250px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">
                    Se cumple CUALQUIERA de ellas (O)
                  </SelectItem>
                  <SelectItem value="all">
                    Se cumplen TODAS las condiciones (Y)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 rounded-lg border border-border/60 bg-muted/20 p-3">
              {conditions.map((cond, index) => {
                const ops = availableOperators(cond.field);
                const needsText = cond.field !== "has_attachments";
                return (
                  <div
                    key={index}
                    className="grid gap-2 rounded-md border bg-background p-2.5 sm:grid-cols-[1fr_1fr_auto]"
                  >
                    <Select
                      value={cond.field}
                      onValueChange={(v) =>
                        updateCondition(index, {
                          field: v as MailTagConditionField,
                        })
                      }
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(
                          Object.keys(
                            MAIL_TAG_FIELD_LABELS,
                          ) as MailTagConditionField[]
                        ).map((fieldKey) => (
                          <SelectItem key={fieldKey} value={fieldKey}>
                            {MAIL_TAG_FIELD_LABELS[fieldKey]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Select
                      value={cond.operator}
                      onValueChange={(v) =>
                        updateCondition(index, {
                          operator: v as MailTagConditionOperator,
                        })
                      }
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ops.map((op) => (
                          <SelectItem key={op.value} value={op.value}>
                            {op.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {conditions.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8 text-muted-foreground hover:text-destructive"
                        aria-label="Eliminar condición"
                        onClick={() => {
                          setPreviewRequested(false);
                          setConditions((prev) =>
                            prev.filter((_, idx) => idx !== index),
                          );
                        }}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    )}

                    {needsText && (
                      <Input
                        value={cond.value}
                        onChange={(e) =>
                          updateCondition(index, { value: e.target.value })
                        }
                        placeholder={
                          cond.operator === "domain_is"
                            ? "Ej. proveedor.com, sony.es"
                            : "Palabras separadas por coma (ej. avería, fallo, S/N)"
                        }
                        className="h-8 text-xs sm:col-span-3"
                      />
                    )}
                  </div>
                );
              })}

              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 gap-1 text-xs"
                onClick={() => {
                  setPreviewRequested(false);
                  setConditions((prev) => [...prev, { ...DEFAULT_CONDITION }]);
                }}
              >
                <Plus className="size-3.5" />
                Añadir condición
              </Button>
            </div>
          </div>

          <div className="grid gap-2">
            <Label>Etiquetas a asignar (máx. 3)</Label>
            <div className="flex flex-wrap gap-1.5">
              {MAIL_TAG_IDS.map((tagId) => {
                const meta = MAIL_TAG_META[tagId];
                const selected = tags.includes(tagId);
                return (
                  <button
                    key={tagId}
                    type="button"
                    aria-pressed={selected}
                    title={meta.description}
                    onClick={() => toggleTag(tagId)}
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-xs font-medium transition-all",
                      selected
                        ? meta.badgeClassName
                        : "border-border bg-background text-muted-foreground hover:bg-muted",
                    )}
                  >
                    {meta.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-lg border border-dashed border-border/80 bg-muted/20 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-medium">
                Comprobar con tus correos sincronizados
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 gap-1.5 text-xs"
                onClick={() => setPreviewRequested(true)}
              >
                <Search className="size-3.5" />
                Probar regla
              </Button>
            </div>
            {previewRequested && preview && (
              <div className="mt-2 space-y-1.5 text-xs">
                <p className="text-muted-foreground">
                  Coincide con{" "}
                  <strong className="text-foreground">
                    {preview.matchCount}
                  </strong>{" "}
                  de {preview.totalScanned} mensajes revisados.
                </p>
                {preview.samples.length > 0 && (
                  <ul className="space-y-1">
                    {preview.samples.map((sample) => (
                      <li
                        key={sample.messageId}
                        className="flex items-center justify-between gap-2 rounded bg-background px-2 py-1"
                      >
                        <span className="truncate font-medium">
                          {sample.subject}
                        </span>
                        <Badge variant="outline" className="shrink-0 text-[10px]">
                          {sample.from}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={saving}
            onClick={() => void handleSave()}
          >
            {saving ? "Guardando..." : "Guardar regla"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
