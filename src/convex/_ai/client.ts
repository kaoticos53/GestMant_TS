import { ConvexError } from "convex/values";
import type { AiChatMessage } from "../../lib/ai";

const DEEPSEEK_TIMEOUT_MS = 25_000;

export interface DeepSeekCallConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  messages: AiChatMessage[];
  maxTokens?: number;
}

/**
 * Cliente HTTP único para la API compatible OpenAI de DeepSeek (texto y visión).
 * Nunca expone la clave API ni el cuerpo completo de errores internos.
 */
export async function callDeepSeekJson(
  config: DeepSeekCallConfig,
): Promise<string> {
  const endpoint = `${config.baseUrl.replace(/\/+$/, "")}/chat/completions`;
  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages: config.messages,
        temperature: 0.1,
        max_tokens: config.maxTokens ?? 900,
        response_format: { type: "json_object" },
      }),
      signal: AbortSignal.timeout(DEEPSEEK_TIMEOUT_MS),
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new ConvexError(
      `No se pudo conectar con el servicio de IA: ${detail}`,
    );
  }

  if (!response.ok) {
    let reason = `HTTP ${response.status}`;
    try {
      const payload = (await response.json()) as {
        error?: { message?: unknown };
      };
      if (typeof payload?.error?.message === "string") {
        reason = payload.error.message.slice(0, 180);
      }
    } catch {
      // Respuesta no JSON
    }
    throw new ConvexError(`El servicio de IA rechazó la petición (${reason}).`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: unknown } }>;
  };
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || content.trim() === "") {
    throw new ConvexError("El servicio de IA devolvió una respuesta vacía.");
  }
  return content;
}
