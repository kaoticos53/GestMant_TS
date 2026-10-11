import { describe, expect, test } from "vitest";

import {
  API_GRACE_MS,
  addressAnswers,
  addressTrouble,
  apiAddressTrouble,
  httpOriginOf,
  unreachableDocument,
} from "@/lib/apiAddress";

/**
 * Pruebas de la regla que decide si la dirección pública de la API responde
 * desde el navegador, y de la sonda que lo pregunta. Es lo que sostiene el aviso
 * del arranque: si aquí se colara un falso positivo, media app llevaría encima un
 * cartel rojo con la API funcionando.
 */

/** Lo que contesta la dirección cuando contesta. */
const answersWith = (init?: { answer?: boolean }) => {
  const calls: { url: string; init?: RequestInit }[] = [];
  const fetchImpl = (async (url: string, options?: RequestInit) => {
    calls.push({ url, init: options });
    if (init?.answer === false) throw new Error("sin respuesta");
    return {} as Response;
  }) as unknown as typeof fetch;
  return { fetchImpl, calls };
};

describe("la dirección de la API, en forma de página web", () => {
  test("el WebSocket del cliente se pregunta por HTTP", () => {
    expect(httpOriginOf("wss://api.tudominio.com")).toBe(
      "https://api.tudominio.com",
    );
    expect(httpOriginOf("ws://127.0.0.1:3210")).toBe("http://127.0.0.1:3210");
    expect(httpOriginOf("https://api.tudominio.com/sitio")).toBe(
      "https://api.tudominio.com",
    );
  });

  test("sin dirección legible no se inventa ninguna", () => {
    expect(httpOriginOf(null)).toBeNull();
    expect(httpOriginOf("  ")).toBeNull();
  });
});

describe("addressAnswers", () => {
  test("pregunta sin necesitar permiso de lectura, y sin cachear", async () => {
    const { fetchImpl, calls } = answersWith();

    await expect(
      addressAnswers("https://api.tudominio.com", { fetchImpl }),
    ).resolves.toBe(true);
    expect(calls[0]?.url).toBe("https://api.tudominio.com");
    // Opaca: no se quiere saber *qué* contesta, solo si hay alguien.
    expect(calls[0]?.init?.mode).toBe("no-cors");
    expect(calls[0]?.init?.cache).toBe("no-store");
  });

  test("si no contesta nadie, dice que no", async () => {
    const { fetchImpl } = answersWith({ answer: false });
    await expect(
      addressAnswers("https://api.tudominio.com", { fetchImpl }),
    ).resolves.toBe(false);
  });

  test("una dirección que se queda muda se corta por tiempo", async () => {
    // El corte se pide por señal: es lo que aborta una petición que no llega a
    // contestar nunca.
    const fetchImpl = ((_url: string, options?: RequestInit) =>
      new Promise((_resolve, reject) => {
        options?.signal?.addEventListener("abort", () =>
          reject(new Error("abortada")),
        );
      })) as unknown as typeof fetch;

    await expect(
      addressAnswers("https://api.tudominio.com", { fetchImpl, timeoutMs: 5 }),
    ).resolves.toBe(false);
  });

  test("sin dirección no hay nada que preguntar", async () => {
    const { fetchImpl, calls } = answersWith();
    await expect(addressAnswers(null, { fetchImpl })).resolves.toBe(false);
    expect(calls).toEqual([]);
  });
});

describe("apiAddressTrouble", () => {
  const base = {
    apiUrl: "https://api.tudominio.com",
    pageProtocol: "https:",
    waitedMs: API_GRACE_MS,
    answers: false,
  };

  test("si la app habla con la API, no hay nada que decir", () => {
    expect(apiAddressTrouble({ ...base, everConnected: true })).toBeNull();
    expect(apiAddressTrouble({ ...base, connected: true })).toBeNull();
  });

  test("dentro del margen no se avisa: puede estar arrancando", () => {
    expect(
      apiAddressTrouble({ ...base, waitedMs: API_GRACE_MS - 1 }),
    ).toBeNull();
    expect(apiAddressTrouble(base)).not.toBeNull();
  });

  test("sin dirección conocida no se puede juzgar nada", () => {
    expect(apiAddressTrouble({ ...base, apiUrl: null })).toBeNull();
  });

  test("una página HTTPS no llama a una API HTTP, y eso se dice", () => {
    const trouble = apiAddressTrouble({
      ...base,
      apiUrl: "http://192.168.1.10:3210",
      answers: null,
    });
    expect(trouble?.reason).toBe("Sin HTTPS");
    expect(trouble?.detail).toContain("contenido mixto");
    expect(trouble?.detail).toContain("CONVEX_CLOUD_ORIGIN");
    expect(trouble?.address).toBe("http://192.168.1.10:3210");
  });

  test("si contesta a una petición pero no entra la conexión en vivo, es el WebSocket", () => {
    const trouble = apiAddressTrouble({ ...base, answers: true });
    expect(trouble?.reason).toBe("Solo a medias");
    expect(trouble?.detail).toContain("WebSocket");
    // Y manda a donde se arregla, que es el paso del proxy inverso.
    expect(trouble?.detail).toContain("paso 6");
  });

  test("si no contesta nada, se enseña la dirección que no responde", () => {
    const trouble = apiAddressTrouble(base);
    expect(trouble?.reason).toBe("No responde");
    expect(trouble?.detail).toContain("https://api.tudominio.com");
    expect(trouble?.address).toBe("https://api.tudominio.com");
  });
});

describe("addressTrouble, para un enlace del expediente", () => {
  test("lo que se sabe sin pedirlo: el contenido mixto", () => {
    const trouble = addressTrouble("http://192.168.1.10:3210/api/storage/a", {
      apiUrl: "http://192.168.1.10:3210",
      pageProtocol: "https:",
    });
    expect(trouble?.reason).toBe("Sin HTTPS");
  });

  test("y el archivo que se sirve desde otro sitio", () => {
    const trouble = addressTrouble("https://files.ejemplo.com/informe.pdf", {
      apiUrl: "https://api.tudominio.com",
      pageProtocol: "https:",
    });
    expect(trouble?.reason).toBe("Otra dirección");
    expect(trouble?.detail).toContain("https://files.ejemplo.com");
    expect(trouble?.detail).toContain("https://api.tudominio.com");
  });

  test("un documento en la dirección de la API no tiene nada que avisar", () => {
    expect(
      addressTrouble("https://api.tudominio.com/api/storage/a", {
        apiUrl: "https://api.tudominio.com",
        pageProtocol: "https:",
      }),
    ).toBeNull();
    // Ni una dirección relativa, que no se puede juzgar.
    expect(addressTrouble("/api/storage/a", {})).toBeNull();
    expect(addressTrouble(null, {})).toBeNull();
  });
});

describe("unreachableDocument", () => {
  test("dice que no ha llegado y manda al aviso de arriba", () => {
    const trouble = unreachableDocument(
      "https://api.tudominio.com/api/storage/a",
    );
    expect(trouble.reason).toBe("No responde");
    expect(trouble.address).toBe("https://api.tudominio.com");
    expect(trouble.detail).toContain("el aviso de arriba");
  });
});
