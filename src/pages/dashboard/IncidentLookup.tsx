import type { IncidentLookupProps } from "./lookup/types";
import { useIncidentLookup } from "./lookup/hooks/useIncidentLookup";
import { LookupSearchForm } from "./lookup/components/LookupSearchForm";
import { LookupFeedbackAlerts } from "./lookup/components/LookupFeedbackAlerts";
import { TrackingCard } from "./lookup/components/TrackingCard";

/**
 * Seguir una incidencia por su código. Es la puerta de quien la notificó sin ser
 * del taller: al avisar recibe un código —«Tu código: A7K2-QX9M»— y con él ve en
 * qué punto va su caso, sin entrar en la cola del taller ni ver nada de nadie más.
 *
 * Por eso aquí no vale la referencia interna («INC-0004»): es un correlativo, y
 * admitirlo dejaría la cola entera al alcance de quien fuera probando números.
 * Quien la notificó no lo tiene: se le da el código, y el código no se puede
 * adivinar. Si alguien teclea una referencia, se le dice con qué se sigue, en vez
 * de «no encontramos nada» —que sería verdad pero no ayuda—.
 *
 * Lo que enseña lo decide el backend (`incidents.byCode`): el recorte de
 * seguimiento, sin notas internas, documentos ni quién dio cada paso.
 */
export function IncidentLookup({
  className,
  initialCode,
}: IncidentLookupProps) {
  const {
    typed,
    setTyped,
    code,
    tracking,
    arrivedAt,
    failure,
    confusables,
    referenceTyped,
    handleSubmit,
  } = useIncidentLookup(initialCode);

  return (
    <div className={className}>
      <LookupSearchForm
        value={typed}
        onChange={setTyped}
        onSubmit={handleSubmit}
      />

      <LookupFeedbackAlerts
        code={code}
        referenceTyped={referenceTyped}
        confusables={confusables}
        tracking={tracking}
        failure={failure}
      />

      {tracking !== null && tracking !== undefined && (
        <TrackingCard tracking={tracking} arrivedAt={arrivedAt} />
      )}
    </div>
  );
}
