import { api } from "@/convex/_generated/api";
import { richDocToHtml, richDocToStore } from "@/lib/richDoc";
import {
  MAX_FILE_SIZE_LABEL,
  compressForUpload,
  exceedsFileLimit,
  uploadToStorage,
} from "@/lib/upload";
import { cn } from "@/lib/utils";
import { getErrorMessage } from "@/lib/workshop";
import Image from "@tiptap/extension-image";
import { Placeholder } from "@tiptap/extensions";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useAction, useMutation } from "convex/react";
import {
  Bold,
  Image as ImageIcon,
  Italic,
  List,
  ListOrdered,
  Loader2,
  Maximize2,
  Quote,
  Redo2,
  Strikethrough,
  Underline,
  Undo2,
} from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";

import type { RichTextEditorProps } from "./types";

/**
 * Editor de las notas y las descripciones: negrita, cursiva, listas, citas e
 * imágenes, con barra de herramientas (no hace falta saberse ningún código).
 *
 * Lo que entra y lo que sale es el documento tal y como se guarda (los bloques
 * en JSON que entiende `richDoc`), así que quien lo use guarda siempre lo mismo
 * que se pinta. Por dentro el editor sigue hablando HTML —es lo que come
 * TipTap—, pero ese HTML se traduce en cada pasada: al abrir una nota antigua
 * se leen sus bloques y al escribir se guarda su documento. Una nota de
 * siempre —texto plano— se abre sin perder nada: cada línea es un párrafo.
 *
 * Las imágenes se suben al almacenamiento del taller en cuanto se eligen y a
 * la nota solo va su dirección, igual que los adjuntos de una petición. Con
 * sesión suben por donde suben siempre; en el formulario público, donde no hay
 * cuenta, van por su propio camino y cada archivo se acredita antes de
 * aceptarlo (ver `imageUploads`).
 *
 * Y cuando una nota pide sitio, el botón de la barra la abre en grande, en un
 * diálogo, con el mismo campo dentro: se escribe cómodo y lo escrito sigue
 * siendo lo mismo que hay en la ficha.
 */

/** Lo que necesita el campo de escritura en sí, sin la puerta a abrirlo en grande. */
type EditorSurfaceProps = RichTextEditorProps & {
  /** El cursor va al final nada más montar: el diálogo se abre para escribir. */
  autoFocus?: boolean;
  /** Si viene, la barra lleva su botón de abrirlo en grande. */
  onExpand?: () => void;
};

/**
 * El campo de notas y descripciones, con la puerta a escribirlo en grande.
 *
 * `EditorSurface` es el campo tal cual; aquí solo se decide si lleva el botón
 * de abrirlo en un diálogo y se monta ese diálogo con el mismo campo dentro.
 * No hay nada que guardar aparte: los dos reciben el valor y lo devuelven por
 * el mismo `onChange`, así que lo que se escribe en grande queda en el campo
 * en cada pulsación y solo queda cerrar.
 */
