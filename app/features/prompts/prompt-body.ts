import type { Prompt } from "./types";

// Cache por id + updatedAt: depois de uma edição a chave muda e o corpo é buscado de novo.
const cache = new Map<string, string>();

function cacheKey(prompt: Prompt): string {
  return `${prompt.id}:${prompt.updatedAt}`;
}

function isBodyPayload(value: unknown): value is { body: string } {
  if (typeof value !== "object" || value === null || !("body" in value)) {
    return false;
  }

  return typeof value.body === "string";
}

export function cachedBody(prompt: Prompt): string | null {
  if (!prompt.truncated) {
    return prompt.excerpt;
  }

  return cache.get(cacheKey(prompt)) ?? null;
}

export async function loadBody(prompt: Prompt): Promise<string | null> {
  const cached = cachedBody(prompt);

  if (cached !== null) {
    return cached;
  }

  try {
    const response = await fetch(`/prompt/${encodeURIComponent(prompt.id)}`, {
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      return null;
    }

    const payload: unknown = await response.json();

    if (!isBodyPayload(payload)) {
      return null;
    }

    cache.set(cacheKey(prompt), payload.body);

    return payload.body;
  } catch {
    return null;
  }
}
