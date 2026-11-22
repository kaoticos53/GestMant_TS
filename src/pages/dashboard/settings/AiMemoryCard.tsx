import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Brain, Database, Mail, Plus, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/convex/_generated/api";
import { getErrorMessage } from "@/lib/workshop";

/**
 * Gestión de la memoria unificada de la IA (índice RAG compacto + hechos de largo plazo).
 */
export function AiMemoryCard() {
  const stats = useQuery(api.aiMemory.memoryStats, {});
  const facts = useQuery(api.aiMemory.listFacts, {});
  const rebuildWorkshop = useMutation(api.aiMemory.rebuildWorkshopIndex);
  const rebuildMailbox = useMutation(api.aiMemory.rebuildMyMailboxIndex);
  const saveFact = useMutation(api.aiMemory.saveFact);
  const deleteFact = useMutation(api.aiMemory.deleteFact);

  const [rebuilding, setRebuilding] = useState(false);
  const [rebuildingMail, setRebuildingMail] = useState(false);
  const [title, setTitle] = useState("");
  const [factText, setFactText] = useState("");
  const [savingFact, setSavingFact] = useState(false);

  const handleRebuild = async () => {
    setRebuilding(true);
    try {
      const res = await rebuildWorkshop({});
      toast.success(
        `Memoria del taller reindexada: ${res.indexed} fragmentos compactos.`,
      );
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setRebuilding(false);
    }
  };

  const handleRebuildMailbox = async () => {
    setRebuildingMail(true);
    try {
      const res = await rebuildMailbox({});
      toast.success(
        `Correos indexados en tu memoria privada: ${res.indexed} mensajes.`,
      );
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setRebuildingMail(false);
    }
  };

  const handleAddFact = async () => {
    if (!title.trim() || !factText.trim()) {
      toast.error("Completa el título y el detalle del hecho.");
      return;
    }
    setSavingFact(true);
    try {
      await saveFact({
        title: title.trim(),
        fact: factText.trim(),
        module: "general",
        active: true,
      });
      setTitle("");
      setFactText("");
      toast.success("Hecho guardado en la memoria de la IA.");
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSavingFact(false);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <Brain className="size-4 text-primary" />
            Memoria unificada de la IA
          </CardTitle>
          <CardDescription>
            Índice compacto de incidencias, equipos, repuestos y manuales para
            búsquedas rápidas con menor consumo de tokens.
          </CardDescription>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            disabled={rebuildingMail}
            onClick={() => void handleRebuildMailbox()}
          >
            <Mail className="size-3.5" />
            {rebuildingMail ? "Indexando correos..." : "Indexar mis correos"}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            disabled={rebuilding}
            onClick={() => void handleRebuild()}
          >
            <RefreshCw
              className={`size-3.5 ${rebuilding ? "animate-spin" : ""}`}
            />
            {rebuilding ? "Indexando..." : "Indexar todo el taller"}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border bg-muted/20 p-3">
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Database className="size-3.5" />
              Fragmentos del taller
            </span>
            <p className="mt-1 text-xl font-bold tabular-nums">
              {stats ? stats.workshopChunks : "—"}
            </p>
          </div>
          <div className="rounded-lg border bg-muted/20 p-3">
            <span className="text-xs text-muted-foreground">
              Fragmentos de correo
            </span>
            <p className="mt-1 text-xl font-bold tabular-nums">
              {stats ? stats.mailboxChunks : "—"}
            </p>
          </div>
          <div className="rounded-lg border bg-muted/20 p-3">
            <span className="text-xs text-muted-foreground">
              Hechos aprendidos activos
            </span>
            <p className="mt-1 text-xl font-bold tabular-nums">
              {stats ? stats.factsCount : "—"}
            </p>
          </div>
        </div>

        <div className="space-y-3 rounded-lg border border-border/70 p-3.5">
          <div>
            <h3 className="text-sm font-medium">
              Hechos de largo plazo del taller
            </h3>
            <p className="text-xs text-muted-foreground">
              Conocimiento operativo permanente que la IA prioriza al responder
              (p. ej. particularidades de equipos o proveedores).
            </p>
          </div>

          <div className="grid gap-2 sm:grid-cols-[1fr_2fr_auto]">
            <div className="grid gap-1">
              <Label htmlFor="ai-fact-title" className="text-xs">
                Título breve
              </Label>
              <Input
                id="ai-fact-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ej. Proveedor HidraMax"
                className="h-8 text-xs"
              />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="ai-fact-text" className="text-xs">
                Detalle del hecho
              </Label>
              <Input
                id="ai-fact-text"
                value={factText}
                onChange={(e) => setFactText(e.target.value)}
                placeholder="Ej. Los filtros HF tardan 5 días hábiles."
                className="h-8 text-xs"
              />
            </div>
            <div className="flex items-end">
              <Button
                type="button"
                size="sm"
                className="h-8 gap-1 text-xs"
                disabled={savingFact}
                onClick={() => void handleAddFact()}
              >
                <Plus className="size-3.5" />
                Añadir
              </Button>
            </div>
          </div>

          {facts && facts.length > 0 && (
            <ul className="divide-y rounded-md border">
              {facts.map((fact) => (
                <li
                  key={fact._id}
                  className="flex items-start justify-between gap-3 px-3 py-2 text-xs"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold">{fact.title}</span>
                      <Badge variant="outline" className="text-[10px]">
                        {fact.module}
                      </Badge>
                    </div>
                    <p className="mt-0.5 text-muted-foreground">{fact.fact}</p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-7 shrink-0 text-muted-foreground hover:text-destructive"
                    aria-label={`Eliminar hecho ${fact.title}`}
                    onClick={() => void deleteFact({ id: fact._id })}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
