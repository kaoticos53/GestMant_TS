import { describe, expect, test } from "vitest";
import {
  richDocBlocks,
  richDocIsEmpty,
  richDocToHtml,
  richDocToMarkdown,
  richDocToPlainText,
  richDocToStore,
} from "../src/lib/richDoc";

describe("richDocToPlainText — el texto que necesitan informes y buscador", () => {
  test("un texto plano se devuelve intacto, sin tocar sus caracteres", () => {
    const plano = "Precio 30 € & recambio <sin> formato";
    expect(richDocToPlainText(plano)).toBe(plano);
  });

  test("los bloques dejan su texto, con los saltos que marcan", () => {
    expect(richDocToPlainText("<p>Uno</p><p>Dos</p>")).toBe("Uno\nDos");
    expect(richDocToPlainText("<p>Uno<br>y dos</p>")).toBe("Uno\ny dos");
    expect(richDocToPlainText("<ul><li>a</li><li>b</li></ul>")).toBe("a\nb");
    expect(richDocToPlainText("<blockquote><p>Ojo</p></blockquote>")).toBe("Ojo");
    expect(richDocToPlainText("<h3>Pruebas</h3><p>Hechas</p>")).toBe(
      "Pruebas\nHechas",
    );
  });

  test("las etiquetas de formato no aparecen y las entidades se leen", () => {
    expect(
      richDocToPlainText("<p>Fuga de <strong>aceite</strong> &amp; humedad</p>"),
    ).toBe("Fuga de aceite & humedad");
    expect(richDocToPlainText("<p>Medida &#189; pulgada</p>")).toBe(
      "Medida ½ pulgada",
    );
  });

  test("una imagen no aporta texto, pero tampoco rompe la lectura", () => {
    expect(
      richDocToPlainText(
        '<p>Antes:</p><p><img src="https://taller/f.png" alt="foto"></p>',
      ),
    ).toBe("Antes:");
  });

  test("el documento guardado se lee por lo que dicen sus bloques", () => {
    const doc = richDocToStore(
      "<p>Fuga de <strong>aceite</strong>.</p><ul><li>Sello nuevo</li></ul>",
    );
    expect(richDocToPlainText(doc!)).toBe("Fuga de aceite.\nSello nuevo");
  });

  test("un valor ausente es texto vacío", () => {
    expect(richDocToPlainText(undefined)).toBe("");
    expect(richDocToPlainText(null)).toBe("");
  });
});

describe("richDocBlocks — lo guardado, leído como bloques", () => {
  test("el documento del editor se guarda en bloques con sus marcas", () => {
    expect(
      richDocBlocks(
        '<p>Necesito <strong>dos</strong> ventiladores.</p><ul><li>a 24 V</li></ul>',
      ),
    ).toEqual([
      {
        type: "paragraph",
        inline: [
          { text: "Necesito " },
          { text: "dos", marks: ["bold"] },
          { text: " ventiladores." },
        ],
      },
      {
        type: "list",
        ordered: false,
        items: [[{ type: "paragraph", inline: [{ text: "a 24 V" }] }]],
      },
    ]);
  });

  test("el documento guardado se vuelve a leer tal cual", () => {
    const doc = richDocToStore(
      '<p>Con <em>formato</em>.</p><h4>Apartado</h4><hr><img src="https://taller/f.png" alt="foto">',
    );
    expect(richDocBlocks(doc)).toEqual([
      {
        type: "paragraph",
        inline: [{ text: "Con " }, { text: "formato", marks: ["italic"] }, { text: "." }],
      },
      { type: "heading", level: 4, inline: [{ text: "Apartado" }] },
      { type: "divider" },
      { type: "image", src: "https://taller/f.png", alt: "foto" },
    ]);
  });

  test("un texto de siempre es un párrafo por línea, con las vacías de por medio", () => {
    expect(richDocBlocks("Uno\n\nDos")).toEqual([
      { type: "paragraph", inline: [{ text: "Uno" }] },
      { type: "paragraph", inline: [] },
      { type: "paragraph", inline: [{ text: "Dos" }] },
    ]);
  });

  test("un texto que solo menciona < y > no se parte por etiquetas", () => {
    const texto = "El modelo <A17> no arranca.";
    expect(richDocToPlainText(texto)).toBe(texto);
    expect(richDocBlocks(texto)).toEqual([
      { type: "paragraph", inline: [{ text: texto }] },
    ]);
  });

  test("un texto que empieza por corchete sin ser documento se lee como texto", () => {
    expect(richDocToPlainText('["hola"]')).toBe('["hola"]');
  });

  test("el anidamiento del editor —lista dentro de lista, cita— se conserva", () => {
    expect(
      richDocBlocks(
        "<ul><li><p>uno</p><ul><li><p>uno y medio</p></li></ul></li><li><p>dos</p></li></ul>",
      ),
    ).toEqual([
      {
        type: "list",
        ordered: false,
        items: [
          [
            { type: "paragraph", inline: [{ text: "uno" }] },
            {
              type: "list",
              ordered: false,
              items: [[{ type: "paragraph", inline: [{ text: "uno y medio" }] }]],
            },
          ],
          [{ type: "paragraph", inline: [{ text: "dos" }] }],
        ],
      },
    ]);
  });

  test("una nota antigua sin etiquetas dentro de un div se lee entera", () => {
    expect(richDocToPlainText("<div>Cambio de<br>fusible</div>")).toBe(
      "Cambio de\nfusible",
    );
  });
});

