// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { HtmlFrame } from "@/pages/dashboard/mailbox/HtmlFrame";
import {
  cidUrlMap,
  hasRemoteImages,
  replaceCidReferences,
} from "@/pages/dashboard/mailbox/html";
import { settle } from "./settle";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

describe("HTML del visor", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("resuelve cid: solo contra adjuntos propios y detecta imágenes remotas", () => {
    const urls = cidUrlMap([
      { contentId: "logo@rtva", url: "https://storage.example/logo" },
    ]);
    expect(replaceCidReferences('<img src="cid:logo@rtva">', urls)).toContain(
      'src="https://storage.example/logo"',
    );
    expect(replaceCidReferences('<img src="cid:otra">', urls)).toBe(
      '<img src="cid:otra">',
    );
    expect(hasRemoteImages('<img src="https://tracker.example/x">')).toBe(true);
    expect(hasRemoteImages('<img src="cid:logo@rtva">')).toBe(false);
  });

  it("sanea scripts, bloquea imágenes remotas y aplica el CSP en el iframe", async () => {
    await act(async () => {
      root.render(
        <HtmlFrame
          html={
            '<script>alert(1)</script><p>Hola</p><img src="https://tracker.example/x"><img src="cid:logo@rtva">'
          }
          attachments={[
            {
              contentId: "logo@rtva",
              url: "https://storage.example/logo",
            },
          ]}
        />,
      );
      await settle();
    });

    const frame = container.querySelector("iframe");
    expect(frame).not.toBeNull();
    const srcdoc = frame?.getAttribute("srcdoc") ?? "";
    expect(srcdoc).toContain("Content-Security-Policy");
    expect(srcdoc).toContain("default-src 'none'");
    expect(srcdoc).toContain("img-src data: https://storage.example");
    expect(srcdoc).not.toContain("<script");
    expect(srcdoc).not.toContain("tracker.example");
    expect(srcdoc).toContain("https://storage.example/logo");
    expect(frame?.getAttribute("sandbox")).toBe("allow-same-origin");

    const show = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.includes("Mostrar imágenes remotas"),
    );
    expect(show).not.toBeUndefined();
    await act(async () => {
      show?.click();
      await settle();
    });
    const allowed = frame?.getAttribute("srcdoc") ?? "";
    expect(allowed).toContain("https://tracker.example/x");
    expect(allowed).toContain("img-src data: https://storage.example https:");
  });
});
