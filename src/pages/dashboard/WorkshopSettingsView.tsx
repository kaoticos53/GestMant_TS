import { AuditAlertSettingsCard } from "./settings/AuditAlertSettingsCard";
import { AutomaticArchiveCard } from "./settings/AutomaticArchiveCard";
import { CatalogsCard } from "./settings/CatalogsCard";
import { MailAudienceCard } from "./settings/MailAudienceCard";
import { MailServerCard } from "./settings/MailServerCard";
import { StorageCleanupCard } from "./settings/StorageCleanupCard";
import { TrashCard } from "./settings/TrashCard";
import { UnusedUploadsCard } from "./settings/UnusedUploadsCard";
import { WorkAlertSettingsCard } from "./settings/WorkAlertSettingsCard";
import { WorkshopDataCard } from "./settings/WorkshopDataCard";

/**
 * Ajustes del taller: los ajustes de fondo que decide quien los gobierna, en
 * una sola pantalla. Antes vivían repartidos —el archivado automático dentro
 * del módulo Archivo, el aviso de trabajo sin constancia en un diálogo de la
 * cabecera y los avisos del expediente sin poder ajustarse—, así que quien
 * venía a configurar el taller tenía que saber en qué módulo estaba cada cosa.
 *
 * Aquí solo se ajusta, no se trabaja: el módulo Archivo sigue siendo donde se
 * busca lo archivado y se manda al archivo a mano, el aviso de trabajo sigue
 * saliendo en el panel y los avisos del expediente, en el avisador. Cada
 * tarjeta se enseña solo a quien puede configurarla.
 */
export function WorkshopSettingsView({
  canManageArchive = false,
  canManageAlert = false,
  canManageAudit = false,
  canPurgeUploads = false,
  canManageData = false,
  canManageMail = false,
}: {
  /** Quien coordina incidencias o decide peticiones ajusta el archivo. */
  canManageArchive?: boolean;
  /** Quien coordina las incidencias ajusta el aviso de trabajo sin constancia. */
  canManageAlert?: boolean;
  /** Quien audita el expediente reparte sus avisos entre los roles. */
  canManageAudit?: boolean;
  /**
   * Quien gobierna el taller mira —y purga— lo que la noche va a barrer del
   * formulario, y ve la limpieza del almacén entera con su botón.
   */
  canPurgeUploads?: boolean;
  /**
   * Quien puede gestionar el inventario carga la muestra y vacía el taller: es
   * el permiso con el que se puso la muestra de ejemplo.
   */
  canManageData?: boolean;
  /**
   * El correo del taller lo configura —y lo prueba— el administrador: es una
   * llave del deployment y un remitente los dos, no una preferencia de cada rol.
   */
  canManageMail?: boolean;
}) {
  return (
    <div className="flex flex-col gap-5">
      {canManageMail && <MailServerCard />}
      {canManageMail && <MailAudienceCard />}
      {canManageArchive && <AutomaticArchiveCard />}
      {canPurgeUploads && <UnusedUploadsCard />}
      {canPurgeUploads && <TrashCard />}
      {canPurgeUploads && <StorageCleanupCard />}
      {canManageAlert && <WorkAlertSettingsCard />}
      {canManageAudit && <AuditAlertSettingsCard />}
      {canManageData && <WorkshopDataCard />}
      <CatalogsCard />
      <p className="text-xs leading-5 text-muted-foreground">
        Estas son las reglas de fondo del taller. El día a día —buscar en el
        archivo, recuperar lo archivado, trabajar las incidencias— sigue en sus
        módulos.
      </p>
    </div>
  );
}