describe("seguridad — lo que no cabe en el modelo no llega a pintarse", () => {
  test("una etiqueta que se tira se lleva su contenido por delante", () => {
    const blocks = richDocBlocks("<p>Hola</p><script>alert(1)</script>");
    expect(blocks).toEqual([{ type: "paragraph", inline: [{ text: "Hola" }] }]);
    expect(richDocToHtml(blocks)).not.toContain("alert");
    expect(richDocToHtml(blocks)).not.toContain("script");
  });

  test("un iframe o un style no dejan nada", () => {
    expect(richDocToPlainText('<iframe src="https://otro/x"></iframe>')).toBe("");
    expect(
      richDocToPlainText("<style>p{color:red}</style><p>Nota</p>"),
    ).toBe("Nota");
  });

  test("una dirección que no es admisible deja la imagen sin destino", () => {
    expect(richDocBlocks('<img src="javascript:alert(1)" alt="x">')).toEqual([]);
    expect(
      richDocBlocks('<img src="data:image/png;base64,AAAA">'),
    ).toEqual([]);
  });

  test("un enlace peligroso se queda como texto, sin enlace", () => {
    expect(richDocBlocks('<a href="javascript:alert(1)">pulsa</a>')).toEqual([
      { type: "paragraph", inline: [{ text: "pulsa" }] },
    ]);
  });

  test("los atributos que no son del modelo no llegan al HTML", () => {
    const blocks = richDocBlocks(
      '<img src="https://taller/f.png" alt="foto" onerror="alert(1)">',
    );
    const html = richDocToHtml(blocks);
    expect(html).toBe('<img src="https://taller/f.png" alt="foto">');
    expect(html).not.toContain("onerror");
  });

  test("una etiqueta que no se admite se quita y queda su texto", () => {
    expect(
      richDocToPlainText('<p><span style="color:red">Ojo</span></p>'),
    ).toBe("Ojo");
  });

  test("un documento guardado a mano se revisa como el HTML", () => {
    const sucio = JSON.stringify([
      {
        type: "paragraph",
        inline: [{ text: "pulsa", href: "javascript:alert(1)" }],
      },
      { type: "script", src: "https://malo/x.js" },
      { type: "paragraph", inline: [{ text: "con enlace", href: "https://ok/x" }] },
    ]);
    expect(richDocBlocks(sucio)).toEqual([
      { type: "paragraph", inline: [{ text: "pulsa" }] },
      { type: "paragraph", inline: [{ text: "con enlace", href: "https://ok/x" }] },
    ]);
  });
});

describe("richDocToHtml — el HTML que come el editor", () => {
  test("un texto de siempre entra como párrafos", () => {
    expect(richDocToHtml("Uno\nDos")).toBe("<p>Uno</p><p>Dos</p>");
    expect(richDocToHtml("Uno\n\nDos")).toBe("<p>Uno</p><p></p><p>Dos</p>");
  });

  test("lo que escribió el técnico no se interpreta como HTML", () => {
    expect(richDocToHtml("El modelo <A17> & el B18")).toBe(
      "<p>El modelo &lt;A17&gt; &amp; el B18</p>",
    );
  });

  test("bloques, marcas y enlaces salen con sus etiquetas", () => {
    const doc = richDocToStore(
      '<p>Con <strong>negrita</strong>, <u>subrayado</u> y <a href="https://ok/x">enlace</a>.</p><ol><li>uno</li></ol><hr>',
    );
    // Los enlaces salen con `rel` para que abrir uno no le dé la pestaña al
    // destino.
    expect(richDocToHtml(doc)).toBe(
      '<p>Con <strong>negrita</strong>, <u>subrayado</u> y <a href="https://ok/x" rel="noopener noreferrer">enlace</a>.</p><ol><li><p>uno</p></li></ol><hr>',
    );
  });

  test("lo que se guarda y se vuelve a abrir es el mismo documento", () => {
    const html =
      "<p>Uno <strong>dos</strong> tres</p><blockquote><p>Ojo</p></blockquote>";
    expect(richDocBlocks(richDocToStore(html))).toEqual(richDocBlocks(html));
  });
});

