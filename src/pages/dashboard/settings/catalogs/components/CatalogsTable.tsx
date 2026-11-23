import { DetailTitleButton } from "@/components/DetailTitleButton";
import { ListArea } from "@/components/ListArea";
import { TablePagination } from "@/components/TablePagination";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  hasExtendedContactDetails,
  type CatalogKind as LibCatalogKind,
} from "@/lib/catalogs";
import type { Paging } from "@/lib/pagination";
import { formatDate } from "@/lib/workshop";
import { GitMerge, Mail, MapPin, Pencil, Phone, Trash2 } from "lucide-react";
import type {
  CatalogItemDoc,
  CatalogKind,
  CatalogKindMeta,
  EditingCatalogItem,
  MergingCatalogItem,
} from "../types";

interface CatalogsTableProps {
  meta: CatalogKindMeta;
  filteredItems: CatalogItemDoc[];
  visibleItems: CatalogItemDoc[];
  totalRawCount: number;
  search: string;
  selectedKind: CatalogKind;
  paging: Paging;
  areaRef: (element: HTMLDivElement | null) => void;
  onEditItem: (item: EditingCatalogItem) => void;
  onMergeItem: (item: MergingCatalogItem) => void;
  onDeleteItem: (id: CatalogItemDoc["_id"]) => void;
}


export function CatalogsTable({
  meta,
  filteredItems,
  visibleItems,
  totalRawCount,
  search,
  selectedKind,
  paging,
  areaRef,
  onEditItem,
  onMergeItem,
  onDeleteItem,
}: CatalogsTableProps) {
  const singularLower = meta.singular.toLowerCase();
  const labelLower = meta.label.toLowerCase();
  const isExtendedCatalog = hasExtendedContactDetails(selectedKind);

  const buildEditPayload = (item: CatalogItemDoc): EditingCatalogItem => ({
    id: item._id,
    name: item.name,
    ...(item.kind !== "location" &&
    hasExtendedContactDetails(item.kind as LibCatalogKind)
      ? {
          address: item.address,
          contacts: item.contacts,
          notes: item.notes,
        }
      : {}),
  });

  if (filteredItems.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border/70 p-8 text-center text-xs text-muted-foreground">
        {search ? "No se encontraron coincidencias." : `No hay ${labelLower} todavía.`}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border/70">
      <ListArea
        ref={areaRef}
        resetKey={`${selectedKind}|${paging.page}`}
        maxHeightClass="max-h-[55dvh] min-h-[16rem]"
      >
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-card">
            <TableRow>
              <TableHead>{meta.singular}</TableHead>
              <TableHead className="hidden sm:table-cell">
                {isExtendedCatalog ? "Contacto / Dirección" : "Actualizado"}
              </TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleItems.map((item) => {
              const hasExtendedItem =
                item.kind !== "location" &&
                hasExtendedContactDetails(item.kind as LibCatalogKind);
              const detailsNode = hasExtendedItem ? (
                <div className="flex flex-col gap-0.5 text-[11px] text-muted-foreground">
                  {item.address && (
                    <span className="flex items-center gap-1 truncate">
                      <MapPin className="size-3 shrink-0" />
                      <span className="truncate">{item.address}</span>
                    </span>
                  )}
                  {(item.contacts ?? []).map((contact, idx) => (
                    <span
                      key={idx}
                      className="flex flex-wrap items-center gap-x-2 gap-y-0.5"
                    >
                      <span className="font-medium text-foreground/80">
                        {contact.name}
                      </span>
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
                    </span>
                  ))}
                  {item.notes && (
                    <span className="line-clamp-2 italic">{item.notes}</span>
                  )}
                  {!item.address &&
                    (!item.contacts || item.contacts.length === 0) &&
                    !item.notes && (
                      <span className="italic opacity-70">
                        Sin datos de contacto
                      </span>
                    )}
                </div>
              ) : null;

              return (
                <TableRow key={item._id} className="hover:bg-muted/40">
                  <TableCell className="max-w-[20rem]">
                    <DetailTitleButton
                      onClick={() => onEditItem(buildEditPayload(item))}
                      className="text-xs font-semibold text-foreground"
                    >
                      {item.name}
                    </DetailTitleButton>
                    {detailsNode && (
                      <div className="mt-1 sm:hidden">{detailsNode}</div>
                    )}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell max-w-[24rem]">
                    {hasExtendedItem ? (
                      detailsNode
                    ) : (
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {item.updatedAt
                          ? formatDate(item.updatedAt)
                          : item.normalized}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        aria-label={`Editar ${item.name}`}
                        title="Editar"
                        onClick={() => onEditItem(buildEditPayload(item))}
                      >
                        <Pencil className="size-4 text-muted-foreground" />
                      </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      aria-label={`Fusionar ${item.name}`}
                      title="Fusionar duplicado"
                      onClick={() =>
                        onMergeItem({ id: item._id, name: item.name })
                      }
                    >
                      <GitMerge className="size-4 text-muted-foreground" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8 text-destructive hover:text-destructive"
                      aria-label={`Eliminar ${item.name}`}
                      title="Eliminar"
                      onClick={() => onDeleteItem(item._id)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </ListArea>

      <TablePagination
        paging={paging}
        singular={singularLower}
        plural={labelLower}
        detail={
          search.trim() ? `${totalRawCount} en el catálogo` : undefined
        }
      />
    </div>
  );
}
