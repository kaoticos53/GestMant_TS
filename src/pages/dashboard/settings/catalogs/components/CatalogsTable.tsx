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
import type { Paging } from "@/lib/pagination";
import { GitMerge, Pencil, Trash2 } from "lucide-react";
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
        maxHeightClass="max-h-[calc(100dvh_-_52rem)]"
      >
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-card">
            <TableRow>
              <TableHead>{meta.singular}</TableHead>
              <TableHead className="hidden sm:table-cell">
                Normalizado
              </TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleItems.map((item) => (
              <TableRow key={item._id} className="hover:bg-muted/40">
                <TableCell className="max-w-[24rem]">
                  <span className="block truncate text-xs font-semibold text-foreground">
                    {item.name}
                  </span>
                </TableCell>
                <TableCell className="hidden sm:table-cell font-mono text-[11px] text-muted-foreground">
                  {item.normalized}
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      aria-label={`Editar ${item.name}`}
                      title="Editar nombre"
                      onClick={() =>
                        onEditItem({ id: item._id, name: item.name })
                      }
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
            ))}
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
