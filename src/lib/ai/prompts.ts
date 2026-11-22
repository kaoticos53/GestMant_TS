import { AI_MAX_BARCODE_HINTS } from "./limits";
import type {
  AiChatMessage,
  AiTaskId,
  IncidentContextItem,
  WorkshopChatTurn,
  WorkshopContextSnapshot,
} from "./types";
import { interpolateAiTemplate } from "./variables";

/**
 * Prompts editables por defecto para cada tarea de IA (sin el bloque JSON protegido).
 */
export const DEFAULT_AI_PROMPTS: Record<AiTaskId, string> = {
  label_scanner: [
    "Eres un asistente técnico experto en lectura de etiquetas de equipos audiovisuales, electrónicos, informáticos y médicos.",
    "Extrae de la imagen únicamente datos visibles con precisión.",
    "1. La etiqueta puede estar rotada 90°/180°, ser bilingüe o tener una pegatina aparte para el S/N.",
    "2. Reconoce abreviaturas como MODEL, MODEL NO, MODEL NAME, REF, P/N para modelo, y SERIAL NO, S/N, SN, SERIAL, (21) UDI para número de serie.",
    "3. NO confundas con modelo ni número de serie códigos de certificación o red como UL (E329824, E193791), R43036, CE, RoHS, TÜV, FCC, LAN MAC, MAC, fechas de fabricación/calibración ni voltajes/amperajes.",
    "4. Si hay más de un identificador de modelo posible (p. ej. MODEL NAME y MODEL NO), pon el más representativo en `model` y los demás en `alternatives`.",
    "5. Si algún campo no aparece en la etiqueta (por ejemplo, fuentes de alimentación sin número de serie), devuélvelo como null y añade una nota breve en `warnings`.",
    "6. En `technicalDetails`, incluye una lista breve con otros datos técnicos útiles visibles en la etiqueta (p. ej. alimentación entrada/salida, potencia en W, frecuencia, fecha o país de fabricación, especificaciones de hardware).",
    "7. En `evidence`, cita literalmente las líneas clave de la etiqueta de donde extrajiste `model` y `serialNumber`.",
    "8. En `confidence`, usa `high` solo si todos los caracteres leídos están nítidos; `medium` si algún dígito es dudoso o falta un campo; `low` si está borrosa o incompleta.",
  ].join("\n"),
  incident_qa: [
    "Eres el asistente técnico del taller Pulso Taller.",
    "Responde en español claro y conciso basándote EXCLUSIVAMENTE en el listado de incidencias proporcionado.",
    "NO inventes incidencias, piezas, fechas ni referencias. Si no hay datos suficientes en el contexto, dilo claramente.",
  ].join("\n"),
  workshop_chat: [
    "Eres el asistente IA integral de Pulso Taller (gestión de equipos, mantenimientos, incidencias, inventario de repuestos, peticiones de repuestos, compras y manuales).",
    "Responde en español claro, directo y útil basándote EXCLUSIVAMENTE en los datos proporcionados y en las herramientas de consulta disponibles.",
    "When necesitas detalles que no estén en el resumen inicial, llama a las herramientas de consulta antes de responder.",
    "NO inventes referencias, códigos, cantidades ni fechas. Si un dato no aparece tras consultar, dilo con honestidad.",
  ].join("\n"),
  mail_triage: [
    "Eres el clasificador automático de correos de Pulso Taller.",
    "Asigna de 1 a 2 etiquetas del catálogo permitido según la intención del correo:",
    "- requests: peticiones de material, repuestos, consumibles o referencias.",
    "- incidents: avisos de avería, fallo de equipo, parada o reparación urgente.",
    "- equipment: correos con equipos y números de serie (S/N) susceptibles de alta en inventario.",
    "- purchasing: presupuestos, pedidos de compra (OC), envíos o albaranes.",
    "- external_sat: comunicaciones con servicios técnicos externos o RMAs.",
    "- manuals: manuales PDF, esquemas técnicos o documentación.",
    "- informative: boletines, avisos generales o notificaciones automáticas sin acción.",
    "Si la cabecera y el extracto son ambiguos (p. ej. asunto genérico o falta contexto), marca `needsBody: true` y pon `confidence` por debajo de 0.72.",
  ].join("\n"),
};

/**
 * Contratos JSON técnicos protegidos: siempre se anexan tras el prompt editable
 * para garantizar que los parsers de la aplicación no se rompan.
 */
