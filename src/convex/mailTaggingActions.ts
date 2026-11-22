import { ConvexError, v } from "convex/values";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { action, internalAction, type ActionCtx } from "./_generated/server";
import { callDeepSeekJson } from "./_ai/client";
import {
  DEFAULT_AI_PROMPTS,
  PROTECTED_OUTPUT_CONTRACTS,
} from "../lib/ai/prompts";
import type { AiChatMessage } from "../lib/ai/types";
import {
  MAIL_TRIAGE_BODY_THRESHOLD,
  evaluateMailTagRules,
  parseMailTriageBatchResponse,
  parseMailTriageSingleResponse,
  type MailTagRule,
} from "../lib/mailClient/tagging";

const MAX_BATCH_HEADERS = 15;
const MAX_BODY_FALLBACK_PER_RUN = 5;
const MAX_BODY_CHARS = 1500;

interface TriageCandidate {
  messageId: string;
  folderRemoteId: string;
  subject: string;
  fromName: string;
  fromAddress: string;
  toSummary: string;
  snippet: string;
  hasAttachments: boolean;
  bodyState: "none" | "cached" | "tooLarge" | "error";
}

function buildBatchHeaderMessages(
  candidates: readonly TriageCandidate[],
  customPrompt?: string,
): AiChatMessage[] {
  const base = customPrompt?.trim()
    ? customPrompt.trim()
    : DEFAULT_AI_PROMPTS.mail_triage;
  const system = `${base}\n\n${PROTECTED_OUTPUT_CONTRACTS.mail_triage}`;

  const payload = candidates.map((c) => ({
    messageId: c.messageId,
    from: c.fromName ? `${c.fromName} <${c.fromAddress}>` : c.fromAddress,
    to: c.toSummary || undefined,
    subject: c.subject,
    snippet: c.snippet.slice(0, 320),
    hasAttachments: c.hasAttachments,
  }));

  return [
    { role: "system", content: system },
    {
      role: "user",
      content: `Clasifica estos ${payload.length} correos por sus cabeceras:\n${JSON.stringify(payload)}`,
    },
  ];
}

function buildSingleBodyMessages(
  candidate: TriageCandidate,
  bodyText: string,
  customPrompt?: string,
): AiChatMessage[] {
  const base = customPrompt?.trim()
    ? customPrompt.trim()
    : DEFAULT_AI_PROMPTS.mail_triage;
  const system = `${base}\n\n${PROTECTED_OUTPUT_CONTRACTS.mail_triage}`;

  const payload = {
    messageId: candidate.messageId,
    from: candidate.fromName
      ? `${candidate.fromName} <${candidate.fromAddress}>`
      : candidate.fromAddress,
    subject: candidate.subject,
    hasAttachments: candidate.hasAttachments,
    bodyExcerpt: bodyText.slice(0, MAX_BODY_CHARS),
  };

  return [
    { role: "system", content: system },
    {
      role: "user",
      content: `La cabecera anterior tenía poca certidumbre. Clasifica este correo usando también el cuerpo:\n${JSON.stringify(payload)}`,
    },
  ];
}

const MAX_BG_ROUNDS = 20;

interface AutoTagRoundResult {
  processed: number;
  byRule: number;
  byAiHeaders: number;
  byAiBody: number;
  remainingAiPending: number;
}