export function RichTextEditorCore({
  compact = false,
  disabled = false,
  expandable,
  ...editor
}: RichTextEditorProps) {
  const [expanded, setExpanded] = useState(false);
  // El compositor de un chat no lleva el botón: el mensaje es corto y el
  // diálogo taparía justo la conversación que se está leyendo.
  const canExpand = (expandable ?? !compact) && !disabled;

  return (
    <>
      <EditorSurface
        {...editor}
        compact={compact}
        disabled={disabled}
        {...(canExpand ? { onExpand: () => setExpanded(true) } : {})}
      />

      {/*
        Se monta al abrir y se desmonta al cerrar, así que cada vez es un
        editor nuevo con lo que hay en ese momento: no hay que mantener dos
        sincronizados más allá de lo que ya hace el valor del padre.
      */}
      {canExpand && (
        <Dialog open={expanded} onOpenChange={setExpanded}>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
            <DialogHeader>
              <DialogTitle>Escribir en grande</DialogTitle>
              <DialogDescription>
                Es el mismo campo, con más sitio. Lo que escribas aquí queda
                guardado igual; cierra cuando termines.
              </DialogDescription>
            </DialogHeader>
            <EditorSurface
              {...editor}
              id={editor.id ? `${editor.id}-ampliado` : undefined}
              disabled={disabled}
              autoFocus
              className={cn(
                "rich-text-grande text-base leading-6",
                editor.className,
              )}
            />
            <DialogFooter>
              <Button type="button" onClick={() => setExpanded(false)}>
                Listo
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

/** El campo en sí: la barra de herramientas y el hueco de escritura. */
function EditorSurface({
  id,
  value,
  onChange,
  placeholder,
  disabled = false,
  imageUploads = "session",
  compact = false,
  className,
  autoFocus = false,
  onExpand,
}: EditorSurfaceProps) {
  const generateImageUploadUrl = useMutation(
    api.uploads.generateImageUploadUrl,
  );
  const imageUrl = useMutation(api.uploads.imageUrl);
  const generateReportUploadUrl = useMutation(
    api.reportUploads.generateUploadUrl,
  );
  // La acreditación del formulario público es una acción: es la única pieza
  // que puede mirar los bytes del archivo antes de aceptarlo.
  const attachReportImage = useAction(api.reportUploads.attachImage);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  // Último documento que ha salido del editor: es lo que evita reescribirlo
  // cuando el valor que devuelve el padre es justo el que se acaba de emitir.
  const lastEmitted = useRef(richDocToStore(value) ?? "");

  // Referencia mutable a la función de subida para que los callbacks de
  // ProseMirror (handlePaste y handleDrop) siempre tengan la versión fresca.
  const insertImageFileRef = useRef<(file: File) => Promise<void>>(undefined);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [3, 4] },
        link: { openOnClick: false, autolink: true },
        // El código en bloque no cabe en una nota del cuaderno: solo el `code`.
        codeBlock: false,
      }),
      Placeholder.configure({ placeholder: placeholder ?? "" }),
      Image.configure({ allowBase64: false }),
    ],
    content: richDocToHtml(value),
    editable: !disabled,
    autofocus: autoFocus ? "end" : false,
    // La barra tiene que repintarse al cambiar de formato (negrita activa, etc.).
    shouldRerenderOnTransaction: true,
    editorProps: {
      attributes: {
        ...(id ? { id } : {}),
        class: cn(
          "rich-text px-3 py-2 text-sm outline-none",
          compact && "rich-text-compact",
          className,
        ),
      },
      handlePaste: (_view, event) => {
        if (disabled) return false;
        // 1. Archivos en clipboardData.files (copiar archivo de imagen y pegar)
        const files = event.clipboardData?.files;
        if (files && files.length > 0) {
          const imageFile = Array.from(files).find((f) =>
            f.type.startsWith("image/"),
          );
          if (imageFile) {
            event.preventDefault();
            void insertImageFileRef.current?.(imageFile);
            return true;
          }
        }
        // 2. Items en clipboardData.items (capturas de pantalla con Win+Shift+S / Impr Pant)
        const items = event.clipboardData?.items;
        if (items && items.length > 0) {
          for (let i = 0; i < items.length; i++) {
            const item = items[i];
            if (item.type.startsWith("image/")) {
              const file = item.getAsFile();
              if (file) {
                event.preventDefault();
                void insertImageFileRef.current?.(file);
                return true;
              }
            }
          }
        }
        return false;
      },
      handleDrop: (_view, event, _slice, moved) => {
        if (disabled || moved) return false;
        const files = event.dataTransfer?.files;
        if (files && files.length > 0) {
          const imageFile = Array.from(files).find((f) =>
            f.type.startsWith("image/"),
          );
          if (imageFile) {
            event.preventDefault();
            void insertImageFileRef.current?.(imageFile);
            return true;
          }
        }
        return false;
      },
    },
    onUpdate: ({ editor: instance }) => {
      // Lo que se queda el padre es el documento, no el HTML del editor: los
      // párrafos vacíos del final los recorta `richDocToStore`.
      const doc = richDocToStore(instance.getHTML()) ?? "";
      lastEmitted.current = doc;
      onChange(doc);
    },
  });

  // El editor no tiene vista hasta que monta: antes de eso no se le puede
  // preguntar por su HTML ni por el formato que hay en el cursor.
  const ready = Boolean(editor?.isInitialized);
  const isActive = (name: string) => ready && (editor?.isActive(name) ?? false);
  const canRun = (name: "undo" | "redo") =>
    ready && (editor?.can()[name]() ?? false);

  // Un valor que llega de fuera (abrir otra nota para corregirla) sustituye al
  // del editor. Mientras se escribe no se toca: el editor manda.
  useEffect(() => {
    if (!editor?.isInitialized) return;
    const next = richDocToStore(value) ?? "";
    if (next === lastEmitted.current) return;
    lastEmitted.current = next;
    if (editor.isFocused) return;
    editor.commands.setContent(richDocToHtml(value), { emitUpdate: false });
  }, [editor, value]);

  useEffect(() => {
    editor?.setEditable(!disabled);
  }, [editor, disabled]);

  /** Sube la imagen por el camino que toque y devuelve su dirección. */
  const uploadImage = async (file: File): Promise<string> => {
    if (imageUploads === "publicReport") {
      // Sin cuenta no hay sesión que valga: se pide el vale, se sube el archivo
      // y se acredita con él. Sin ese último paso la imagen no sirve para la
      // incidencia, así que el aviso no puede enviarse con ella a medias.
      const { uploadUrl, ticket } = await generateReportUploadUrl({});
      const storageId = await uploadToStorage(uploadUrl, file);
      const url = await attachReportImage({ ticket, storageId });
      if (!url) throw new Error("La imagen subida no se ha podido enlazar.");
      return url;
    }
    const storageId = await uploadToStorage(
      await generateImageUploadUrl(),
      file,
    );
    const url = await imageUrl({ storageId });
    if (!url) throw new Error("La imagen subida no se ha podido enlazar.");
    return url;
  };

  const insertImageFile = async (picked: File) => {
    if (!picked || !editor) return;
    if (!picked.type.startsWith("image/")) {
      toast.error(`${picked.name}: solo se pueden insertar imágenes`);
      return;
    }
    setUploadingImage(true);
    try {
      // La foto se recomprime aquí, antes de mirar el tope: la de un móvil pesa
      // varios megas de más y al subirla se queda en unos cientos de kB.
      const file = await compressForUpload(picked);
      if (exceedsFileLimit(file)) {
        toast.error(`${picked.name}: supera los ${MAX_FILE_SIZE_LABEL}`);
        return;
      }
      const url = await uploadImage(file);
      editor.chain().focus().setImage({ src: url, alt: file.name }).run();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setUploadingImage(false);
    }
  };

  // Pegar o soltar una foto ocurre después de pintar, así que la referencia se
  // refresca ahí: los manejadores de ProseMirror leen siempre la versión del
  // último pintado, con el estado de ese momento.
  useEffect(() => {
    insertImageFileRef.current = insertImageFile;
  });

  const insertImage = async (chosen: FileList | null) => {
    const picked = chosen?.[0];
    if (picked) await insertImageFile(picked);
  };

  const tool = (
    label: string,
    active: boolean,
    onClick: () => void,
    icon: ReactNode,
    extraDisabled = false,
  ) => (
    <Button
      key={label}
      type="button"
      variant="ghost"
      size="icon"
      className={cn("size-7", active && "bg-muted text-foreground")}
      aria-label={label}
      aria-pressed={active}
      title={label}
      disabled={disabled || extraDisabled}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
    >
      {icon}
    </Button>
  );

  return (
    <div
      className={cn(
        "rounded-md border border-input bg-transparent shadow-xs transition-[color,box-shadow] focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50",
        disabled && "opacity-60",
      )}
    >
      <div className="flex flex-wrap items-center gap-0.5 border-b border-border/60 px-1 py-1">
        {tool(
          "Negrita",
          isActive("bold"),
          () => editor?.chain().focus().toggleBold().run(),
          <Bold className="size-3.5" />,
        )}
        {tool(
          "Cursiva",
          isActive("italic"),
          () => editor?.chain().focus().toggleItalic().run(),
          <Italic className="size-3.5" />,
        )}
        {tool(
          "Subrayado",
          isActive("underline"),
          () => editor?.chain().focus().toggleUnderline().run(),
          <Underline className="size-3.5" />,
        )}
        {tool(
          "Tachado",
          isActive("strike"),
          () => editor?.chain().focus().toggleStrike().run(),
          <Strikethrough className="size-3.5" />,
        )}
        <span className="mx-1 h-4 w-px bg-border" aria-hidden="true" />
        {tool(
          "Lista",
          isActive("bulletList"),
          () => editor?.chain().focus().toggleBulletList().run(),
          <List className="size-3.5" />,
        )}
        {tool(
          "Lista numerada",
          isActive("orderedList"),
          () => editor?.chain().focus().toggleOrderedList().run(),
          <ListOrdered className="size-3.5" />,
        )}
        {tool(
          "Cita",
          isActive("blockquote"),
          () => editor?.chain().focus().toggleBlockquote().run(),
          <Quote className="size-3.5" />,
        )}
        <span className="mx-1 h-4 w-px bg-border" aria-hidden="true" />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7"
          aria-label={
            uploadingImage ? "Subiendo la imagen…" : "Insertar imagen"
          }
          title="Insertar imagen"
          disabled={disabled || !ready || uploadingImage}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => fileInputRef.current?.click()}
        >
          {uploadingImage ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <ImageIcon className="size-3.5" />
          )}
        </Button>
        <span className="mx-1 h-4 w-px bg-border" aria-hidden="true" />
        {tool(
          "Deshacer",
          false,
          () => editor?.chain().focus().undo().run(),
          <Undo2 className="size-3.5" />,
          !canRun("undo"),
        )}
        {tool(
          "Rehacer",
          false,
          () => editor?.chain().focus().redo().run(),
          <Redo2 className="size-3.5" />,
          !canRun("redo"),
        )}
        {onExpand && (
          <>
            <span className="mx-1 h-4 w-px bg-border" aria-hidden="true" />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="ml-auto size-7"
              aria-label="Escribir en grande"
              title="Escribir en grande"
              onMouseDown={(event) => event.preventDefault()}
              onClick={onExpand}
            >
              <Maximize2 className="size-3.5" />
            </Button>
          </>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          void insertImage(event.target.files);
          event.target.value = "";
        }}
      />

      <EditorContent editor={editor} />

      {uploadingImage && (
        <p className="border-t border-border/60 px-3 py-1.5 text-xs text-muted-foreground">
          Subiendo la imagen al taller…
        </p>
      )}
    </div>
  );
}

export default RichTextEditorCore;
