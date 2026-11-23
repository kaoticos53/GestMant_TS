import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { SupplierContact, SupplierDetails } from "@/lib/catalogs";
import { Plus, Trash2 } from "lucide-react";

interface SupplierDetailsFieldsProps {
  idPrefix: string;
  details: SupplierDetails;
  onChange: (next: SupplierDetails) => void;
}

/**
 * Campos ampliados exclusivos del catálogo de proveedores: dirección,
 * una o más personas de contacto (con teléfono y correo) y notas.
 */
export function SupplierDetailsFields({
  idPrefix,
  details,
  onChange,
}: SupplierDetailsFieldsProps) {
  const contacts: SupplierContact[] =
    details.contacts && details.contacts.length > 0
      ? details.contacts
      : [{ name: "", phone: "", email: "" }];

  const updateContact = (
    index: number,
    patch: Partial<SupplierContact>,
  ) => {
    const next = contacts.map((contact, i) =>
      i === index ? { ...contact, ...patch } : contact,
    );
    onChange({ ...details, contacts: next });
  };

  const addContact = () => {
    onChange({
      ...details,
      contacts: [...contacts, { name: "", phone: "", email: "" }],
    });
  };

  const removeContact = (index: number) => {
    const next = contacts.filter((_, i) => i !== index);
    onChange({
      ...details,
      contacts:
        next.length > 0 ? next : [{ name: "", phone: "", email: "" }],
    });
  };

  return (
    <>
      <div className="grid gap-2">
        <Label htmlFor={`${idPrefix}-address`}>Dirección</Label>
        <Input
          id={`${idPrefix}-address`}
          value={details.address ?? ""}
          onChange={(e) => onChange({ ...details, address: e.target.value })}
          placeholder="Calle, número, código postal, ciudad..."
        />
      </div>

      <div className="grid gap-2">
        <div className="flex items-center justify-between gap-2">
          <Label>Personas de contacto</Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 gap-1 px-2 text-xs"
            onClick={addContact}
          >
            <Plus className="size-3.5" />
            Añadir contacto
          </Button>
        </div>
        <div className="grid gap-2">
          {contacts.map((contact, index) => (
            <div
              key={index}
              className="grid gap-2 rounded-lg border border-border/70 bg-muted/20 p-2.5"
            >
              <div className="flex items-center gap-2">
                <Input
                  aria-label={`Nombre del contacto ${index + 1}`}
                  value={contact.name}
                  onChange={(e) =>
                    updateContact(index, { name: e.target.value })
                  }
                  placeholder="Nombre de contacto"
                />
                {contacts.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8 shrink-0 text-muted-foreground hover:text-destructive"
                    aria-label={`Quitar contacto ${index + 1}`}
                    onClick={() => removeContact(index)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                )}
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <Input
                  type="tel"
                  aria-label={`Teléfono del contacto ${index + 1}`}
                  value={contact.phone ?? ""}
                  onChange={(e) =>
                    updateContact(index, { phone: e.target.value })
                  }
                  placeholder="Teléfono"
                />
                <Input
                  type="email"
                  aria-label={`Email del contacto ${index + 1}`}
                  value={contact.email ?? ""}
                  onChange={(e) =>
                    updateContact(index, { email: e.target.value })
                  }
                  placeholder="Email"
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor={`${idPrefix}-notes`}>Notas</Label>
        <Textarea
          id={`${idPrefix}-notes`}
          value={details.notes ?? ""}
          onChange={(e) => onChange({ ...details, notes: e.target.value })}
          placeholder="Condiciones, horario de pedidos, nº de cliente..."
          rows={3}
        />
      </div>
    </>
  );
}
