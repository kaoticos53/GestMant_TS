import { AttachmentGroup } from "@/components/AttachmentGroup";
import { AttachmentImage } from "@/components/AttachmentImage";
import { richDocBlocks, type RichBlock, type RichInline } from "@/lib/richDoc";
import { cn } from "@/lib/utils";
import { Fragment, type ReactNode } from "react";

/**
 * Una nota o una descripción ya escrita, pintada bloque a bloque: cada bloque
 * con la etiqueta que le corresponde (párrafo, título, lista, cita, imagen),
 * sus marcas y el texto escapado por React.
 *
 * No se inyecta HTML en el navegador: de lo guardado solo se lee su estructura,
 * y una etiqueta, un atributo o una dirección que no sean admisibles no llegan
 * aquí (los deja fuera `richDocBlocks`). Una nota de siempre —texto plano o el
 * HTML del editor de las versiones anteriores— se lee igual que las nuevas:
 * sus párrafos son párrafos.
 */
export function RichText({
  value,
  className,
}: {
  value: string | undefined | null;
  className?: string;
}) {
  const blocks = richDocBlocks(value);
  if (blocks.length === 0) return null;
  return (
    <div className={cn("rich-text text-sm leading-6", className)}>
      {/* Las imágenes de una misma nota van como grupo: comparten dirección, así
          que, si no llega, el porqué se dice una vez al principio en lugar de
          repetirse en cada imagen. Con una sola imagen no cambia nada: su aviso
          se queda donde estaba, con su nombre delante. */}
      <AttachmentGroup>{renderBlocks(blocks)}</AttachmentGroup>
    </div>
  );
}

/** Los bloques en orden, cada uno con su clave (hay listas y citas anidadas). */
function renderBlocks(blocks: readonly RichBlock[]): ReactNode {
  return blocks.map((block, index) => (
    <Fragment key={index}>{renderBlock(block)}</Fragment>
  ));
}

function renderBlock(block: RichBlock): ReactNode {
  switch (block.type) {
    case "paragraph":
      return <p>{renderInline(block.inline)}</p>;
    case "heading": {
      const Heading = block.level === 3 ? "h3" : "h4";
      return <Heading>{renderInline(block.inline)}</Heading>;
    }
    case "list": {
      const List = block.ordered ? "ol" : "ul";
      return (
        <List>
          {block.items.map((item, index) => (
            <li key={index}>{renderBlocks(item)}</li>
          ))}
        </List>
      );
    }
    case "quote":
      return <blockquote>{renderBlocks(block.blocks)}</blockquote>;
    case "image":
      // La imagen se pide a la dirección pública del almacén, y ahí también
      // puede no llegar (otro dominio, HTTP dentro de una página HTTPS, un
      // archivo que ya no está): en su sitio se pone el aviso, no el icono roto.
      return (
        <AttachmentImage
          url={block.src}
          name={block.title ?? block.alt ?? ""}
          layout="block"
          frameClassName="max-w-full"
        />
      );
    case "divider":
      return <hr />;
  }
}

/** Los trozos de texto de un párrafo; un salto dentro del texto se ve como tal. */
function renderInline(inline: readonly RichInline[]): ReactNode {
  return inline.map((run, index) => (
    <Fragment key={index}>{renderRun(run)}</Fragment>
  ));
}

function renderRun(run: RichInline): ReactNode {
  // El editor guarda los saltos forzados dentro del texto, así que se pintan
  // como `<br>`: es lo único que separa dos líneas dentro de un mismo párrafo.
  const lines = run.text.split(/\r?\n/);
  const content: ReactNode[] = [];
  lines.forEach((line, index) => {
    if (index > 0) content.push(<br key={`br-${index}`} />);
    if (line !== "") content.push(<Fragment key={index}>{line}</Fragment>);
  });
  const marked = (run.marks ?? []).reduce<ReactNode>((inner, mark) => {
    if (mark === "bold") return <strong>{inner}</strong>;
    if (mark === "italic") return <em>{inner}</em>;
    if (mark === "underline") return <u>{inner}</u>;
    if (mark === "strike") return <s>{inner}</s>;
    return <code>{inner}</code>;
  }, content);
  return run.href !== undefined ? (
    <a href={run.href} target="_blank" rel="noreferrer">
      {marked}
    </a>
  ) : (
    marked
  );
}
