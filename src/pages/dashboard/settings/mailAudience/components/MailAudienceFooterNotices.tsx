import { Button } from "@/components/ui/button";

export interface MailAudienceFooterNoticesProps {
  incidentNotice: string;
  weeklyNotice: string;
  saving: boolean;
  onSave: () => void;
}

export function MailAudienceFooterNotices({
  incidentNotice,
  weeklyNotice,
  saving,
  onSave,
}: MailAudienceFooterNoticesProps) {
  return (
    <>
      <div className="mt-3 grid gap-1">
        <p className="text-xs leading-5 text-muted-foreground">
          Aviso a quien notificó: sale siempre a la dirección que se dejó en
          el formulario, en cada paso del caso. No depende de ningún rol.
        </p>
        <p className="text-xs leading-5 text-muted-foreground">
          {incidentNotice}
        </p>
        <p className="text-xs leading-5 text-muted-foreground">
          {weeklyNotice}
        </p>
        <p className="text-xs leading-5 text-muted-foreground">
          Prueba de envío: solo a la dirección que se escribe en «Servidor
          de correo», y solo cuando se pulsa «Enviar prueba».
        </p>
      </div>

      <div className="mt-4 flex justify-end">
        <Button
          type="button"
          disabled={saving}
          onClick={onSave}
        >
          {saving ? "Guardando..." : "Guardar avisos"}
        </Button>
      </div>
    </>
  );
}
