const SLUG_MAX = 40;

// "Revisão de código (TS)" → "revisao-de-codigo-ts": nome de arquivo e de comando.
export function slugify(title: string): string {
  const slug = title
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .slice(0, SLUG_MAX)
    .replace(/^-+|-+$/g, "");

  return slug === "" ? "prompt" : slug;
}
