/**
 * Cliente ligero para endpoints de embeddings compatibles con OpenAI / Ollama (`/embeddings`).
 * Opcional: si no se configura un codificador, la memoria funciona al 100% con FTS + BM25/sinónimos.
 */
export async function fetchEmbeddingVector(args: {
  baseUrl: string;
  apiKey?: string;
  model: string;
  input: string;
}): Promise<number[]> {
  const base = args.baseUrl.replace(/\/+$/, "");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (args.apiKey && args.apiKey.trim() !== "") {
    headers.Authorization = `Bearer ${args.apiKey.trim()}`;
  }

  const response = await fetch(`${base}/embeddings`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: args.model,
      input: args.input.slice(0, 2000),
    }),
  });

  if (!response.ok) {
    throw new Error(`Error del codificador vectorial (HTTP ${response.status}).`);
  }

  const payload = (await response.json()) as {
    data?: Array<{ embedding?: unknown }>;
  };
  const vec = payload.data?.[0]?.embedding;
  if (!Array.isArray(vec) || vec.length === 0) {
    throw new Error("El codificador vectorial no devolvió un vector válido.");
  }
  return vec.map((n) => Number(n));
}
