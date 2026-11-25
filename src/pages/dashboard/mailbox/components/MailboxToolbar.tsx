import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  MAIL_SORT_LABELS,
  type MailSortDirection,
  type MailSortField,
} from "@/lib/mailClient/listView";
import {
  MAIL_TAG_IDS,
  MAIL_TAG_META,
  type MailTagId,
} from "@/lib/mailClient/tagging";
import { cn } from "@/lib/utils";
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  Loader2,
  MessagesSquare,
  RefreshCw,
  Search,
  Sparkles,
} from "lucide-react";
import type { RefObject } from "react";
import { countLabel } from "../helpers";
import type { MailboxFolder } from "../types";

export function MailboxToolbar({
  activeFolder,
  total,
  unread,
  loadingHeaders,
  sortBy,
  onSortByChange,
  sortDir,
  onToggleSortDir,
  groupByConversation,
  onToggleGroupByConversation,
  tagging,
  taggingCount,
  onAutoTag,
  search,
  onSearchChange,
  searchInputRef,
  syncing,
  onSync,
  tagFilter,
  onTagFilterChange,
  onBackToFolders,
}: {
  activeFolder: MailboxFolder;
  total: number;
  unread: number;
  loadingHeaders: boolean;
  sortBy: MailSortField;
  onSortByChange: (value: MailSortField) => void;
  sortDir: MailSortDirection;
  onToggleSortDir: () => void;
  groupByConversation: boolean;
  onToggleGroupByConversation: () => void;
  tagging: boolean;
  taggingCount: number;
  onAutoTag: () => void;
  search: string;
  onSearchChange: (value: string) => void;
  searchInputRef?: RefObject<HTMLInputElement | null>;
  syncing: boolean;
  onSync: () => void;
  tagFilter: MailTagId | "all";
  onTagFilterChange: (next: MailTagId | "all") => void;
  onBackToFolders: () => void;
}) {
  return (
    <>
      <div className="flex flex-wrap items-center gap-2 border-b border-border/70 px-3 py-2.5 sm:px-4">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="gap-1 lg:hidden"
          onClick={onBackToFolders}
        >
          <ChevronLeft className="size-4" />
          Carpetas
        </Button>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-semibold">{activeFolder.name}</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {loadingHeaders
              ? "Cargando mensajes..."
              : total === 0
                ? "Sin mensajes"
                : `${countLabel(total, "mensaje", "mensajes")}${
                    unread > 0
                      ? ` · ${countLabel(unread, "sin leer", "sin leer")}`
                      : ""
                  }`}
          </p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-1.5 sm:w-auto">
          <Select
            value={sortBy}
            onValueChange={(value) => onSortByChange(value as MailSortField)}
          >
            <SelectTrigger
              className="h-9 w-[135px] text-xs"
              aria-label="Ordenar mensajes por"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(MAIL_SORT_LABELS) as MailSortField[]).map(
                (field) => (
                  <SelectItem key={field} value={field}>
                    {MAIL_SORT_LABELS[field]}
                  </SelectItem>
                ),
              )}
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-9 shrink-0"
            aria-label={
              sortDir === "desc"
                ? "Cambiar a orden ascendente"
                : "Cambiar a orden descendente"
            }
            title={
              sortDir === "desc"
                ? "Orden descendente (clic para ascendente)"
                : "Orden ascendente (clic para descendente)"
            }
            onClick={onToggleSortDir}
          >
            {sortDir === "desc" ? (
              <ArrowDown className="size-3.5" />
            ) : (
              <ArrowUp className="size-3.5" />
            )}
          </Button>
          <Button
            type="button"
            variant={groupByConversation ? "secondary" : "outline"}
            size="sm"
            aria-label="Agrupar por conversaciones"
            aria-pressed={groupByConversation}
            className="h-9 shrink-0 gap-1.5 text-xs"
            onClick={onToggleGroupByConversation}
            title="Agrupar o desagrupar mensajes por conversación"
          >
            <MessagesSquare className="size-3.5" />
            <span className="hidden md:inline">Conversaciones</span>
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-label={
              tagging ? "Etiquetando correos" : "Autoetiquetar correos"
            }
            className="h-9 shrink-0 gap-1.5 text-xs"
            disabled={tagging}
            onClick={onAutoTag}
            title="Clasificar correos sin etiqueta usando reglas rápidas y DeepSeek"
          >
            {tagging ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Sparkles className="size-3.5" />
            )}
            <span className="hidden sm:inline">
              {tagging
                ? taggingCount > 0
                  ? `Etiquetando (${taggingCount})...`
                  : "Etiquetando..."
                : "Autoetiquetar"}
            </span>
          </Button>
          <div className="relative min-w-0 flex-1 sm:w-56 sm:flex-none">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={searchInputRef}
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Buscar asunto o remitente (/)"
              aria-label="Buscar en esta carpeta"
              className="h-9 pl-8"
            />
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-label={
              syncing ? "Sincronizando buzón" : "Sincronizar buzón"
            }
            className="shrink-0 gap-2"
            disabled={syncing}
            onClick={onSync}
          >
            {syncing ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RefreshCw className="size-4" />
            )}
            <span className="hidden sm:inline">
              {syncing ? "Sincronizando..." : "Sincronizar"}
            </span>
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1 border-b border-border/60 bg-muted/15 px-3 py-1.5 sm:px-4">
        <button
          type="button"
          onClick={() => onTagFilterChange("all")}
          className={cn(
            "rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors",
            tagFilter === "all"
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-background text-muted-foreground hover:text-foreground",
          )}
        >
          Todas
        </button>
        {MAIL_TAG_IDS.map((tagId) => {
          const meta = MAIL_TAG_META[tagId];
          const active = tagFilter === tagId;
          return (
            <button
              key={tagId}
              type="button"
              onClick={() =>
                onTagFilterChange(tagFilter === tagId ? "all" : tagId)
              }
              className={cn(
                "rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors",
                active
                  ? meta.badgeClassName
                  : "border-border bg-background text-muted-foreground hover:text-foreground",
              )}
            >
              {meta.label}
            </button>
          );
        })}
      </div>
    </>
  );
}
