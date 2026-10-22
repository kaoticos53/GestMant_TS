import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AutocompleteInput } from "@/components/ui/AutocompleteInput";
import type { Doc } from "@/convex/_generated/dataModel";
import type { MatchedTemplate } from "../equipmentFormLogic";

export interface EquipmentIdentityFieldsProps {
  isEdit: boolean;
  busy: boolean;
  codeValue: string;
  autoCode: string | null | undefined;
  brand: string;
  name: string;
  model: string;
  matchedTemplate: MatchedTemplate | null;
  allSuggestedModels: string[];
  catalogBrands: Doc<"catalogs">[];
  onCodeChange: (value: string) => void;
  onBrandChange: (value: string) => void;
  onNameChange: (value: string) => void;
  onModelChange: (value: string) => void;
  onApplyTemplate: (template: MatchedTemplate | null, force: boolean) => void;
}

export function EquipmentIdentityFields({
  isEdit,
  busy,
  codeValue,
  autoCode,
  brand,
  name,
  model,
  matchedTemplate,
  allSuggestedModels,
  catalogBrands,
  onCodeChange,
  onBrandChange,
  onNameChange,
  onModelChange,
  onApplyTemplate,
}: EquipmentIdentityFieldsProps) {
  return (
    <>
      <div className="grid gap-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="eq-code">Código *</Label>
          {!isEdit && (
            <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
              Autogenerado y único
            </span>
          )}
        </div>
        <Input
          id="eq-code"
          value={codeValue}
          onChange={(event) => onCodeChange(event.target.value)}
          placeholder={autoCode ?? "EQ-001"}
          className="font-mono"
          disabled={busy}
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="eq-brand">Marca</Label>
        <AutocompleteInput
          id="eq-brand"
          value={brand}
          onChange={onBrandChange}
          items={catalogBrands}
          kind="brand"
          placeholder="Sony"
          disabled={busy}
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="eq-name">Designación *</Label>
        <Input
          id="eq-name"
          value={name}
          onChange={(event) => onNameChange(event.target.value)}
          placeholder="Cámara de estudio"
          disabled={busy}
        />
      </div>

      <div className="grid gap-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="eq-model">Modelo *</Label>
          {matchedTemplate && (
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                {matchedTemplate.sourceLabel}
              </span>
              <button
                type="button"
                onClick={() => {
                  onApplyTemplate(matchedTemplate, true);
                  toast.success(
                    `Datos cargados desde la plantilla de ${matchedTemplate.name || model}`,
                  );
                }}
                className="text-[11px] font-medium text-signal underline hover:opacity-85"
                title="Cargar datos de la plantilla en los campos"
              >
                (Cargar datos)
              </button>
            </div>
          )}
        </div>
        <Input
          id="eq-model"
          list="eq-models-datalist"
          value={model}
          onChange={(event) => onModelChange(event.target.value)}
          placeholder="HDC-3500"
          className="font-mono"
          disabled={busy}
        />
        <datalist id="eq-models-datalist">
          {allSuggestedModels.map((m) => (
            <option key={m} value={m} />
          ))}
        </datalist>
      </div>
    </>
  );
}