export const PROTECTED_OUTPUT_CONTRACTS: Record<AiTaskId, string> = {
  label_scanner: [
    "FORMATO DE SALIDA OBLIGATORIO (JSON válido sin texto extra):",
    '{ "brand": string|null, "model": string|null, "serialNumber": string|null, "equipmentKind": string|null, "technicalDetails": string[], "confidence": "high"|"medium"|"low", "evidence": string|null, "alternatives": string[], "warnings": string[] }',
  ].join("\n"),
  incident_qa: [
    "FORMATO DE SALIDA OBLIGATORIO (JSON válido sin texto extra):",
    '{ "answer": string, "citedReferences": string[] }',
    "En `citedReferences` incluye solo las referencias exactas (`INC-XXXX`) mencionadas en tu respuesta.",
  ].join("\n"),
  workshop_chat: [
    "FORMATO DE SALIDA OBLIGATORIO (JSON válido sin texto extra):",
    '{ "answer": string, "citedReferences": string[] }',
    "En `citedReferences` incluye únicamente códigos o referencias exactas devueltas por los datos o herramientas (p. ej. INC-0001, PET-0002, OC-0003, EQ-001 o códigos de repuesto) que menciones en tu respuesta.",
  ].join("\n"),
  mail_triage: [
    "FORMATO DE SALIDA OBLIGATORIO (JSON válido sin texto extra):",
    'Para lotes: { "items": [{ "messageId": string, "tags": string[], "confidence": number, "needsBody": boolean, "reason": string }] }',
    'Para mensaje único: { "tags": string[], "confidence": number, "needsBody": boolean, "reason": string }',
    "Valores permitidos en `tags`: requests, incidents, equipment, purchasing, external_sat, manuals, informative.",
  ].join("\n"),
};

/**
 * Construye los mensajes multimodales para extraer marca, modelo, número de
 * serie y tipo de equipo de una etiqueta técnica o pegatina.
 */
export function buildEquipmentLabelMessages(args: {
  imageDataUrl: string;
  detectedBarcodes?: readonly string[];
  knownBrands?: readonly string[];
  customPrompt?: string;
  variables?: Record<string, string | undefined>;
}): AiChatMessage[] {
  const barcodes = (args.detectedBarcodes ?? [])
    .map((code) => code.trim())
    .filter((code) => code !== "")
    .slice(0, AI_MAX_BARCODE_HINTS);

  const brands = (args.knownBrands ?? [])
    .map((b) => b.trim())
    .filter((b) => b !== "")
    .slice(0, 40);

  const varMap: Record<string, string | undefined> = {
    marcas_conocidas: brands.join(", "),
    codigos_barras: barcodes.join(", "),
    ...args.variables,
  };

  const baseInstructions = args.customPrompt?.trim()
    ? args.customPrompt.trim()
    : DEFAULT_AI_PROMPTS.label_scanner;

  const systemPrompt = `${interpolateAiTemplate(baseInstructions, varMap)}\n\n${PROTECTED_OUTPUT_CONTRACTS.label_scanner}`;

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
  customPrompt?: string;
  variables?: Record<string, string | undefined>;
}): AiChatMessage[] {
  const baseInstructions = args.customPrompt?.trim()
    ? args.customPrompt.trim()
    : DEFAULT_AI_PROMPTS.incident_qa;
  const vars = args.variables ?? {};

  const systemPrompt = `${interpolateAiTemplate(baseInstructions, vars)}\n\n${PROTECTED_OUTPUT_CONTRACTS.incident_qa}`;

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

  const interpolatedQuestion = interpolateAiTemplate(args.question.trim(), vars);

  return [
    { role: "system", content: systemPrompt },
    {
      role: "user",
      content: `Pregunta del técnico:\n${interpolatedQuestion}\n\nHistorial disponible (${args.incidents.length} incidencias):\n${serializedContext}`,
    },
  ];
}

/**
 * Construye los mensajes de chat para el asistente global del taller usando
 * resumen de contadores + prompts/variables personalizables + historial.
 */
export function buildWorkshopChatMessages(args: {
  question: string;
  history?: readonly WorkshopChatTurn[];
  context: WorkshopContextSnapshot;
  customPrompt?: string;
  variables?: Record<string, string | undefined>;
}): AiChatMessage[] {
  const { context } = args;
  const summaryLine = `Equipos=${context.counts.equipment} | Incidencias=${context.counts.incidents} (abiertas/activas=${context.counts.openIncidents}) | Repuestos=${context.counts.spareParts} (bajo mínimo=${context.counts.lowStockParts}) | Peticiones=${context.counts.partRequests} | Órdenes de compra=${context.counts.purchaseOrders}`;

  const varMap: Record<string, string | undefined> = {
    resumen_taller: summaryLine,
    ...args.variables,
  };

  const baseInstructions = args.customPrompt?.trim()
    ? args.customPrompt.trim()
    : DEFAULT_AI_PROMPTS.workshop_chat;

  const systemPrompt = [
    interpolateAiTemplate(baseInstructions, varMap),
    "",
    PROTECTED_OUTPUT_CONTRACTS.workshop_chat,
    "",
    `RESUMEN ACTUAL DEL TALLER: ${summaryLine}`,
  ].join("\n");

  const recentHistory = (args.history ?? [])
    .slice(-6)
    .filter((turn) => turn.content.trim() !== "")
    .map<AiChatMessage>((turn) => ({
      role: turn.role,
      content: turn.content.trim(),
    }));

  const interpolatedQuestion = interpolateAiTemplate(args.question.trim(), varMap);

  return [
    { role: "system", content: systemPrompt },
    ...recentHistory,
    { role: "user", content: interpolatedQuestion },
  ];
}
