import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  WeeklyReportDialogFooter,
  WeeklyReportHistoryList,
  WeeklyReportPreviewCard,
  WeeklyReportRoleAudience,
  WeeklyReportScheduleFields,
} from "./weeklyReport/components";
import { useWeeklyReportState } from "./weeklyReport/hooks/useWeeklyReportState";

/**
 * Resumen semanal por correo: lo que se trabajó, lo que quedó sin constancia y
 * lo que se archivó. Aquí se enciende, se elige el día y los roles que lo
 * reciben, se ve el correo que saldría y se puede mandar en el momento. El
 * envío automático lo hace el cron del backend el día elegido.
 */
export function WeeklyReportDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const {
    settings,
    roleOptions,
    preview,
    history,
    enabled,
    weekday,
    roleKeys,
    recipients,
    saving,
    sending,
    setEnabled,
    setWeekday,
    toggleRole,
    handleSave,
    handleSend,
  } = useWeeklyReportState(open);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Resumen semanal del taller</DialogTitle>
          <DialogDescription>
            Un correo a la semana con lo que se trabajó, lo que lleva días en
            curso sin que su técnico anote nada y lo que se fue al archivo. Sale
            solo el día que elijas; desde aquí también puedes mandarlo ahora.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <WeeklyReportScheduleFields
            enabled={enabled}
            weekday={weekday}
            disabled={settings === undefined}
            onEnabledChange={setEnabled}
            onWeekdayChange={setWeekday}
          />

          <WeeklyReportRoleAudience
            roleOptions={roleOptions}
            roleKeys={roleKeys}
            recipients={recipients}
            lastSentAt={settings?.lastSentAt}
            saving={saving}
            onToggleRole={toggleRole}
          />

          <WeeklyReportPreviewCard preview={preview} />

          <WeeklyReportHistoryList history={history} />
        </div>

        <WeeklyReportDialogFooter
          sending={sending}
          saving={saving}
          settingsLoaded={settings !== undefined}
          rolesLoaded={roleOptions !== undefined}
          onClose={() => onOpenChange(false)}
          onSendNow={() => void handleSend()}
          onSave={() => void handleSave()}
        />
      </DialogContent>
    </Dialog>
  );
}
