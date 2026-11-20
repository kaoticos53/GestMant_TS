import { ConvexError } from "convex/values";
import type {
  AiChatMessage,
  AiDebugToolTrace,
  AiDebugTraceEntry,
  AiToolCall,
  AiToolDefinition,
} from "../../lib/ai";

const DEEPSEEK_TIMEOUT_MS = 25_000;
const MAX_TOOL_ROUNDS = 5;

export interface DeepSeekCallConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  messages: AiChatMessage[];
  maxTokens?: number;
  temperature?: number;
}

export interface DeepSeekToolCallConfig extends DeepSeekCallConfig {
  tools: readonly AiToolDefinition[];
  executeTool: (name: string, rawArgs: string) => Promise<string>;
  collectDebug?: boolean;
}

interface DeepSeekChoice {
  finish_reason?: unknown;
  message?: {
    content?: unknown;
    reasoning_content?: unknown;
    tool_calls?: unknown;
  };
}

function extractTextContent(content: unknown): string {
  if (typeof content === "string") {
    return content.trim();
  }
  if (Array.isArray(content)) {
    const parts: string[] = [];
    for (const part of content) {
      if (
        part &&
        typeof part === "object" &&
        "text" in part &&
        typeof (part as { text?: unknown }).text === "string"
      ) {
        parts.push((part as { text: string }).text);
      }
    }
    return parts.join("\n").trim();
  }
  return "";
}

function parseToolCalls(raw: unknown): AiToolCall[] {
  if (!Array.isArray(raw)) return [];
  const calls: AiToolCall[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const obj = item as {
      id?: unknown;
      type?: unknown;
      function?: { name?: unknown; arguments?: unknown };
    };
    if (
      typeof obj.id === "string" &&
      typeof obj.function?.name === "string"
    ) {
      calls.push({
        id: obj.id,
        type: "function",
        function: {
          name: obj.function.name,
          arguments:
            typeof obj.function.arguments === "string"
              ? obj.function.arguments
              : "{}",
        },
      });
    }
  }
  return calls;
}

async function postChatCompletion(
  config: DeepSeekCallConfig,
  options: {
    withJsonFormat: boolean;
    tools?: readonly AiToolDefinition[];
  },
): Promise<{
  endpoint: string;
  status: number;
  content: string;
  reasoningContent?: string;
  finishReason: string | null;
  toolCalls: AiToolCall[];
  durationMs: number;
}> {
  const endpoint = `${config.baseUrl.replace(/\/+$/, "")}/chat/completions`;
  const payloadTools = options.tools?.map((t) => ({
    type: t.type,
    function: t.function,
  }));
  const startedAt = Date.now();

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
        temperature: config.temperature ?? 0.1,
        max_tokens: config.maxTokens ?? 1200,
        ...(options.withJsonFormat
          ? { response_format: { type: "json_object" } }
          : {}),
        ...(payloadTools && payloadTools.length > 0
          ? { tools: payloadTools, tool_choice: "auto" }
          : {}),
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
    choices?: DeepSeekChoice[];
  };
  const first = data?.choices?.[0];
  const content = extractTextContent(first?.message?.content);
  const reasoningContent =
    typeof first?.message?.reasoning_content === "string" &&
    first.message.reasoning_content.trim() !== ""
      ? first.message.reasoning_content.trim()
      : undefined;
  const finishReason =
    typeof first?.finish_reason === "string" ? first.finish_reason : null;
  const toolCalls = parseToolCalls(first?.message?.tool_calls);

  return {
    endpoint,
    status: response.status,
    content,
    reasoningContent,
    finishReason,
    toolCalls,
    durationMs: Date.now() - startedAt,
  };
}

/**
 * Cliente HTTP único para la API compatible OpenAI de DeepSeek (texto y visión).
 * Nunca expone la clave API ni el cuerpo completo de errores internos.
 */
