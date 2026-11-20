import type { AiVariableDefinition } from "./types";

/**
 * Catálogo oficial de variables seguras disponibles en prompts y mensajes del chat.
 */
export const AI_VARIABLE_CATALOG: readonly AiVariableDefinition[] = [
  {
    key: "usuario_nombre",
    label: "Nombre del usuario",
    description: "Nombre visible del técnico o administrador que realiza la consulta.",
    scope: "ambos",
    example: "Carlos Pérez",
  },
  {
    key: "usuario_rol",
    label: "Rol del usuario",
    description: "Rol asignado en Pulso Taller (p. ej. Técnico, Responsable, Admin).",
    scope: "ambos",
    example: "Técnico",
  },
  {
    key: "fecha_actual",
    label: "Fecha actual",
    description: "Fecha actual en formato ISO (AAAA-MM-DD).",
    scope: "ambos",
    example: "2026-11-20",
  },
  {
    key: "vista_actual",
    label: "Vista activa",
    description: "Módulo o pestaña desde la que el usuario abrió el asistente.",
    scope: "ambos",
    example: "Incidencias",
  },
  {
    key: "resumen_taller",
    label: "Resumen numérico del taller",
    description: "Contadores actuales de equipos, incidencias, repuestos y compras.",
    scope: "prompt",
    example: "Equipos=48 | Incidencias=12 (abiertas=3)...",
  },
  {
    key: "marcas_conocidas",
    label: "Marcas del catálogo",
    description: "Lista de marcas habituales registradas en el catálogo del taller.",
    scope: "prompt",
    example: "Sony, LG, Philips",
  },
  {
    key: "codigos_barras",
    label: "Códigos de barras locales",
    description: "Códigos 1D/DataMatrix detectados en la foto antes de llamar a visión.",
    scope: "prompt",
    example: "912MAYY5H530",
  },
];

const VARIABLE_TOKEN_RE = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

/**
 * Interpola tokens `{{clave}}` con un mapa de valores seguros.
 * Las variables desconocidas o vacías se sustituyen por cadena vacía.
 */
export function interpolateAiTemplate(
  template: string,
  values: Record<string, string | undefined>,
): string {
  return template.replace(VARIABLE_TOKEN_RE, (_match, rawKey: string) => {
    const val = values[rawKey];
    return typeof val === "string" ? val : "";
  });
}
