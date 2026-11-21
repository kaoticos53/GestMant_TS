import { describe, expect, test } from "vitest";
import {
  MAX_BODY_HTML_BYTES,
  MAX_BODY_TEXT_BYTES,
  normalizeContentId,
  parseMailMessage,
  truncateUtf8,
  utf8Bytes,
} from "../src/lib/mailClient/mime";

const RAW = [
  "From: Taller Central <taller@rtva.es>",
  "To: tecnico@rtva.es",
  "Subject: Mensaje con adjuntos",
  "MIME-Version: 1.0",
  'Content-Type: multipart/mixed; boundary="mix"',
  "",
  "--mix",
  'Content-Type: multipart/alternative; boundary="alt"',
  "",
  "--alt",
  'Content-Type: text/plain; charset="utf-8"',
  "",
  "Hola desde el taller.",
  "--alt",
  'Content-Type: text/html; charset="utf-8"',
  "",
  '<html><body><p>Hola <strong>taller</strong>.</p><img src="cid:logo@rtva"></body></html>',
  "--alt--",
  "--mix",
  'Content-Type: image/png; name="logo.png"',
  "Content-Transfer-Encoding: base64",
  "Content-ID: <logo@rtva>",
  'Content-Disposition: inline; filename="logo.png"',
  "",
  "iVBORw0KGgo=",
  "--mix",
  'Content-Type: application/pdf; name="informe.pdf"',
  "Content-Transfer-Encoding: base64",
  'Content-Disposition: attachment; filename="informe.pdf"',
  "",
  "JVBERi0xLjQK",
  "--mix--",
].join("\r\n");

describe("MIME del cuerpo y los adjuntos", () => {
  test("extrae texto, HTML y una sola copia decodificada de cada parte", async () => {
    const parsed = await parseMailMessage(new TextEncoder().encode(RAW));

    expect(parsed.text).toContain("Hola desde el taller.");
    expect(parsed.html).toContain("cid:logo@rtva");
    expect(parsed.htmlTruncated).toBe(false);
    expect(parsed.attachments).toHaveLength(2);
    expect(parsed.attachments[0]).toMatchObject({
      filename: "logo.png",
      contentType: "image/png",
      contentId: "logo@rtva",
      inline: true,
    });
    expect(parsed.attachments[1]).toMatchObject({
      filename: "informe.pdf",
      contentType: "application/pdf",
      contentId: null,
      inline: false,
    });
    expect(new TextDecoder().decode(parsed.attachments[1]?.content)).toBe(
      "%PDF-1.4\n",
    );
    expect(parsed.bodyBytes).toBe(
      utf8Bytes(parsed.text) + utf8Bytes(parsed.html ?? ""),
    );
  });

  test("un mensaje sin HTML se queda en texto", async () => {
    const parsed = await parseMailMessage(
      new TextEncoder().encode(
        [
          "From: taller@rtva.es",
          "Subject: Solo texto",
          "MIME-Version: 1.0",
          'Content-Type: text/plain; charset="utf-8"',
          "",
          "Sin HTML.",
        ].join("\r\n"),
      ),
    );

    expect(parsed.text.trim()).toBe("Sin HTML.");
    expect(parsed.html).toBeNull();
    expect(parsed.attachments).toEqual([]);
  });

  test("recorta por bytes sin partir un carácter y marca la bandera", () => {
    const value = "á".repeat(MAX_BODY_TEXT_BYTES);
    const result = truncateUtf8(value, 5);
    expect(result.truncated).toBe(true);
    expect(utf8Bytes(result.value)).toBeLessThanOrEqual(5);
    expect(result.value).toBe("áá");
    expect(truncateUtf8("abc", 5)).toEqual({ value: "abc", truncated: false });
  });

  test("los límites del cuerpo son los de 0017", () => {
    expect(MAX_BODY_TEXT_BYTES).toBe(64 * 1024);
    expect(MAX_BODY_HTML_BYTES).toBe(512 * 1024);
  });

  test("normaliza el Content-ID para resolver cid: en el visor", () => {
    expect(normalizeContentId("<logo@rtva>")).toBe("logo@rtva");
    expect(normalizeContentId("cid:logo@rtva")).toBe("logo@rtva");
    expect(normalizeContentId("  ")).toBeNull();
  });
});
