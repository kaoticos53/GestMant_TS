/**
 * Sistema de diseño y constantes de ritmo vertical para la portada.
 * Estos valores garantizan consistencia visual y son validados
 * por tests/landingRitmo.test.tsx.
 */

/** Ancho máximo y márgenes laterales de todo el contenido. */
export const CONTENEDOR = "mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8";

/** El aire vertical de un bloque de contenido, igual en todas las secciones. */
export const SECCION = "py-12 sm:py-14 lg:py-20";

/** Escala tipográfica del cuerpo de texto de sección. */
export const TEXTO = "text-sm leading-relaxed text-muted-foreground sm:text-base";

/** Receta de tarjeta de contenido con borde, radio y sombra sutil. */
export const TARJETA = "rounded-2xl border border-border/70 bg-card shadow-xs";

/** Botón principal de llamada a la acción (CTA) con color de texto del tema. */
export const CTA =
  "bg-signal text-primary-foreground hover:bg-signal/90 font-semibold shadow-sm gap-2";

/** Chip de icono que comparten el aviso y el seguimiento. */
export const CHIP =
  "flex size-9 shrink-0 items-center justify-center rounded-lg border border-signal/20 bg-signal/10 text-signal";

/** Etiqueta pequeña tipo badge con acento de señal para cabeceras de sección. */
export const ETIQUETA =
  "inline-flex items-center gap-2 rounded-full border border-signal/30 bg-signal/10 px-2.5 py-1 font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-signal";

/** Rótulo pequeño en mayúsculas de una ficha técnica. */
export const ROTULO =
  "font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-signal";

export interface PasoAviso {
  numero: string;
  titulo: string;
  texto: string;
}

/** Los tres pasos del flujo de aviso público en el taller. */
export const PASOS: readonly PasoAviso[] = [
  {
    numero: "01",
    titulo: "Avisas del equipo",
    texto:
      "Plató, cámara, intercom o sala de sonido: cuentas qué falla en un minuto.",
  },
  {
    numero: "02",
    titulo: "Recibes un código",
    texto:
      "Ocho caracteres para seguir el aviso sin crear cuenta ni contraseña.",
  },
  {
    numero: "03",
    titulo: "El taller responde",
    texto:
      "La incidencia entra en cola con su prioridad y un técnico asignado.",
  },
];
