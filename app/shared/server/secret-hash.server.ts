import { createHash } from "node:crypto";

// Hash dos segredos que só existem do lado de quem os recebeu (link de redefinir senha,
// token de API, código OAuth): o banco guarda só isto. São valores aleatórios de 256 bits,
// então SHA-256 basta (não é senha escolhida por gente).
export function hashSecret(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
