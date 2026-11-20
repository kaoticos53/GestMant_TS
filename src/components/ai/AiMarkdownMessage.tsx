import type { ReactNode } from "react";

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const tokenRe = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null = tokenRe.exec(text);
  let idx = 0;

  while (match !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }
    const token = match[0];
    if (token.startsWith("**") && token.endsWith("**")) {
      nodes.push(
        <strong key={`${keyPrefix}-b-${idx}`} className="font-semibold">
          {token.slice(2, -2)}
        </strong>,
      );
    } else if (token.startsWith("`") && token.endsWith("`")) {
      nodes.push(
        <code
          key={`${keyPrefix}-c-${idx}`}
          className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]"
        >
          {token.slice(1, -1)}
        </code>,
      );
    } else if (token.startsWith("*") && token.endsWith("*")) {
      nodes.push(
        <em key={`${keyPrefix}-i-${idx}`}>{token.slice(1, -1)}</em>,
      );
    }
    lastIndex = match.index + token.length;
    idx += 1;
    match = tokenRe.exec(text);
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }
  return nodes;
}

function splitTableRow(line: string): string[] {
  const trimmed = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  return trimmed.split("|").map((cell) => cell.trim());
}

function isTableSeparator(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed.includes("|")) return false;
  return /^\|?(\s*:?-+:?\s*\|)+\s*:?-+:?\s*\|?$/.test(trimmed);
}

/**
 * Renderiza Markdown básico de respuestas IA (tablas, listas, encabezados,
 * bloques de código, citas, negrita, cursiva y código inline) sin HTML crudo.
 */
export function AiMarkdownMessage({ content }: { content: string }) {
  const lines = content.replace(/\r\n?/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i] ?? "";
    const trimmed = line.trim();

    if (trimmed === "") {
      i += 1;
      continue;
    }

    // Bloque de código con ```
    if (trimmed.startsWith("```")) {
      const codeLines: string[] = [];
      i += 1;
      while (i < lines.length && !(lines[i] ?? "").trim().startsWith("```")) {
        codeLines.push(lines[i] ?? "");
        i += 1;
      }
      if (i < lines.length) i += 1;
      blocks.push(
        <pre
          key={`pre-${blocks.length}`}
          className="my-2 overflow-x-auto rounded border bg-muted/60 p-2 font-mono text-[11px]"
        >
          <code>{codeLines.join("\n")}</code>
        </pre>,
      );
      continue;
    }

    // Tabla Markdown: cabecera + separador | --- | --- |
    if (
      line.includes("|") &&
      i + 1 < lines.length &&
      isTableSeparator(lines[i + 1] ?? "")
    ) {
      const headers = splitTableRow(line);
      i += 2;
      const rows: string[][] = [];
      while (
        i < lines.length &&
        (lines[i] ?? "").trim() !== "" &&
        (lines[i] ?? "").includes("|")
      ) {
        rows.push(splitTableRow(lines[i] ?? ""));
        i += 1;
      }
      blocks.push(
        <div
          key={`tbl-${blocks.length}`}
          className="my-2 overflow-x-auto rounded-md border border-border/80"
        >
          <table className="w-full border-collapse text-left text-xs">
            <thead className="bg-muted/60">
              <tr>
                {headers.map((h, colIdx) => (
                  <th
                    key={colIdx}
                    className="border-b border-border/70 px-2.5 py-1.5 font-semibold"
                  >
                    {renderInline(h, `th-${blocks.length}-${colIdx}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rIdx) => (
                <tr key={rIdx} className="border-b border-border/50 last:border-b-0">
                  {headers.map((_, colIdx) => (
                    <td key={colIdx} className="px-2.5 py-1.5 align-top">
                      {renderInline(
                        row[colIdx] ?? "",
                        `td-${blocks.length}-${rIdx}-${colIdx}`,
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }

    // Encabezados # .. ###
    const headingMatch = trimmed.match(/^(#{1,3})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1]!.length;
      const headingText = headingMatch[2]!;
      blocks.push(
        <p
          key={`h-${blocks.length}`}
          className={
            level === 1
              ? "mt-2 text-sm font-bold"
              : "mt-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
          }
        >
          {renderInline(headingText, `h-${blocks.length}`)}
        </p>,
      );
      i += 1;
      continue;
    }

    // Cita >
    if (trimmed.startsWith(">")) {
      const quoteLines: string[] = [];
      while (i < lines.length && (lines[i] ?? "").trim().startsWith(">")) {
        quoteLines.push((lines[i] ?? "").trim().replace(/^>\s?/, ""));
        i += 1;
      }
      blocks.push(
        <blockquote
          key={`q-${blocks.length}`}
          className="my-1.5 border-l-2 border-primary/50 pl-2.5 text-xs text-muted-foreground"
        >
          {renderInline(quoteLines.join(" "), `q-${blocks.length}`)}
        </blockquote>,
      );
      continue;
    }

    // Lista desordenada - / *
    if (/^[-*]\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i] ?? "")) {
        items.push((lines[i] ?? "").replace(/^\s*[-*]\s+/, ""));
        i += 1;
      }
      blocks.push(
        <ul key={`ul-${blocks.length}`} className="my-1.5 list-disc space-y-1 pl-4">
          {items.map((item, idx) => (
            <li key={idx}>{renderInline(item, `ul-${blocks.length}-${idx}`)}</li>
          ))}
        </ul>,
      );
      continue;
    }

    // Lista ordenada 1.
    if (/^\d+\.\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i] ?? "")) {
        items.push((lines[i] ?? "").replace(/^\s*\d+\.\s+/, ""));
        i += 1;
      }
      blocks.push(
        <ol
          key={`ol-${blocks.length}`}
          className="my-1.5 list-decimal space-y-1 pl-4"
        >
          {items.map((item, idx) => (
            <li key={idx}>{renderInline(item, `ol-${blocks.length}-${idx}`)}</li>
          ))}
        </ol>,
      );
      continue;
    }

    // Párrafo normal (junta líneas contiguas que no inicien otro bloque)
    const paraLines: string[] = [];
    while (i < lines.length) {
      const cur = lines[i] ?? "";
      const curTrim = cur.trim();
      if (
        curTrim === "" ||
        curTrim.startsWith("```") ||
        curTrim.startsWith(">") ||
        /^#{1,3}\s+/.test(curTrim) ||
        /^[-*]\s+/.test(curTrim) ||
        /^\d+\.\s+/.test(curTrim) ||
        (cur.includes("|") &&
          i + 1 < lines.length &&
          isTableSeparator(lines[i + 1] ?? ""))
      ) {
        break;
      }
      paraLines.push(cur);
      i += 1;
    }
    blocks.push(
      <p key={`p-${blocks.length}`} className="leading-relaxed">
        {renderInline(paraLines.join(" "), `p-${blocks.length}`)}
      </p>,
    );
  }

  return <div className="space-y-1.5">{blocks}</div>;
}
