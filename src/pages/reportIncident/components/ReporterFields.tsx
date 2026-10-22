import { Input } from "@/components/ui/input";
import { AutocompleteInput } from "@/components/ui/AutocompleteInput";
import { Label } from "@/components/ui/label";
import type { CatalogItemLike } from "@/lib/catalogs";

interface ReporterFieldsProps {
  nameValue: string;
  onNameChange: (value: string) => void;
  emailValue: string;
  onEmailChange: (value: string) => void;
  roleValue: string;
  onRoleChange: (value: string) => void;
  locationValue: string;
  onLocationChange: (value: string) => void;
  catalogPositions: readonly CatalogItemLike[];
  catalogLocations: readonly CatalogItemLike[];
  disabled: boolean;
}

export function ReporterFields({
  nameValue,
  onNameChange,
  emailValue,
  onEmailChange,
  roleValue,
  onRoleChange,
  locationValue,
  onLocationChange,
  catalogPositions,
  catalogLocations,
  disabled,
}: ReporterFieldsProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 items-start">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="inc-name">Nombre y apellidos *</Label>
        <Input
          id="inc-name"
          value={nameValue}
          onChange={(event) => onNameChange(event.target.value)}
          placeholder="Sandra Ruiz"
          autoComplete="name"
          disabled={disabled}
          required
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="inc-email">Correo electrónico</Label>
        <Input
          id="inc-email"
          type="email"
          value={emailValue}
          onChange={(event) => onEmailChange(event.target.value)}
          placeholder="p. ej. sandra.ruiz@taller.es"
          autoComplete="email"
          disabled={disabled}
        />
        <p className="text-xs text-muted-foreground">
          Si lo dejas, te avisamos cuando el caso cambie de estado.
        </p>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="inc-role">Puesto</Label>
        <AutocompleteInput
          id="inc-role"
          value={roleValue}
          onChange={onRoleChange}
          items={catalogPositions}
          kind="position"
          placeholder="p. ej. Realización"
          disabled={disabled}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="inc-location">Ubicación</Label>
        <AutocompleteInput
          id="inc-location"
          value={locationValue}
          onChange={onLocationChange}
          items={catalogLocations}
          kind="equipmentLocation"
          placeholder="p. ej. Plató 2"
          disabled={disabled}
        />
      </div>
    </div>
  );
}
