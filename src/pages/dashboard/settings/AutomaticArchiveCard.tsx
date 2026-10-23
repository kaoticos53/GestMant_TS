import {
  AutomaticArchiveControls,
  AutomaticArchiveHeader,
  formatArchiveFooter,
  useAutomaticArchive,
} from "./automaticArchive";

export function AutomaticArchiveCard() {
  const {
    settings,
    autoMonths,
    autoCutoff,
    pending,
    autoOptions,
    saving,
    running,
    handleSaveSettings,
    handleRunNow,
  } = useAutomaticArchive();

  const enabled = settings?.enabled ?? true;

  return (
    <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
      <AutomaticArchiveHeader
        enabled={enabled}
        isLoading={settings === undefined}
        disabled={settings === undefined || saving}
        onToggle={(checked) =>
          void handleSaveSettings({
            enabled: checked,
            afterMonths: autoMonths,
          })
        }
      />

      <AutomaticArchiveControls
        autoMonths={autoMonths}
        autoOptions={autoOptions}
        disabled={settings === undefined || saving}
        running={running}
        pendingTotal={pending.total}
        onChangeMonths={(months) =>
          void handleSaveSettings({
            enabled,
            afterMonths: months,
          })
        }
        onRunNow={() => void handleRunNow()}
      />

      <p className="mt-3 text-xs text-muted-foreground">
        {formatArchiveFooter(
          enabled,
          autoCutoff,
          settings?.lastRunAt,
          settings?.lastRunArchived,
        )}
      </p>
    </div>
  );
}