describe("richDocToMarkdown — el parte que se imprime o se pasa a PDF", () => {
  test("cada bloque se traduce a su pieza de Markdown", () => {
    const doc = richDocToStore(
      '<h3>Pruebas</h3><p>Todo <strong>bien</strong>.</p><ul><li>uno</li><li>dos</li></ul>',
    );
    expect(richDocToMarkdown(doc)).toBe(
      "### Pruebas\n\nTodo **bien**.\n\n- uno\n- dos",
    );
  });

  test("listas numeradas, citas e imágenes", () => {
    const doc = richDocToStore(
      '<ol><li>uno</li></ol><blockquote><p>Ojo</p></blockquote><img src="https://taller/f.png" alt="foto">',
    );
    expect(richDocToMarkdown(doc)).toBe(
      "1. uno\n\n> Ojo\n\n![foto](https://taller/f.png)",
    );
  });

  test("las marcas de Markdown que vengan escritas se neutralizan", () => {
    expect(richDocToMarkdown("Precio *2* y _3_")).toBe("Precio \\*2\\* y \\_3\\_");
  });

  test("un texto de siempre sale tal cual", () => {
    expect(richDocToMarkdown("Cambio de fusible\nProbado")).toBe(
      "Cambio de fusible\n\nProbado",
    );
  });
});

describe("richDocIsEmpty — un documento con formato vacío no es una nota", () => {
  test("el hueco que deja el editor cuenta como vacío", () => {
    expect(richDocIsEmpty("<p></p>")).toBe(true);
    expect(richDocIsEmpty("<p><br></p>")).toBe(true);
    expect(richDocIsEmpty("   ")).toBe(true);
    expect(richDocIsEmpty("")).toBe(true);
    expect(richDocIsEmpty(undefined)).toBe(true);
    expect(richDocIsEmpty(JSON.stringify([{ type: "paragraph", inline: [] }]))).toBe(
      true,
    );
  });

  test("con texto o con una imagen, hay nota", () => {
    expect(richDocIsEmpty("<p>Probado en carga.</p>")).toBe(false);
    expect(
      richDocIsEmpty('<p><img src="https://taller/f.png" alt="foto"></p>'),
    ).toBe(false);
    expect(richDocIsEmpty("Probado en carga.")).toBe(false);
  });
});

describe("richDocToStore — lo que se manda a guardar", () => {
  test("vacío no se guarda", () => {
    expect(richDocToStore("<p></p>")).toBeUndefined();
    expect(richDocToStore("   ")).toBeUndefined();
    expect(richDocToStore(undefined)).toBeUndefined();
    expect(richDocToStore("[]")).toBeUndefined();
    expect(richDocToStore([])).toBeUndefined();
  });

  test("el formato se guarda como documento", () => {
    const doc = richDocToStore("<p>Con <em>formato</em>.</p>");
    expect(doc).toBeTypeOf("string");
    expect(richDocBlocks(doc)).toEqual([
      {
        type: "paragraph",
        inline: [{ text: "Con " }, { text: "formato", marks: ["italic"] }, { text: "." }],
      },
    ]);
  });

  test("un texto plano de siempre se guarda tal cual, recortado", () => {
    expect(richDocToStore("  Cuadro de tensiones  ")).toBe("Cuadro de tensiones");
    expect(richDocToStore("Cambio de fusible.\nProbado en carga.")).toBe(
      "Cambio de fusible.\nProbado en carga.",
    );
  });

  test("el párrafo libre que deja el editor al final no se guarda", () => {
    expect(richDocBlocks(richDocToStore("<p>Nota</p><p></p>"))).toEqual([
      { type: "paragraph", inline: [{ text: "Nota" }] },
    ]);
    expect(
      richDocBlocks(richDocToStore("<ul><li>uno</li></ul><p></p><p><br></p>")),
    ).toEqual([
      {
        type: "list",
        ordered: false,
        items: [[{ type: "paragraph", inline: [{ text: "uno" }] }]],
      },
    ]);
    // Lo que sí es contenido se queda, aunque sea una imagen sin texto.
    expect(richDocBlocks(richDocToStore('<p><img src="https://taller/f.png"></p>'))).toEqual([
      { type: "image", src: "https://taller/f.png" },
    ]);
  });

  test("un documento ya hecho se guarda sin cambiar nada", () => {
    const doc = richDocToStore("<p>Uno <strong>dos</strong>.</p><ul><li>tres</li></ul>");
    expect(richDocToStore(doc)).toBe(doc);
  });
});
