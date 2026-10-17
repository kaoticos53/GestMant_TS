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
import { looksLikeEmail } from "@/lib/incidentMail";
import { formatPublicCode } from "@/lib/publicCode";
import { richDocToPlainText, richDocToStore } from "@/lib/richDoc";
import { MAX_FILE_SIZE_LABEL, MAX_REPORT_IMAGES } from "@/lib/upload";
import { getErrorMessage } from "@/lib/workshop";
import logo from "@/assets/logo.svg";
import { useMutation, useQuery } from "convex/react";
import { useAuth } from "@/hooks/use-auth";
import { ArrowRight, Check, Home, Loader2, Siren, UserCheck } from "lucide-react";
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
  const { user, isAuthenticated } = useAuth();
  const report = useMutation(api.incidents.report);
  const inventoryModels = useQuery(api.equipment.uniqueModels, {}) ?? [];

  // Lo que la persona ha escrito en cada campo de contacto (`null` = sin tocar).
  // Su perfil llega después de pintar la página, así que lo que enseña el campo
  // se deriva aquí: no se copia a un estado que se quedaría con la primera
  // versión y no habría forma de vaciar del todo.
  const [name, setName] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [location, setLocation] = useState<string | null>(null);
  const nameValue = name ?? user?.name ?? "";
  const emailValue = email ?? user?.email ?? "";
  const roleValue = role ?? user?.position ?? "";
  const locationValue = location ?? user?.location ?? "";
  const [equipmentKind, setEquipmentKind] = useState("");
  const [model, setModel] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [reportedAt, setReportedAt] = useState(TODAY_INPUT);
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // El código con el que se sigue el caso: lo único que se lleva quien notifica
  // (la referencia interna se queda en el taller).
  const [code, setCode] = useState<string | null>(null);
  // Y el correo al que se le ha mandado: se le dice que va en camino, para que
  // no dependa de haber copiado el código de esta pantalla.
  const [sentTo, setSentTo] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const timestamp = fromDateInputValue(reportedAt);
    if (!nameValue.trim()) {
      setError("Indica tu nombre y apellidos.");
      return;
    }
    // El correo es opcional, pero si se escribe tiene que servir para
    // responderle: más vale decirlo aquí, cuando se puede corregir, que
    // descubrirlo cuando el aviso ya no llega a nadie.
    const reporterEmail = emailValue.trim().toLowerCase();
    if (reporterEmail && !looksLikeEmail(reporterEmail)) {
      setError("Ese correo no parece una dirección válida. Revísalo o déjalo en blanco.");
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
        reporterName: nameValue.trim(),
        reporterEmail: reporterEmail || undefined,
        reporterRole: roleValue.trim() || undefined,
        location: locationValue.trim() || undefined,
        equipmentKind: equipmentKind.trim() || undefined,
        model: model.trim() || undefined,
        serialNumber: serialNumber.trim() || undefined,
        // El editor ya entrega el documento listo; `richDocToStore` lo deja tal
        // cual (y quita el hueco vacío si no se escribió nada).
        description: richDocToStore(description) ?? "",
        reportedAt: timestamp,
      });
      setCode(created.code);
      setSentTo(reporterEmail || null);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setCode(null);
    setSentTo(null);
    setName(null);
    setEmail(null);
    setRole(null);
    setLocation(null);
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
        {code ? (
          <Card className="shadow-md">
            <CardHeader className="text-center">
              <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-emerald-600/10 text-emerald-700">
                <Check className="size-6" />
              </span>
              <CardTitle className="text-xl">
                Incidencia {formatPublicCode(code)} registrada
              </CardTitle>
              <CardDescription>
                Gracias, {nameValue.split(" ")[0]}. El equipo coordinador del
                taller ha recibido tu aviso y se pondrá manos a la obra.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {/* El código es lo único que hace falta para seguir el caso: se
                  enseña para copiarlo, no escondido en un rincón. */}
              <div className="rounded-lg border border-border/70 bg-muted/50 p-3 text-center">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Tu código
                </p>
                <p className="mt-1 select-all font-mono text-lg font-semibold tracking-tight">
                  {formatPublicCode(code)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Guárdalo: con él se sigue el caso. Entrando como invitado
                  puedes ver en qué punto va, sin cuenta del taller.
                </p>
              </div>
              {sentTo && (
                <p className="text-center text-xs text-muted-foreground">
                  También va en camino a {sentTo}: allí tienes el código y el
                  enlace para seguir el caso cuando quieras.
                </p>
              )}
              <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
                <Button asChild className="gap-2">
                  <Link to={`/seguimiento?codigo=${encodeURIComponent(code)}`}>
                    Seguir esta incidencia
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
                <Button variant="outline" onClick={reset}>
                  Reportar otra incidencia
                </Button>
                <Button variant="ghost" asChild>
                  <Link to="/">Volver al inicio</Link>
                </Button>
              </div>
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
              <form onSubmit={handleSubmit} className="flex flex-col gap-6">
                {isAuthenticated && user && (
                  <div className="flex items-center gap-2.5 rounded-lg border border-signal/25 bg-signal/10 px-3.5 py-2.5 text-xs text-foreground">
                    <UserCheck className="size-4 shrink-0 text-signal" />
                    <span>
                      Sesión iniciada: datos de contacto autocompletados desde tu perfil (
                      <strong className="font-semibold">{user.name || user.email}</strong>). Puedes modificarlos si lo requieres.
                    </span>
                  </div>
                )}

                {/* Bloque 1: Datos de quien notifica */}
                <div className="grid gap-4 sm:grid-cols-2 items-start">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="inc-name">Nombre y apellidos *</Label>
                    <Input
                      id="inc-name"
                      value={nameValue}
                      onChange={(event) => setName(event.target.value)}
                      placeholder="Sandra Ruiz"
                      autoComplete="name"
                      disabled={busy}
                      required
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="inc-email">Correo electrónico</Label>
                    <Input
                      id="inc-email"
                      type="email"
                      value={emailValue}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="p. ej. sandra.ruiz@taller.es"
                      autoComplete="email"
                      disabled={busy}
                    />
                    <p className="text-xs text-muted-foreground">
                      Si lo dejas, te avisamos cuando el caso cambie de estado.
                    </p>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="inc-role">Puesto</Label>
                    <Input
                      id="inc-role"
                      value={roleValue}
                      onChange={(event) => setRole(event.target.value)}
                      placeholder="p. ej. Realización"
                      disabled={busy}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="inc-location">Ubicación</Label>
                    <Input
                      id="inc-location"
                      value={locationValue}
                      onChange={(event) => setLocation(event.target.value)}
                      placeholder="p. ej. Plató 2"
                      disabled={busy}
                    />
                  </div>
                </div>

                {/* Bloque 2: Equipo y notificación */}
                <div className="grid gap-4 sm:grid-cols-2 items-start">
                  <div className="flex flex-col gap-1.5">
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
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="inc-kind">Tipo de equipo</Label>
                    <Input
                      id="inc-kind"
                      value={equipmentKind}
                      onChange={(event) => setEquipmentKind(event.target.value)}
                      placeholder="p. ej. Cámara de estudio"
                      disabled={busy}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="inc-model">Modelo</Label>
                    <Input
                      id="inc-model"
                      list="incident-models-datalist"
                      value={model}
                      onChange={(event) => setModel(event.target.value)}
                      placeholder="p. ej. HDC-3500"
                      className="font-mono"
                      disabled={busy}
                    />
                    <datalist id="incident-models-datalist">
                      {inventoryModels.map((m) => (
                        <option key={m} value={m} />
                      ))}
                    </datalist>
                  </div>
                  <div className="flex flex-col gap-1.5">
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

                {/* Bloque 3: Descripción ocupando todo el ancho de la ficha */}
                <div className="grid w-full gap-2">
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
                  Recibirás un código para seguir el caso desde fuera del
                  taller. Si dejas tu correo, te lo enviamos ahí y te avisamos
                  de cada cambio de estado.
                </p>
              </form>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