async function executeAutoTagRound(
  ctx: ActionCtx,
  params: {
    userId?: Id<"users">;
    folderRemoteId?: string;
    limit?: number;
    allowBodyFetch: boolean;
  },
): Promise<AutoTagRoundResult> {
  const context = await ctx.runQuery(internal.mailTagging.triageContext, {
    userId: params.userId,
    folderRemoteId: params.folderRemoteId,
    limit: params.limit ?? 500,
  });
  if (!context || context.candidates.length === 0) {
    return {
      processed: 0,
      byRule: 0,
      byAiHeaders: 0,
      byAiBody: 0,
      remainingAiPending: 0,
    };
  }

  const rules: MailTagRule[] = context.rules.map((r) => ({
    id: r._id,
    name: r.name,
    enabled: r.enabled,
    priority: r.priority,
    matchMode: r.matchMode,
    conditions: r.conditions,
    tags: r.tags as MailTagRule["tags"],
  }));

  const itemsToSave: Array<{
    messageId: string;
    tags: string[];
    tagSource: "rule" | "ai_headers" | "ai_body";
    tagConfidence: number;
    tagReason: string;
  }> = [];
  const remainingForAi: TriageCandidate[] = [];

  for (const candidate of context.candidates) {
    const ruleHit = evaluateMailTagRules(candidate, rules);
    if (ruleHit) {
      itemsToSave.push({
        messageId: candidate.messageId,
        tags: ruleHit.tags,
        tagSource: "rule",
        tagConfidence: 1,
        tagReason: ruleHit.reason,
      });
    } else {
      remainingForAi.push(candidate);
    }
  }

  let byAiHeaders = 0;
  let byAiBody = 0;
  let remainingAiPending = 0;

  if (remainingForAi.length > 0) {
    const aiConfig = await ctx.runQuery(internal.aiSettings.resolved, {});
    if (!aiConfig.enabled || aiConfig.apiKey.trim() === "") {
      if (itemsToSave.length === 0) {
        throw new ConvexError(
          aiConfig.decryptionFailed
            ? "La clave API de DeepSeek guardada no se puede descifrar con la clave actual del servidor. Vuelve a guardarla en Ajustes → IA."
            : "Activa y configura DeepSeek en Ajustes → IA para clasificar los correos que no coinciden con reglas rápidas.",
        );
      }
    } else {
      const taskCfg = aiConfig.taskParams.mail_triage;
      const batch = remainingForAi.slice(0, MAX_BATCH_HEADERS);
      remainingAiPending = Math.max(0, remainingForAi.length - batch.length);
      const validIds = new Set(batch.map((c) => c.messageId));

      const rawBatch = await callDeepSeekJson({
        baseUrl: aiConfig.baseUrl,
        apiKey: aiConfig.apiKey,
        model: aiConfig.chatModel,
        messages: buildBatchHeaderMessages(batch, taskCfg.customPrompt),
        maxTokens: taskCfg.maxTokens,
        temperature: taskCfg.temperature,
      });

      const predictions = parseMailTriageBatchResponse(rawBatch, validIds);
      const byId = new Map(predictions.map((p) => [p.messageId, p]));

      let bodyFetches = 0;
      for (const candidate of batch) {
        const pred = byId.get(candidate.messageId);
        const lowConfidence =
          !pred ||
          pred.needsBody ||
          pred.confidence < MAIL_TRIAGE_BODY_THRESHOLD ||
          pred.tags.length === 0;

        if (lowConfidence && bodyFetches < MAX_BODY_FALLBACK_PER_RUN) {
          bodyFetches += 1;
          let bodyText = context.cachedBodies[candidate.messageId] ?? "";
          if (
            !bodyText &&
            params.allowBodyFetch &&
            candidate.bodyState !== "tooLarge"
          ) {
            try {
              const opened = await ctx.runAction(api.mailBody.open, {
                messageId: candidate.messageId,
              });
              bodyText = opened.text ?? "";
            } catch {
              // Si falla la descarga de cuerpo, conservamos la predicción de cabecera si existe
            }
          }

          if (bodyText.trim() !== "") {
            const rawSingle = await callDeepSeekJson({
              baseUrl: aiConfig.baseUrl,
              apiKey: aiConfig.apiKey,
              model: aiConfig.chatModel,
              messages: buildSingleBodyMessages(
                candidate,
                bodyText,
                taskCfg.customPrompt,
              ),
              maxTokens: Math.min(600, taskCfg.maxTokens),
              temperature: taskCfg.temperature,
            });
            const bodyPred = parseMailTriageSingleResponse(
              rawSingle,
              candidate.messageId,
            );
            if (bodyPred && bodyPred.tags.length > 0) {
              itemsToSave.push({
                messageId: candidate.messageId,
                tags: bodyPred.tags,
                tagSource: "ai_body",
                tagConfidence: bodyPred.confidence,
                tagReason: bodyPred.reason,
              });
              byAiBody += 1;
              continue;
            }
          }
        }

        if (pred) {
          itemsToSave.push({
            messageId: candidate.messageId,
            tags: pred.tags,
            tagSource: "ai_headers",
            tagConfidence: pred.confidence,
            tagReason: pred.reason,
          });
          if (pred.tags.length > 0) byAiHeaders += 1;
        } else {
          itemsToSave.push({
            messageId: candidate.messageId,
            tags: [],
            tagSource: "ai_headers",
            tagConfidence: 0,
            tagReason: "Sin etiqueta clara",
          });
        }
      }
    }
  }

  const processed =
    itemsToSave.length > 0
      ? await ctx.runMutation(internal.mailTagging.applyTriageResults, {
          accountId: context.accountId,
          items: itemsToSave,
        })
      : 0;

  return {
    processed,
    byRule: itemsToSave.filter((i) => i.tagSource === "rule").length,
    byAiHeaders,
    byAiBody,
    remainingAiPending,
  };
}

