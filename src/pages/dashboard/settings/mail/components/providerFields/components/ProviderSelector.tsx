import { Label } from "@/components/ui/label";
import { MAIL_PROVIDER_OPTIONS } from "@/lib/mail";
import { cn } from "@/lib/utils";
import type { ProviderSelectorProps } from "../types";

export function ProviderSelector({
  provider,
  saving,
  onChangeProvider,
}: ProviderSelectorProps) {
  return (
    <div className="mt-4 grid gap-2">
      <Label className="text-sm">Servicio de envío</Label>
      <div
        className="grid gap-2 sm:grid-cols-2"
        role="radiogroup"
        aria-label="Servicio de envío"
      >
        {MAIL_PROVIDER_OPTIONS.map((option) => {
          const active = option.id === provider;
          return (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={saving}
              onClick={() => onChangeProvider(option.id)}
              className={cn(
                "rounded-lg border p-3 text-left transition-colors",
                active
                  ? "border-primary bg-primary/5"
                  : "border-border/70 hover:bg-muted/40",
              )}
            >
              <p className="text-sm font-medium">{option.label}</p>
              <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
                {option.summary}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
