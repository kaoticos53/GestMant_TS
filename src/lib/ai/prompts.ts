import { AI_MAX_BARCODE_HINTS } from "./limits";
import type { AiChatMessage, IncidentContextItem } from "./types";

/**
 * Construye los mensajes multimodales para extraer marca, modelo, número de
 * serie y tipo de equipo de una etiqueta técnica o pegatina.
 */
export function buildEquipmentLabelMessages(args: {
  imageDataUrl: string;
  detectedBarcodes?: readonly string[];
  knownBrands?: readonly string[];
}): AiChatMessage[] {
  const barcodes = (args.detectedBarcodes ?? [])
    .map((code) => code.trim())
    .filter((code) => code !== "")
    .slice(0, AI_MAX_BARCODE_HINTS);

  const brands = (args.knownBrands ?? [])
    .map((b) => b.trim())
    .filter((b) => b !== "")
    .slice(0, 40);

  const systemPrompt = [
    "Eres un asistente técnico experto en lectura de etiquetas de equipos audiovisuales, electrónicos, informáticos y médicos.",
    "Extrae de la imagen únicamente datos visibles con precisión y responde SOLO con un objeto JSON válido con esta estructura exacta:",
    '{ "brand": string|null, "model": string|null, "serialNumber": string|null, "equipmentKind": string|null, "confidence": "high"|"medium"|"low", "evidence": string|null, "alternatives": string[], "warnings": string[] }',
    "Reglas estrictas:",
    "1. La etiqueta puede estar rotada 90°/180°, ser bilingüe o tener una pegatina aparte para el S/N.",
    "2. Reconoce abreviaturas como MODEL, MODEL NO, MODEL NAME, REF, P/N para modelo, y SERIAL NO, S/N, SN, SERIAL, (21) UDI para número de serie.",
    "3. NO confundas con modelo ni número de serie códigos de certificación o red como UL (E329824, E193791), R43036, CE, RoHS, TÜV, FCC, LAN MAC, MAC, fechas de fabricación/calibración ni voltajes/amperajes.",
    "4. Si hay más de un identificador de modelo posible (p. ej. MODEL NAME y MODEL NO), pon el más representativo en `model` y los demás en `alternatives`.",
    "5. Si algún campo no aparece en la etiqueta (por ejemplo, fuentes de alimentación sin número de serie), devuélvelo como null y añade una nota breve en `warnings`.",
    "6. En `evidence`, cita literalmente las líneas clave de la etiqueta de donde extrajiste `model` y `serialNumber`.",
    "7. En `confidence`, usa `high` solo si todos los caracteres leídos están nítidos; `medium` si algún dígito es dudoso o falta un campo; `low` si está borrosa o incompleta.",
  ].join("\n");

  const contextLines: string[] = [
    "Analiza esta etiqueta de características y extrae marca, modelo, número de serie y tipo de equipo.",
  ];
  if (barcodes.length > 0) {
    contextLines.push(
      `Códigos de barras leídos localmente en la imagen (úsalos para verificar dígitos dudosos, ignorando MACs o códigos de lote ajenos): ${barcodes.join(", ")}`,
    );
  }
  if (brands.length > 0) {
    contextLines.push(
      `Marcas habituales del taller (si coincide alguna, respeta su grafía): ${brands.join(", ")}`,
    );
  }

  return [
    { role: "system", content: systemPrompt },
    {
      role: "user",
      content: [
        { type: "text", text: contextLines.join("\n") },
        { type: "image_url", image_url: { url: args.imageDataUrl } },
      ],
    },
  ];
}

/**
 * Construye el prompt para responder preguntas sobre historiales de incidencias
 * del taller citando exclusivamente referencias reales proporcionadas.
 */
export function buildIncidentQaMessages(args: {
  question: string;
  incidents: readonly IncidentContextItem[];
}): AiChatMessage[] {
  const systemPrompt = [
    "Eres el asistente técnico del taller Pulso Taller.",
    "Responde en español claro y conciso basándote EXCLUSIVAMENTE en el listado de incidencias proporcionado.",
    "NO inventes incidencias, piezas, fechas ni referencias. Si no hay datos suficientes en el contexto, dilo claramente.",
    'Responde SOLO con un objeto JSON válido: { "answer": string, "citedReferences": string[] }',
    "En `citedReferences` incluye solo las referencias exactas (`INC-XXXX`) mencionadas en tu respuesta.",
  ].join("\n");

  const serializedContext = args.incidents
    .map((inc) => {
      const equip = [inc.equipmentKind, inc.brand, inc.model, inc.serialNumber]
        .filter((v): v is string => Boolean(v && v.trim() !== ""))
        .join(" · ");
      const date = new Date(inc.reportedAt).toISOString().slice(0, 10);
      return [
        `- ${inc.reference} [${inc.status}] (${date})`,
        equip ? `Equipo: ${equip}` : null,
        `Descripción: ${inc.description}`,
        inc.resolutionNote ? `Resolución: ${inc.resolutionNote}` : null,
      ]
        .filter(Boolean)
        .join(" | ");
    })
    .join("\n");

  return [
    { role: "system", content: systemPrompt },
    {
      role: "user",
      content: `Pregunta del técnico:\n${args.question.trim()}\n\nHistorial disponible (${args.incidents.length} incidencias):\n${serializedContext}`,
    },
  ];
}
