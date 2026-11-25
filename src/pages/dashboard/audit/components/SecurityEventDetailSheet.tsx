import { ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  formatSecurityMetadataJson,
  securityActionLabel,
  type SecurityAuditEntry,
} from "@/lib/securityAudit";
import { formatDateTime } from "@/lib/workshop";

export interface SecurityEventDetailSheetProps {
  entry: SecurityAuditEntry | null;
  onClose: () => void;
}

export function SecurityEventDetailSheet({
  entry,
  onClose,
}: SecurityEventDetailSheetProps) {
  return (
    <Sheet open={entry !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="flex w-full flex-col gap-0 overflow-y-auto sm:max-w-lg">
        {entry && (
          <>
            <SheetHeader className="space-y-2 border-b pb-4">
              <div className="flex flex-wrap items-center gap-2 pr-6">
                <Badge variant="secondary" className="gap-1.5">
                  <ShieldAlert className="size-3.5" />
                  {entry.action}
                </Badge>
              </div>
              <SheetTitle className="text-left text-lg leading-snug">
                {securityActionLabel(entry.action)}
              </SheetTitle>
              <SheetDescription className="text-left">
                Registrado el {formatDateTime(entry.at)}
              </SheetDescription>
            </SheetHeader>

            <div className="grid min-w-0 gap-5 px-4 py-4 pb-6 sm:px-6 [&>*]:min-w-0">
              <div className="space-y-2 rounded-xl border bg-muted/20 p-3.5 text-xs">
                <div className="min-w-0 break-all">
                  <span className="text-muted-foreground">Actor: </span>
                  <span className="font-medium text-foreground">
                    {entry.actorEmail ?? entry.actorId ?? "Sistema / Público"}
                  </span>
                </div>
                <div className="min-w-0 break-all">
                  <span className="text-muted-foreground">Objetivo: </span>
                  <span className="font-mono text-foreground">{entry.target}</span>
                </div>
              </div>

              <section className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Metadatos del evento
                </h3>
                <pre className="max-h-[50vh] overflow-auto rounded-lg border bg-muted/30 p-3 font-mono text-xs leading-relaxed">
                  {formatSecurityMetadataJson(entry.metadata)}
                </pre>
              </section>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
