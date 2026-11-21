import PostalMime, { type Attachment } from "postal-mime";
import type { MailAttachmentPart, MailMessageContent } from "./types";

/** Límites de 0017 para lo que se guarda en la base, no para el RFC822. */
export const MAX_BODY_TEXT_BYTES = 64 * 1024;
export const MAX_BODY_HTML_BYTES = 512 * 1024;

const encoder = new TextEncoder();

/** Bytes UTF-8 reales; el presupuesto de caché se cuenta con esto. */
export function utf8Bytes(value: string): number {
  return encoder.encode(value).length;
}

/**
 * Recorta sin partir un carácter UTF-16 por la mitad. Se recorre por puntos de
 * código y se para al llegar al presupuesto, no después de pasarlo.
 */
export function truncateUtf8(
  value: string,
  maxBytes: number,
): { value: string; truncated: boolean } {
  const limit = Math.max(0, Math.trunc(maxBytes));
  if (utf8Bytes(value) <= limit) return { value, truncated: false };

  let used = 0;
  let result = "";
  for (const character of value) {
    const size = utf8Bytes(character);
    if (used + size > limit) break;
    result += character;
    used += size;
  }
  return { value: result, truncated: true };
}

/** El id de una parte `cid:` sin los delimitadores ni el esquema. */
export function normalizeContentId(
  value: string | undefined | null,
): string | null {
  const normalized = (value ?? "")
    .trim()
    .replace(/^cid:/i, "")
    .replace(/^<+/, "")
    .replace(/>+$/, "")
    .trim();
  return normalized === "" ? null : normalized;
}

function attachmentBytes(content: Attachment["content"]): Uint8Array {
  if (typeof content === "string") return encoder.encode(content);
  if (content instanceof Uint8Array) return content;
  return new Uint8Array(content);
}

function attachmentPart(
  attachment: Attachment,
  partIndex: number,
): MailAttachmentPart | null {
  const contentId = normalizeContentId(attachment.contentId);
  const filename = attachment.filename?.trim() || null;
  const isAttachment = attachment.disposition === "attachment";
  if (!isAttachment && filename === null && contentId === null) return null;

  return {
    partIndex,
    filename,
    contentType: attachment.mimeType.trim() || "application/octet-stream",
    contentId,
    inline: contentId !== null,
    content: attachmentBytes(attachment.content),
  };
}

/**
 * Convierte el RFC822 en lo único que se persiste. El original no sale de esta
 * función: el llamador lo descarta después de verificar sus bytes.
 */
export async function parseMailMessage(
  raw: Uint8Array,
): Promise<MailMessageContent> {
  const parsed = await new PostalMime({
    attachmentEncoding: "arraybuffer",
    maxNestingDepth: 20,
    maxRfc822NestingDepth: 2,
  }).parse(raw);

  const text = truncateUtf8(parsed.text ?? "", MAX_BODY_TEXT_BYTES);
  const html = truncateUtf8(parsed.html ?? "", MAX_BODY_HTML_BYTES);
  const attachments = parsed.attachments
    .map((attachment, index) => attachmentPart(attachment, index))
    .filter((part): part is MailAttachmentPart => part !== null);

  return {
    text: text.value,
    textTruncated: text.truncated,
    html: html.value.trim() === "" ? null : html.value,
    htmlTruncated: html.truncated,
    bodyBytes: utf8Bytes(text.value) + utf8Bytes(html.value),
    attachments,
  };
}