export const autoTagFolder = action({
  args: {
    folderRemoteId: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<AutoTagRoundResult> =>
    executeAutoTagRound(ctx, {
      folderRemoteId: args.folderRemoteId,
      limit: args.limit,
      allowBodyFetch: true,
    }),
});

/** Lote encadenado en segundo plano para autoetiquetar una carpeta completa. */
export const runAutoTagBatch = internalAction({
  args: {
    jobId: v.id("backgroundJobs"),
    userId: v.id("users"),
    folderRemoteId: v.string(),
    round: v.number(),
    totalProcessed: v.number(),
    totalRule: v.number(),
    totalAiHeaders: v.number(),
    totalAiBody: v.number(),
  },
  handler: async (ctx, args): Promise<void> => {
    const cancelled = await ctx.runQuery(internal.backgroundJobs.isCancelled, {
      jobId: args.jobId,
    });
    if (cancelled) return;

    try {
      const res = await executeAutoTagRound(ctx, {
        userId: args.userId,
        folderRemoteId: args.folderRemoteId,
        allowBodyFetch: false,
      });

      const totalProcessed = args.totalProcessed + res.processed;
      const totalRule = args.totalRule + res.byRule;
      const totalAiHeaders = args.totalAiHeaders + res.byAiHeaders;
      const totalAiBody = args.totalAiBody + res.byAiBody;

      if (
        res.remainingAiPending > 0 &&
        res.processed > 0 &&
        args.round + 1 < MAX_BG_ROUNDS
      ) {
        await ctx.runMutation(internal.backgroundJobs.advanceProgress, {
          jobId: args.jobId,
          processed: totalProcessed,
          total: totalProcessed + res.remainingAiPending,
          detail: `${totalProcessed} etiquetados (${res.remainingAiPending} pendientes)…`,
        });
        await ctx.scheduler.runAfter(
          0,
          internal.mailTaggingActions.runAutoTagBatch,
          {
            jobId: args.jobId,
            userId: args.userId,
            folderRemoteId: args.folderRemoteId,
            round: args.round + 1,
            totalProcessed,
            totalRule,
            totalAiHeaders,
            totalAiBody,
          },
        );
        return;
      }

      const detail =
        totalProcessed === 0
          ? "No había mensajes pendientes de etiquetar."
          : `${totalProcessed} mensajes (${totalRule} por regla, ${totalAiHeaders} por cabecera, ${totalAiBody} con cuerpo).`;

      await ctx.runMutation(internal.backgroundJobs.complete, {
        jobId: args.jobId,
        processed: totalProcessed,
        total: totalProcessed,
        detail,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Error al autoetiquetar.";
      await ctx.runMutation(internal.backgroundJobs.fail, {
        jobId: args.jobId,
        error: message,
      });
    }
  },
});

/** Pasada periódica silenciosa para clasificar correos nuevos pendientes. */
export const autoTagPendingAccounts = internalAction({
  args: {},
  handler: async (ctx): Promise<{ accounts: number; tagged: number }> => {
    const aiConfig = await ctx.runQuery(internal.aiSettings.resolved, {});
    if (!aiConfig.enabled || aiConfig.apiKey.trim() === "") {
      return { accounts: 0, tagged: 0 };
    }
    const accounts = await ctx.runQuery(
      internal.mailTagging.activeAccountsForAutoTag,
      {},
    );
    let tagged = 0;
    for (const acc of accounts) {
      try {
        const res = await executeAutoTagRound(ctx, {
          userId: acc.userId,
          limit: 60,
          allowBodyFetch: false,
        });
        tagged += res.processed;
      } catch {
        // Error aislado por cuenta para no frenar el cron
      }
    }
    return { accounts: accounts.length, tagged };
  },
});

export const analyzeMessageWithBody = action({
  args: { messageId: v.string() },
  handler: async (ctx, args) => {
    const context = await ctx.runQuery(internal.mailTagging.triageContext, {
      messageIds: [args.messageId],
      limit: 1,
    });
    const candidate = context?.candidates[0];
    if (!context || !candidate) {
      throw new ConvexError("No se encontró el mensaje para analizar.");
    }

    const aiConfig = await ctx.runQuery(internal.aiSettings.resolved, {});
    if (!aiConfig.enabled || aiConfig.apiKey.trim() === "") {
      throw new ConvexError(
        aiConfig.decryptionFailed
          ? "La clave API de DeepSeek guardada no se puede descifrar con la clave actual del servidor. Vuelve a guardarla en Ajustes → IA."
          : "Activa y configura DeepSeek en Ajustes → IA para analizar el mensaje.",
      );
    }

    let bodyText = context.cachedBodies[candidate.messageId] ?? "";
    if (!bodyText && candidate.bodyState !== "tooLarge") {
      const opened = await ctx.runAction(api.mailBody.open, {
        messageId: candidate.messageId,
      });
      bodyText = opened.text ?? "";
    }

    const taskCfg = aiConfig.taskParams.mail_triage;
    const rawSingle = await callDeepSeekJson({
      baseUrl: aiConfig.baseUrl,
      apiKey: aiConfig.apiKey,
      model: aiConfig.chatModel,
      messages: buildSingleBodyMessages(
        candidate,
        bodyText || candidate.snippet,
        taskCfg.customPrompt,
      ),
      maxTokens: Math.min(600, taskCfg.maxTokens),
      temperature: taskCfg.temperature,
    });

    const pred = parseMailTriageSingleResponse(rawSingle, candidate.messageId);
    if (!pred || pred.tags.length === 0) {
      throw new ConvexError(
        "DeepSeek no pudo determinar etiquetas claras para este mensaje.",
      );
    }

    await ctx.runMutation(internal.mailTagging.applyTriageResults, {
      accountId: context.accountId,
      allowOverrideManual: true,
      items: [
        {
          messageId: candidate.messageId,
          tags: pred.tags,
          tagSource: "ai_body",
          tagConfidence: pred.confidence,
          tagReason: pred.reason,
        },
      ],
    });

    return {
      tags: pred.tags,
      confidence: pred.confidence,
      reason: pred.reason,
    };
  },
});