export async function callDeepSeekJson(
  config: DeepSeekCallConfig,
): Promise<string> {
  const firstAttempt = await postChatCompletion(config, {
    withJsonFormat: true,
  });
  if (firstAttempt.content !== "") {
    return firstAttempt.content;
  }

  const fallbackAttempt = await postChatCompletion(config, {
    withJsonFormat: false,
  });
  if (fallbackAttempt.content !== "") {
    return fallbackAttempt.content;
  }

  const reasonSuffix = fallbackAttempt.finishReason
    ? ` (motivo: ${fallbackAttempt.finishReason})`
    : "";
  throw new ConvexError(
    `El servicio de IA (${config.model}) devolvió una respuesta vacía${reasonSuffix}. Verifica que el modelo de visión configurado soporte imágenes (p. ej. deepseek-flash).`,
  );
}

/**
 * Ejecuta un bucle de Tool Calling de hasta MAX_TOOL_ROUNDS rondas contra DeepSeek.
 */
export async function callDeepSeekWithTools(
  config: DeepSeekToolCallConfig,
): Promise<{
  content: string;
  usedTools: string[];
  debugTrace?: AiDebugTraceEntry[];
}> {
  const conversation: AiChatMessage[] = [...config.messages];
  const usedTools: string[] = [];
  const debugTrace: AiDebugTraceEntry[] = [];
  const toolNames = config.tools.map((t) => t.function.name);

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const sentMessages = config.collectDebug ? [...conversation] : [];
    const res = await postChatCompletion(
      { ...config, messages: conversation },
      {
        withJsonFormat: config.tools.length === 0,
        tools: config.tools,
      },
    );

    const toolTraces: AiDebugToolTrace[] = [];

    if (res.toolCalls.length > 0) {
      conversation.push({
        role: "assistant",
        content: res.content || null,
        tool_calls: res.toolCalls,
      });

      for (const call of res.toolCalls) {
        if (!usedTools.includes(call.function.name)) {
          usedTools.push(call.function.name);
        }
        const toolResult = await config.executeTool(
          call.function.name,
          call.function.arguments,
        );
        if (config.collectDebug) {
          toolTraces.push({
            name: call.function.name,
            arguments: call.function.arguments,
            resultPreview: toolResult.slice(0, 1200),
          });
        }
        conversation.push({
          role: "tool",
          tool_call_id: call.id,
          content: toolResult,
        });
      }

      if (config.collectDebug) {
        debugTrace.push({
          round: round + 1,
          endpoint: res.endpoint,
          model: config.model,
          temperature: config.temperature ?? 0.1,
          maxTokens: config.maxTokens ?? 1200,
          toolNames,
          messages: sentMessages,
          responseStatus: res.status,
          finishReason: res.finishReason,
          rawContent: res.content,
          ...(res.reasoningContent
            ? { reasoningContent: res.reasoningContent }
            : {}),
          toolCalls: toolTraces,
          durationMs: res.durationMs,
        });
      }
      continue;
    }

    if (config.collectDebug) {
      debugTrace.push({
        round: round + 1,
        endpoint: res.endpoint,
        model: config.model,
        temperature: config.temperature ?? 0.1,
        maxTokens: config.maxTokens ?? 1200,
        toolNames,
        messages: sentMessages,
        responseStatus: res.status,
        finishReason: res.finishReason,
        rawContent: res.content,
        ...(res.reasoningContent
          ? { reasoningContent: res.reasoningContent }
          : {}),
        durationMs: res.durationMs,
      });
    }

    if (res.content !== "") {
      return {
        content: res.content,
        usedTools,
        ...(config.collectDebug ? { debugTrace } : {}),
      };
    }
  }

  const finalContent = await callDeepSeekJson({
    ...config,
    messages: conversation,
  });
  return {
    content: finalContent,
    usedTools,
    ...(config.collectDebug ? { debugTrace } : {}),
  };
}
