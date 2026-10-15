import type { PdfMeasureText, Piece, Run } from "./types";

/**
 * Las palabras de los trozos, con el corte obligatorio de un salto de línea y
 * el blanco que llevaban delante. El blanco se cuenta, no se supone: entre dos
 * palabras de distinto formato lo normal es que hubiera un espacio, pero no
 * siempre —«**sin fallos**.» acaba en un punto pegado a la negrita—, y si se
 * pusiera uno el papel diría «sin fallos .».
 */
export function tokens(runs: readonly Run[]): { token: Piece; hardBreak: boolean }[] {
  const result: { token: Piece; hardBreak: boolean }[] = [];
  let hardBreak = false;
  /** Si el trozo anterior acabó en un hueco (o en un salto de línea). */
  let afterBlank = true;
  for (const run of runs) {
    for (const match of run.text.matchAll(/(\s*)(\S+)/g)) {
      const [blank, word] = [match[1], match[2]];
      result.push({
        token: { text: word, run, glue: !afterBlank && blank === "" },
        hardBreak: hardBreak || blank.includes("\n"),
      });
      hardBreak = false;
      afterBlank = false;
    }
    const trailing = /\s*$/.exec(run.text)?.[0] ?? "";
    afterBlank = trailing !== "";
    hardBreak = trailing.includes("\n");
  }
  return result;
}

/**
 * Los trozos de una línea, uno solo cuando comparten tipografía. Entre palabra
 * y palabra va un espacio: el reparto en líneas trabaja con palabras sueltas y
 * el hueco no está dentro de ninguna, así que se pone al juntarlas.
 */
export function mergeRuns(pieces: readonly Piece[]): Run[] {
  const runs: Run[] = [];
  pieces.forEach((piece, index) => {
    const text = index === 0 || piece.glue ? piece.text : ` ${piece.text}`;
    const last = runs[runs.length - 1];
    if (
      last &&
      piece.run.font === last.font &&
      piece.run.color === last.color &&
      piece.run.strike === last.strike &&
      piece.run.link === last.link
    ) {
      last.text += text;
      return;
    }
    runs.push({ ...piece.run, text });
  });
  return runs;
}

/**
 * Los trozos, repartidos en líneas de un ancho. Una palabra que no cabe sola
 * —un nombre de archivo largo, una dirección— se parte por caracteres: antes
 * eso que dejar media hoja en blanco.
 */
export function wrapRuns(
  runs: readonly Run[],
  width: number,
  size: number,
  measure: PdfMeasureText,
): Run[][] {
  const lines: Run[][] = [];
  let line: Piece[] = [];
  let lineWidth = 0;
  const newline = () => {
    lines.push(mergeRuns(line));
    line = [];
    lineWidth = 0;
  };

  for (const { token, hardBreak } of tokens(runs)) {
    if (hardBreak && line.length > 0) newline();
    const wordWidth = measure(token.text, token.run.font, size);
    // El hueco que separa la palabra de la anterior; ninguno si va pegada.
    const gap = token.glue ? 0 : measure(" ", token.run.font, size);
    if (line.length > 0 && lineWidth + gap + wordWidth > width) newline();

    if (wordWidth <= width) {
      line.push(token);
      lineWidth += (line.length > 1 ? gap : 0) + wordWidth;
      continue;
    }

    let rest = token.text;
    while (rest !== "") {
      const padding = line.length > 0 ? gap : 0;
      const room = width - lineWidth - padding;
      let fit = 0;
      while (
        fit < rest.length &&
        measure(rest.slice(0, fit + 1), token.run.font, size) <= room
      ) {
        fit += 1;
      }
      if (fit === 0) fit = 1;
      const chunk = rest.slice(0, fit);
      lineWidth += padding + measure(chunk, token.run.font, size);
      line.push({ text: chunk, run: token.run });
      rest = rest.slice(fit);
      if (rest !== "") newline();
    }
  }
  if (line.length > 0) newline();
  return lines.length > 0 ? lines : [[]];
}
