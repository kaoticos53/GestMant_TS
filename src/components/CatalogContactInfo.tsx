import { useQuery } from "convex/react";
import { Mail, MapPin, Phone } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { normalizeCatalogString } from "@/lib/catalogs";

interface CatalogContactInfoProps {
  kind: "supplier" | "externalWorkshop";
  name?: string | null;
  catalogId?: Id<"catalogs"> | null;
  className?: string;
}

/**
 * Muestra la ficha rápida de contacto (dirección, personas, teléfono `tel:` y
 * correo `mailto:`) de un proveedor o empresa externa/SAT a partir del catálogo.
 */
export function CatalogContactInfo({
  kind,
  name,
  catalogId,
  className,
}: CatalogContactInfoProps) {
  const listCatalogs = api.catalogs?.list;
  const items = useQuery(listCatalogs, listCatalogs ? { kind } : "skip");
  if (!items || (!catalogId && !name?.trim())) return null;

  const normalized = name?.trim() ? normalizeCatalogString(name.trim()) : "";
  const entry =
    (catalogId ? items.find((i) => i._id === catalogId) : undefined) ??
    (normalized ? items.find((i) => i.normalized === normalized) : undefined);

  if (!entry) return null;
  const hasDetails =
    Boolean(entry.address) ||
    (entry.contacts !== undefined && entry.contacts.length > 0) ||
    Boolean(entry.notes);
  if (!hasDetails) return null;

  return (
    <div
      className={
        className ??
        "mt-2 grid gap-1.5 rounded-lg border border-border/70 bg-muted/30 p-2.5 text-xs text-muted-foreground"
      }
    >
      {entry.address && (
        <div className="flex items-start gap-1.5">
          <MapPin className="mt-0.5 size-3.5 shrink-0" />
          <span>{entry.address}</span>
        </div>
      )}
      {(entry.contacts ?? []).map((contact, idx) => (
        <div key={idx} className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <span className="font-medium text-foreground">{contact.name}</span>
          {contact.phone && (
            <a
              href={`tel:${contact.phone}`}
              className="inline-flex items-center gap-1 transition-colors hover:text-primary hover:underline"
            >
              <Phone className="size-3 shrink-0" />
              {contact.phone}
            </a>
          )}
          {contact.email && (
            <a
              href={`mailto:${contact.email}`}
              className="inline-flex items-center gap-1 transition-colors hover:text-primary hover:underline"
            >
              <Mail className="size-3 shrink-0" />
              {contact.email}
            </a>
          )}
        </div>
      ))}
      {entry.notes && <p className="italic">{entry.notes}</p>}
    </div>
  );
}
