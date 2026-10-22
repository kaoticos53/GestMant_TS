import { Skeleton } from "@/components/ui/skeleton";
import {
  MailAudienceFooterNotices,
  MailAudienceHeader,
  MailAudienceMatrixHeader,
  MailAudienceRow,
} from "./mailAudience/components";
import { useMailAudienceState } from "./mailAudience/hooks/useMailAudienceState";

/**
 * Qué correos del taller recibe cada rol.
 *
 * La matriz tiene una columna por cada **origen del correo del taller**, los
 * mismos cuatro de `MAIL_ORIGINS` (`lib/mail`) que apunta el histórico de envíos:
 * el **aviso a quien notificó**, el **aviso interno de una incidencia**, el
 * **resumen semanal** y la **prueba de envío**. Antes solo estaban los dos que se
 * reparten por rol, así que la tarjeta contaba media historia: quien venía a
 * decidir quién recibe qué no veía los dos correos que no se deciden por rol y
 * tenía que deducirlos de la letra pequeña.
 *
 * Las cuatro se enseñan, pero solo dos se tocan:
 * - **El aviso interno de una incidencia** (`mailSettings.incidentRoles`): sale
 *   cuando entra el aviso, cuando se asigna y cuando se cierra.
 * - **El resumen semanal** (`reportSettings.roleKeys`): el mismo ajuste que el
 *   diálogo «Resumen semanal», no una copia; cambiar aquí es cambiar allí.
 * - **El aviso a quien notificó** y la **prueba de envío** tienen destinatario
 *   fijo y se muestran para visibilidad integral sin interruptor.
 */
export function MailAudienceCard() {
  const {
    loading,
    roleOptions,
    incidentKeys,
    weeklyKeys,
    saving,
    toggle,
    handleSave,
    incidentNotice,
    weeklyNotice,
  } = useMailAudienceState();

  return (
    <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
      <MailAudienceHeader />

      {loading ? (
        <div className="mt-4 grid gap-2">
          <Skeleton className="h-11 rounded-lg" />
          <Skeleton className="h-11 rounded-lg" />
          <Skeleton className="h-11 rounded-lg" />
        </div>
      ) : (
        <>
          <MailAudienceMatrixHeader />

          <ul className="mt-1 grid gap-1.5">
            {roleOptions.map((option) => (
              <MailAudienceRow
                key={option.key}
                option={option}
                incidentKeys={incidentKeys}
                weeklyKeys={weeklyKeys}
                saving={saving}
                onToggle={toggle}
              />
            ))}
          </ul>

          <MailAudienceFooterNotices
            incidentNotice={incidentNotice}
            weeklyNotice={weeklyNotice}
            saving={saving}
            onSave={() => void handleSave()}
          />
        </>
      )}
    </div>
  );
}
