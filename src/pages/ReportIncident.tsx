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
import { RichTextEditor } from "@/components/RichTextEditor";
import { api } from "@/convex/_generated/api";
import { richDocToPlainText, richDocToStore } from "@/lib/richDoc";
import { MAX_FILE_SIZE_LABEL, MAX_REPORT_IMAGES } from "@/lib/upload";
import { getErrorMessage } from "@/lib/workshop";
import logo from "@/assets/logo.svg";
import { useMutation } from "convex/react";
import { ArrowRight, Check, Home, Loader2, Siren } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";

/** Timestamp → valor de <input type="date"> (AAAA-MM-DD en hora local). */
function toDateInputValue(timestamp: number): string {
  const d = new Date(timestamp);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Valor de <input type="date"> → timestamp (medianoche local). */
function fromDateInputValue(value: string): number | undefined {
  return value ? new Date(`${value}T00:00:00`).getTime() : undefined;
}

/** Fecha de hoy como valor por defecto (constante a nivel de módulo). */
const TODAY_INPUT = toDateInputValue(Date.now());

export default function ReportIncident() {
  const report = useMutation(api.incidents.report);

  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [location, setLocation] = useState("");
  const [equipmentKind, setEquipmentKind] = useState("");
  const [model, setModel] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [reportedAt, setReportedAt] = useState(TODAY_INPUT);
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reference, setReference] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const timestamp = fromDateInputValue(reportedAt);
    if (!name.trim()) {
      setError("Indica tu nombre y apellidos.");
      return;
    }
    if (!equipmentKind.trim()) {
      setError("Indica el tipo de equipo afectado.");
      return;
    }
    if (!model.trim()) {
      setError("Indica el modelo del equipo.");
      return;
    }
    // El texto que se lee, no las marcas del documento: con formato, un
    // párrafo vacío contaría como escrito.
    if (richDocToPlainText(description).trim().length < 10) {
      setError("Describe la incidencia con un poco más de detalle.");
      return;
    }
    if (timestamp === undefined) {
      setError("Indica la fecha de notificación.");
      return;
    }

    setBusy(true);
    try {
      const created = await report({
        reporterName: name.trim(),
        reporterRole: role.trim() || undefined,
        location: location.trim() || undefined,
        equipmentKind: equipmentKind.trim(),
        model: model.trim(),
        serialNumber: serialNumber.trim() || undefined,
        // El editor ya entrega el documento listo; `richDocToStore` lo deja tal
        // cual (y quita el hueco vacío si no se escribió nada).
        description: richDocToStore(description) ?? "",
        reportedAt: timestamp,
      });
      setReference(created);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setReference(null);
    setName("");
    setRole("");
    setLocation("");
    setEquipmentKind("");
    setModel("");
    setSerialNumber("");
    setReportedAt(TODAY_INPUT);
    setDescription("");
    setError(null);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/60 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2.5">
            <img
              src={logo}
              alt="Pulso Taller"
              className="size-8 rounded-lg ring-1 ring-border"
            />
            <span className="text-sm font-semibold tracking-tight">
              Pulso Taller
            </span>
          </Link>
          <Button asChild variant="ghost" size="sm" className="gap-1.5">
            <Link to="/">
              <Home className="size-3.5" />
              Inicio
            </Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-2xl flex-col px-4 pb-16 pt-10 sm:px-6">
        {reference ? (
          <Card className="shadow-md">
            <CardHeader className="text-center">
              <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-emerald-600/10 text-emerald-700">
                <Check className="size-6" />
              </span>
              <CardTitle className="text-xl">
                Incidencia {reference} registrada
              </CardTitle>
              <CardDescription>
                Gracias, {name.split(" ")[0]}. El equipo coordinador del taller
                ha recibido tu aviso y se pondrá manos a la obra.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 sm:flex-row sm:justify-center">
              <Button variant="outline" onClick={reset}>
                Reportar otra incidencia
              </Button>
              <Button asChild className="gap-2">
                <Link to="/">
                  Volver al inicio
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="shadow-md">
            <CardHeader>
              <div className="flex items-center gap-2.5">
                <span className="flex size-10 items-center justify-center rounded-lg bg-signal/10 text-signal">
                  <Siren className="size-5" />
                </span>
                <div>
                  <CardTitle className="text-xl">
                    Notificar una incidencia
                  </CardTitle>
                  <CardDescription>
                    Avisa de una incidencia en un equipo audiovisual. No
                    necesitas estar registrado.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="grid gap-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="inc-name">Nombre y apellidos *</Label>
                    <Input
                      id="inc-name"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      placeholder="Sandra Ruiz"
                      autoComplete="name"
                      disabled={busy}
                      required
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="inc-role">Puesto</Label>
                    <Input
                      id="inc-role"
                      value={role}
                      onChange={(event) => setRole(event.target.value)}
                      placeholder="p. ej. Realización"
                      disabled={busy}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="inc-location">Ubicación</Label>
                    <Input
                      id="inc-location"
                      value={location}
                      onChange={(event) => setLocation(event.target.value)}
                      placeholder="p. ej. Plató 2"
                      disabled={busy}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="inc-date">Fecha de notificación *</Label>
                    <Input
                      id="inc-date"
                      type="date"
                      value={reportedAt}
                      onChange={(event) => setReportedAt(event.target.value)}
                      disabled={busy}
                      required
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="inc-kind">Tipo de equipo *</Label>
                    <Input
                      id="inc-kind"
                      value={equipmentKind}
                      onChange={(event) => setEquipmentKind(event.target.value)}
                      placeholder="p. ej. Cámara de estudio"
                      disabled={busy}
                      required
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="inc-model">Modelo *</Label>
                    <Input
                      id="inc-model"
                      value={model}
                      onChange={(event) => setModel(event.target.value)}
                      placeholder="p. ej. HDC-3500"
                      className="font-mono"
                      disabled={busy}
                      required
                    />
                  </div>
                  <div className="grid gap-2 sm:col-span-2">
                    <Label htmlFor="inc-serial">Número de serie</Label>
                    <Input
                      id="inc-serial"
                      value={serialNumber}
                      onChange={(event) => setSerialNumber(event.target.value)}
                      placeholder="p. ej. HDC3500-2505-0147"
                      className="font-mono"
                      disabled={busy}
                    />
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="inc-description">
                    Descripción de la incidencia *
                  </Label>
                  {/* Sin cuenta no hay sesión, así que las fotos van por el
                      camino del formulario público: se piden, se suben y se
                      acreditan una a una antes de aceptarlas. */}
                  <RichTextEditor
                    id="inc-description"
                    value={description}
                    onChange={setDescription}
                    placeholder="¿Qué ha pasado? ¿Desde cuándo? ¿Qué se ha probado?"
                    disabled={busy}
                    imageUploads="publicReport"
                  />
                  <p className="text-xs text-muted-foreground">
                    Cuantos más detalles des, antes podrá el técnico traer el
                    material adecuado. Puedes acompañar el aviso con hasta{" "}
                    {MAX_REPORT_IMAGES} fotos de {MAX_FILE_SIZE_LABEL} como
                    máximo cada una: una foto de la incidencia ahorra una
                    visita.
                  </p>
                </div>

                {error && <p className="text-sm text-destructive">{error}</p>}

                <Button type="submit" className="w-full gap-2" disabled={busy}>
                  {busy ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    <>
                      Notificar incidencia
                      <ArrowRight className="size-4" />
                    </>
                  )}
                </Button>
                <p className="text-center text-xs text-muted-foreground">
                  Recibirás el número de referencia para dar seguimiento al
                  caso.
                </p>
              </form>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
