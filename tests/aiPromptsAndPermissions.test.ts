import { describe, expect, it } from "vitest";
import {
  AI_VARIABLE_CATALOG,
  DEFAULT_AI_PROMPTS,
  buildWorkshopChatMessages,
  interpolateAiTemplate,
  resolveAllowedAiTools,
  type AiToolModule,
  type WorkshopContextSnapshot,
} from "@/lib/ai";

const EMPTY_CONTEXT: WorkshopContextSnapshot = {
  counts: {
    equipment: 12,
    incidents: 8,
    openIncidents: 3,
    spareParts: 40,
    lowStockParts: 5,
    partRequests: 4,
    purchaseOrders: 2,
  },
  equipment: [],
  incidents: [],
  spareParts: [],
  partRequests: [],
  purchaseOrders: [],
};

describe("AI Variables, Prompts y Permisos (Dominio puro)", () => {
  it("expone el catálogo de variables e interpola plantillas de forma segura", () => {
    expect(AI_VARIABLE_CATALOG.length).toBeGreaterThanOrEqual(6);

    const out = interpolateAiTemplate(
      "Hola {{usuario_nombre}} ({{usuario_rol}}), fecha {{fecha_actual}}, vista {{vista_actual}}, desconocida {{no_existe}}.",
      {
        usuario_nombre: "Carlos",
        usuario_rol: "Técnico",
        fecha_actual: "2026-11-20",
        vista_actual: "Equipos",
      },
    );

    expect(out).toBe(
      "Hola Carlos (Técnico), fecha 2026-11-20, vista Equipos, desconocida .",
    );
  });

  it("mantiene el contrato JSON protegido al aplicar un prompt personalizado", () => {
    const messages = buildWorkshopChatMessages({
      question: "Resumen para {{usuario_nombre}}",
      context: EMPTY_CONTEXT,
      customPrompt: "Responde siempre con tono muy breve para {{usuario_nombre}}.",
      variables: {
        usuario_nombre: "Elena",
        usuario_rol: "Responsable",
        fecha_actual: "2026-11-20",
      },
    });

    const systemContent = String(messages[0]?.content ?? "");
    const userContent = String(messages[messages.length - 1]?.content ?? "");

    expect(systemContent).toContain("Responde siempre con tono muy breve para Elena.");
    expect(systemContent).toContain('"citedReferences"');
    expect(userContent).toBe("Resumen para Elena");
  });

  it("usa el prompt por defecto cuando no hay override personalizado", () => {
    const messages = buildWorkshopChatMessages({
      question: "¿Cómo está el taller?",
      context: EMPTY_CONTEXT,
    });

    const systemContent = String(messages[0]?.content ?? "");
    expect(systemContent).toContain(DEFAULT_AI_PROMPTS.workshop_chat);
  });

  it("filtra herramientas según módulos habilitados y capacidades reales del usuario", () => {
    const enabledModules: AiToolModule[] = [
      "equipment",
      "incidents",
      "purchasing",
      "parts",
      "manuals",
    ];

    const toolsForTechWithoutPurchasing = resolveAllowedAiTools(enabledModules, {
      equipment: true,
      incidents: true,
      requests: true,
      purchasing: false,
      parts: true,
      manuals: false,
    });

    const names = toolsForTechWithoutPurchasing.map((t) => t.function.name);
    expect(names).toContain("get_workshop_stats");
    expect(names).toContain("search_equipment");
    expect(names).toContain("get_equipment_history");
    expect(names).toContain("search_incidents");
    expect(names).toContain("search_spare_parts");
    expect(names).not.toContain("search_purchase_orders");
    expect(names).not.toContain("search_manuals");
    expect(names).not.toContain("search_part_requests");
  });
});
