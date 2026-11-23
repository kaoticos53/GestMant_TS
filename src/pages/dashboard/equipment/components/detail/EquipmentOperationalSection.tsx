import { useState } from "react";
import { useMutation } from "convex/react";
import { ArrowRightLeft, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { api } from "@/convex/_generated/api";
import {
  EQUIPMENT_OPERATIONAL_META,
  resolveOperationalState,
} from "@/lib/movements";
import { getErrorMessage, formatDate, formatDateTime } from "@/lib/workshop";
import { EquipmentLoanDialog } from "../../dialogs/EquipmentLoanDialog";
import type { EquipmentDoc } from "../../types";

interface EquipmentOperationalSectionProps {
  item: EquipmentDoc;
  canManage: boolean;
}

/**
 * Muestra el estado operativo del equipo y gestiona el préstamo temporal
 * (alta de préstamo y registro de devolución).
 */
export function EquipmentOperationalSection({
  item,
  canManage,
}: EquipmentOperationalSectionProps) {
  const returnLoan = useMutation(api.equipment.returnLoan);
  const [loanDialogOpen, setLoanDialogOpen] = useState(false);
  const [returning, setReturning] = useState(false);

  const opState = resolveOperationalState(item);
  const meta = EQUIPMENT_OPERATIONAL_META[opState];
  const loan = item.currentLoan;

  async function handleReturnLoan() {
    setReturning(true);
    try {
      await returnLoan({ id: item._id });
      toast.success("Devolución de equipo registrada.");
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setReturning(false);
    }
  }

  return (
    <>
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 py-3">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground">
                Estado operativo
              </span>
              <Badge variant="outline" className={meta.badgeClassName}>
                {meta.label}
              </Badge>
            </div>
            {loan && (
              <div className="text-xs text-muted-foreground space-y-0.5">
                <p>
                  Prestado a{" "}
                  <span className="font-medium text-foreground">
                    {loan.borrowerName}
                  </span>
                  {loan.location ? ` · Ubicación: ${loan.location}` : ""}
                </p>
                <p>
                  Desde {formatDateTime(loan.loanedAt)}
                  {loan.expectedReturnAt !== undefined
                    ? ` · Devolución prevista: ${formatDate(loan.expectedReturnAt)}`
                    : ""}
                </p>
                {loan.notes && <p className="italic">{loan.notes}</p>}
              </div>
            )}
          </div>

          {canManage && item.decommissionDate === undefined && (
            <div>
              {loan ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleReturnLoan}
                  disabled={returning}
                  className="gap-1.5"
                >
                  <RotateCcw className="size-3.5" />
                  {returning ? "Registrando..." : "Registrar devolución"}
                </Button>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setLoanDialogOpen(true)}
                  className="gap-1.5"
                >
                  <ArrowRightLeft className="size-3.5" />
                  Prestar equipo
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {loanDialogOpen && (
        <EquipmentLoanDialog
          item={item}
          onClose={() => setLoanDialogOpen(false)}
        />
      )}
    </>
  );
}
