import { Label } from "@/components/ui/label";
import { RichTextEditor } from "@/components/RichTextEditor";
import { MAX_FILE_SIZE_LABEL, MAX_REPORT_IMAGES } from "@/lib/upload";

interface DescriptionFieldProps {
  description: string;
  onDescriptionChange: (value: string) => void;
  disabled: boolean;
}

export function DescriptionField({
  description,
  onDescriptionChange,
  disabled,
}: DescriptionFieldProps) {
  return (
    <div className="grid w-full gap-2">
      <Label htmlFor="inc-description">Descripción de la incidencia *</Label>
      {/* Sin cuenta no hay sesión, así que las fotos van por el
          camino del formulario público: se piden, se suben y se
          acreditan una a una antes de aceptarlas. */}
      <RichTextEditor
        id="inc-description"
        value={description}
        onChange={onDescriptionChange}
        placeholder="¿Qué ha pasado? ¿Desde cuándo? ¿Qué se ha probado?"
        disabled={disabled}
        imageUploads="publicReport"
      />
      <p className="text-xs text-muted-foreground">
        Cuantos más detalles des, antes podrá el técnico traer el material
        adecuado. Puedes acompañar el aviso con hasta {MAX_REPORT_IMAGES} fotos
        de {MAX_FILE_SIZE_LABEL} como máximo cada una: una foto de la incidencia
        ahorra una visita.
      </p>
    </div>
  );
}
