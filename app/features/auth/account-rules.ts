import { z } from "zod";

import type { ActionResult, FieldErrors } from "~/shared/lib/action-result";
import { requiredText, secret } from "~/shared/lib/form-schema";

// Regras de conta compartilhadas entre cadastro, "Minha conta" e redefinição de senha.
export const NAME_MAX = 60;
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 200;

export type AccountResult = ActionResult<{ errors: FieldErrors }>;

// --- Schemas dos formulários de conta -------------------------------------------------

const name = requiredText(`Informe seu nome (até ${NAME_MAX} caracteres).`).max(NAME_MAX, `Informe seu nome (até ${NAME_MAX} caracteres).`);
const email = z.string({ error: "Informe um email válido." }).trim().toLowerCase().pipe(z.email("Informe um email válido."));
const newPassword = secret(`A senha precisa ter pelo menos ${PASSWORD_MIN} caracteres.`)
  .refine((value) => value.length >= PASSWORD_MIN, `A senha precisa ter pelo menos ${PASSWORD_MIN} caracteres.`)
  .refine((value) => value.length <= PASSWORD_MAX, `A senha pode ter no máximo ${PASSWORD_MAX} caracteres.`);

export const loginSchema = z.object({ email, password: secret("Informe sua senha.") });

export const registerSchema = z.object({
  name,
  email,
  password: newPassword,
  // Só é conferido quando o painel exige convite; com o cadastro aberto o campo nem aparece.
  invite: z.string().trim().default(""),
});

export const changeNameSchema = z.object({ name });

export const changePasswordSchema = z
  .object({ current: secret("Informe sua senha atual."), next: newPassword })
  .refine((value) => value.current !== value.next, { path: ["next"], message: "A nova senha precisa ser diferente da atual." });

export const forgotPasswordSchema = z.object({ email });

export const resetPasswordSchema = z.object({ token: z.string().trim().default(""), password: newPassword });
