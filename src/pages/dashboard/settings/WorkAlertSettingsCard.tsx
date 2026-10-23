import { Button } from "@/components/ui/button";
import {
  WorkAlertDaysField,
  WorkAlertHeader,
  WorkAlertRolesList,
  useWorkAlertSettings,
} from "./workAlertSettings";

export function WorkAlertSettingsCard() {
  const {
    settings,
    roleOptions,
    days,
    setDays,
    daysValid,
    value,
    roleKeys,
    audience,
    saving,
    handleToggleRole,
    handleSave,
  } = useWorkAlertSettings();

  const isSaveDisabled =
    saving ||
    settings === undefined ||
    roleOptions === undefined ||
    !daysValid;

  return (
    <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
      <WorkAlertHeader />

      <WorkAlertDaysField
        days={days}
        daysValid={daysValid}
        value={value}
        disabled={settings === undefined || saving}
        onChangeDays={setDays}
      />

      <WorkAlertRolesList
        roleOptions={roleOptions}
        selectedRoleKeys={roleKeys}
        audience={audience}
        saving={saving}
        onToggleRole={handleToggleRole}
      />

      <div className="mt-4 flex justify-end">
        <Button
          type="button"
          disabled={isSaveDisabled}
          onClick={() => void handleSave()}
        >
          {saving ? "Guardando..." : "Guardar aviso"}
        </Button>
      </div>
    </div>
  );
}
