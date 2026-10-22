import { describe, expect, test } from "vitest";
import { withAttempt } from "@/components/attachmentImage/helpers";

describe("attachmentImage/helpers - withAttempt", () => {
  test("intento 0 devuelve la URL original intacta", () => {
    const url = "https://taller.empresa.es/adjuntos/foto1.jpg";
    expect(withAttempt(url, 0)).toBe(url);
  });

  test("intento mayor a 0 añade el parámetro reintento", () => {
    const url = "https://taller.empresa.es/adjuntos/foto1.jpg";
    const result = withAttempt(url, 1);
    expect(result).toBe("https://taller.empresa.es/adjuntos/foto1.jpg?reintento=1");
  });

  test("intento posterior preserva parámetros previos en la URL", () => {
    const url = "https://taller.empresa.es/adjuntos/foto1.jpg?token=abc123xyz";
    const result = withAttempt(url, 2);
    expect(result).toBe(
      "https://taller.empresa.es/adjuntos/foto1.jpg?token=abc123xyz&reintento=2",
    );
  });

  test("actualiza el valor de reintento si ya existía previamente", () => {
    const url = "https://taller.empresa.es/adjuntos/foto1.jpg?reintento=1";
    const result = withAttempt(url, 2);
    expect(result).toBe("https://taller.empresa.es/adjuntos/foto1.jpg?reintento=2");
  });

  test("si la URL es inválida devuelve la string original sin arrojar excepción", () => {
    const invalidUrl = "no-es-una-url-valida";
    expect(withAttempt(invalidUrl, 1)).toBe(invalidUrl);
  });
});
