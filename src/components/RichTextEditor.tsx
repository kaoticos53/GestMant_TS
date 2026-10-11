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
  Quote,
  Redo2,
  Strikethrough,
  Underline,
  Undo2,
} from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "./ui/button";

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
 */

/** Por dónde sube la imagen: la sesión del taller o el camino del formulario público. */
type ImageUploads = "session" | "publicReport";

export function RichTextEditor({
  id,
  value,
  onChange,
  placeholder,
  disabled = false,
  imageUploads = "session",
  compact = false,
  className,
}: {
  id?: string;
  /** El documento guardado, o el texto de una nota anterior. */
  value: string;
  /** El documento tal y como se guarda (`""` si la nota se ha quedado vacía). */
  onChange: (doc: string) => void;
  placeholder?: string;
  disabled?: boolean;
  /**
   * Por dónde sube la imagen. Con sesión (por defecto) basta con estar dentro
   * de la aplicación; el formulario público no tiene cuenta, así que usa el
   * camino del reporte, que comprueba el archivo antes de aceptarlo.
   */
  imageUploads?: ImageUploads;
  /**
   * Sin el hueco de escritura de una ficha: para los sitios donde el editor
   * comparte sitio con otras cosas —el compositor de un chat, por ejemplo— y
   * no puede quedarse con media pantalla.
   */
  compact?: boolean;
  className?: string;
}) {
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

  const insertImage = async (chosen: FileList | null) => {
    const picked = chosen?.[0];
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
