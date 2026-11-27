import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Mail } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import { isActiveJobStatus } from "@/lib/backgroundJobs";
import { getErrorMessage } from "@/lib/workshop";

/**
 * Indexa los correos del propio buzón en la memoria de la IA. Vive con «Mi
 * buzón» porque es personal: lo puede lanzar quien tenga correo, no solo el
 * administrador que gestiona la IA del taller.
 */
export function MailIndexSection() {
  const jobs = useQuery(api.backgroundJobs.listMine, {}) ?? [];
  const rebuildMailbox = useMutation(api.aiMemory.startRebuildMyMailboxIndex);
  const [starting, setStarting] = useState(false);

  const rebuilding =
    starting ||
    jobs.some(
      (job) =>
        job.type === "ai_memory_mailbox" && isActiveJobStatus(job.status),
    );

  const handleRebuild = async () => {
    setStarting(true);
    try {
      const res = await rebuildMailbox({});
      toast.info(
        res.reused
          ? "Ya hay una indexación de correos en curso."
          : "Indexación de correos iniciada en segundo plano.",
      );
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setStarting(false);
    }
  };

  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/60 px-3 py-3">
      <div className="min-w-0">
        <p className="text-sm font-medium">Memoria de la IA</p>
        <p className="text-xs text-muted-foreground">
          Indexa tus correos para que el asistente pueda citarlos al responder.
        </p>
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-1.5"
        disabled={rebuilding}
        onClick={() => void handleRebuild()}
      >
        <Mail className="size-3.5" />
        {rebuilding ? "Indexando correos..." : "Indexar mis correos"}
      </Button>
    </div>
  );
}
