import DOMPurify from "dompurify";
import { useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ImageOff, Images } from "lucide-react";
import {
  cidUrlMap,
  hasRemoteImages,
  replaceCidReferences,
  storageOrigins,
  type CidAttachment,
} from "./html";

const FORBID_TAGS = [
  "script",
  "iframe",
  "object",
  "embed",
  "base",
  "form",
  "link",
  "meta",
];

function sanitizedHtml(
  html: string,
  attachments: readonly CidAttachment[],
  allowRemote: boolean,
  allowedOrigins: readonly string[],
): string {
  const withCid = replaceCidReferences(html, cidUrlMap(attachments));
  const clean = DOMPurify.sanitize(withCid, {
    USE_PROFILES: { html: true },
    FORBID_TAGS,
    FORBID_ATTR: ["srcset"],
    ALLOW_DATA_ATTR: false,
  });
  const document = new DOMParser().parseFromString(clean, "text/html");

  for (const image of document.querySelectorAll("img")) {
    const source = image.getAttribute("src") ?? "";
    if (!/^https?:/i.test(source)) continue;
    let ownStorage = false;
    try {
      ownStorage = allowedOrigins.includes(new URL(source).origin);
    } catch {
      ownStorage = false;
    }
    if (!allowRemote && !ownStorage) image.removeAttribute("src");
  }
  for (const link of document.querySelectorAll("a")) {
    const href = link.getAttribute("href") ?? "";
    // Sin ventanas emergentes en el sandbox, pero tampoco se deja que un enlace
    // sustituya el iframe por una página externa.
    if (/^https?:/i.test(href)) {
      link.setAttribute("target", "_blank");
      link.setAttribute("rel", "noopener noreferrer");
    }
  }
  return document.body.innerHTML;
}

interface Rgb {
  r: number;
  g: number;
  b: number;
  a: number;
}

function parseRgb(value: string): Rgb | null {
  const match = /rgba?\(([^)]+)\)/.exec(value);
  if (!match) return null;
  const parts = match[1].split(",").map((part) => Number(part.trim()));
  if (parts.length < 3 || parts.some((part) => !Number.isFinite(part))) {
    return null;
  }
  return {
    r: parts[0] ?? 0,
    g: parts[1] ?? 0,
    b: parts[2] ?? 0,
    a: parts[3] ?? 1,
  };
}

function relativeLuminance(color: Rgb): number {
  const channel = (value: number) => {
    const normalized = value / 255;
    return normalized <= 0.03928
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4;
  };
  return (
    0.2126 * channel(color.r) +
    0.7152 * channel(color.g) +
    0.0722 * channel(color.b)
  );
}

function contrast(a: Rgb, b: Rgb): number {
  const light = Math.max(relativeLuminance(a), relativeLuminance(b));
  const dark = Math.min(relativeLuminance(a), relativeLuminance(b));
  return (light + 0.05) / (dark + 0.05);
}

function effectiveBackground(element: Element, view: Window): Rgb {
  for (let node: Element | null = element; node; node = node.parentElement) {
    const background = parseRgb(view.getComputedStyle(node).backgroundColor);
    if (background && background.a > 0.5) return background;
  }
  return { r: 255, g: 255, b: 255, a: 1 };
}

/** Ajusta solo el texto que no se lee sobre su fondo efectivo. */
function applyReadableContrast(frame: HTMLIFrameElement): void {
  const document = frame.contentDocument;
  const view = frame.contentWindow;
  if (!document || !view) return;
  for (const element of document.body.querySelectorAll<HTMLElement>("*")) {
    const hasOwnText = Array.from(element.childNodes).some(
      (node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trim(),
    );
    if (!hasOwnText) continue;
    const foreground = parseRgb(view.getComputedStyle(element).color);
    if (!foreground) continue;
    const background = effectiveBackground(element, view);
    if (contrast(foreground, background) >= 4.5) continue;
    const darkBackground = relativeLuminance(background) < 0.5;
    element.style.setProperty(
      "color",
      darkBackground ? "#f0f0f0" : "#1b1b1f",
      "important",
    );
  }
}

function frameDocument(
  html: string,
  attachments: readonly CidAttachment[],
  allowRemote: boolean,
): string {
  const origins = storageOrigins(attachments, window.location.origin);
  const imageSources = ["data:", ...origins, ...(allowRemote ? ["https:"] : [])]
    .join(" ")
    .trim();
  const csp =
    `default-src 'none'; img-src ${imageSources}; style-src 'unsafe-inline'; ` +
    "font-src data:; base-uri 'none'; form-action 'none'";
  return (
    '<!doctype html><html><head><meta charset="utf-8">' +
    '<meta name="color-scheme" content="light">' +
    `<meta http-equiv="Content-Security-Policy" content="${csp}">` +
    "<style>:root{color-scheme:light}html,body{background:#fff;color:#1b1b1f}" +
    "body{margin:0;padding:1rem;font:14px/1.55 system-ui,-apple-system,'Segoe UI',sans-serif;overflow-wrap:anywhere}" +
    "img{max-width:100%;height:auto}a{color:#0b5cad}pre{white-space:pre-wrap}" +
    "</style></head><body>" +
    sanitizedHtml(html, attachments, allowRemote, origins) +
    "</body></html>"
  );
}

export function HtmlFrame({
  html,
  attachments,
}: {
  html: string;
  attachments: readonly CidAttachment[];
}) {
  const iframe = useRef<HTMLIFrameElement | null>(null);
  const [allowRemote, setAllowRemote] = useState(false);
  const hasRemote = useMemo(() => hasRemoteImages(html), [html]);
  const document = useMemo(
    () => frameDocument(html, attachments, allowRemote),
    [html, attachments, allowRemote],
  );

  return (
    <div className="relative h-full min-h-[18rem] overflow-hidden rounded-lg border border-border/60 bg-white">
      {hasRemote && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <ImageOff className="size-3.5" />
            {allowRemote
              ? "Imágenes remotas visibles para este mensaje."
              : "Las imágenes remotas están bloqueadas por privacidad."}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 gap-1.5"
            onClick={() => setAllowRemote((value) => !value)}
          >
            <Images className="size-3.5" />
            {allowRemote ? "Bloquear imágenes" : "Mostrar imágenes remotas"}
          </Button>
        </div>
      )}
      <iframe
        ref={iframe}
        title="Contenido del mensaje"
        sandbox="allow-same-origin"
        referrerPolicy="no-referrer"
        srcDoc={document}
        onLoad={() => {
          if (iframe.current) applyReadableContrast(iframe.current);
        }}
        className="h-full min-h-[18rem] w-full border-0"
      />
    </div>
  );
}
