import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import type { LookupSearchFormProps } from "../types";

/** Formulario para introducir y consultar el código público de seguimiento. */
export function LookupSearchForm({
  value,
  onChange,
  onSubmit,
}: LookupSearchFormProps) {
  return (
    <form
      onSubmit={onSubmit}
      className="flex flex-col gap-2 sm:flex-row sm:items-center"
    >
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="A7K2-QX9M"
        aria-label="Código de la incidencia"
        autoComplete="off"
        spellCheck={false}
        className="font-mono uppercase"
      />
      <Button type="submit" className="shrink-0 gap-2">
        <Search className="size-4" />
        Consultar
      </Button>
    </form>
  );
}
