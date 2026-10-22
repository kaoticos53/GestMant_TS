import {
  useWorkshopDataActions,
  WorkshopDataActions,
  WorkshopDataHeader,
  WorkshopResetDialog,
} from "./workshopData";

export function WorkshopDataCard() {
  const {
    seeding,
    seedingPurchasing,
    resetting,
    confirming,
    phrase,
    canVaciar,
    confirmWord,
    setConfirming,
    setPhrase,
    handleSeed,
    handleSeedPurchasing,
    handleReset,
    handleCloseResetDialog,
  } = useWorkshopDataActions();

  return (
    <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
      <WorkshopDataHeader />

      <WorkshopDataActions
        seeding={seeding}
        seedingPurchasing={seedingPurchasing}
        resetting={resetting}
        onSeed={() => void handleSeed()}
        onSeedPurchasing={() => void handleSeedPurchasing()}
        onRequestReset={() => setConfirming(true)}
      />

      <WorkshopResetDialog
        open={confirming}
        phrase={phrase}
        canVaciar={canVaciar}
        resetting={resetting}
        confirmWord={confirmWord}
        onPhraseChange={setPhrase}
        onClose={handleCloseResetDialog}
        onConfirmReset={() => void handleReset()}
      />
    </div>
  );
}
