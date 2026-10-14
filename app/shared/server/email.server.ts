import { Resend } from "resend";

import { publicUrl } from "~/shared/lib/public-url";

// Envio de email (Resend). Só fica ligado com RESEND_API_KEY, EMAIL_FROM e o endereço
// público (APP_URL ou o domínio do Coolify): os links dos emails nunca saem do cabeçalho
// Host da requisição, que quem chama pode forjar.
type EmailConfig = { client: Resend; from: string; baseUrl: string };

let cached: EmailConfig | null | undefined;

function emailConfig(): EmailConfig | null {
  if (cached !== undefined) {
    return cached;
  }

  const apiKey = process.env.RESEND_API_KEY?.trim() ?? "";
  const from = process.env.EMAIL_FROM?.trim() ?? "";
  const baseUrl = publicUrl();

  cached = apiKey === "" || from === "" || baseUrl === null ? null : { client: new Resend(apiKey), from, baseUrl };

  // Configuração pela metade (ex.: chave sem EMAIL_FROM) desliga o envio: avisa no log em
  // vez de deixar o "esqueci minha senha" sem email sem ninguém saber por quê.
  if (cached === null && (apiKey !== "" || from !== "")) {
    const missing = [apiKey === "" && "RESEND_API_KEY", from === "" && "EMAIL_FROM", baseUrl === null && "APP_URL (ou COOLIFY_URL)"].filter(Boolean);
    console.warn(`Envio de email desligado: falta ${missing.join(", ")}.`);
  }

  return cached;
}

export function isEmailEnabled(): boolean {
  return emailConfig() !== null;
}

// Endereço público para montar links dentro dos emails (só com o envio ligado).
export function emailBaseUrl(): string | null {
  return emailConfig()?.baseUrl ?? null;
}

export type Email = { to: string; subject: string; text: string; html: string };

// true = o Resend aceitou. Falhas são registradas no log e não derrubam a requisição.
export async function sendEmail(email: Email): Promise<boolean> {
  const config = emailConfig();

  if (config === null) {
    return false;
  }

  try {
    const { error } = await config.client.emails.send({ from: config.from, ...email });

    if (error !== null) {
      console.error("Resend recusou o email:", error.message);

      return false;
    }

    return true;
  } catch (error) {
    console.error("Falha ao enviar email:", error);

    return false;
  }
}
