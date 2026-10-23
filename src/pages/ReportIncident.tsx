import { ReportIncidentForm } from "./reportIncident/components/ReportIncidentForm";
import { ReportIncidentHeader } from "./reportIncident/components/ReportIncidentHeader";
import { ReportIncidentSuccessCard } from "./reportIncident/components/ReportIncidentSuccessCard";
import { useReportIncidentState } from "./reportIncident/hooks/useReportIncidentState";

/**
 * Vista pública para que cualquier usuario (registrado o no) notifique
 * una incidencia sobre un equipo audiovisual del taller.
 */
export default function ReportIncident() {
  const {
    user,
    isAuthenticated,
    code,
    sentTo,
    nameValue,
    reset,
    busy,
    error,
    connectivity,
    handleSubmit,
    reporterProps,
    equipmentProps,
    descriptionProps,
  } = useReportIncidentState();

  return (
    <div className="min-h-screen bg-background">
      <ReportIncidentHeader />

      <main className="mx-auto flex w-full max-w-2xl flex-col px-4 pb-16 pt-10 sm:px-6">
        {code ? (
          <ReportIncidentSuccessCard
            code={code}
            nameValue={nameValue}
            sentTo={sentTo}
            onReset={reset}
          />
        ) : (
          <ReportIncidentForm
            user={user}
            isAuthenticated={isAuthenticated}
            reporterProps={reporterProps}
            equipmentProps={equipmentProps}
            descriptionProps={descriptionProps}
            error={error}
            busy={busy}
            connectivity={connectivity}
            onSubmit={handleSubmit}
          />
        )}
      </main>
    </div>
  );
}
