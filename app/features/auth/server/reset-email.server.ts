import { escapeHtml } from "~/shared/lib/escape-html";
import type { Email } from "~/shared/server/email.server";
import { RESET_TTL_MINUTES } from "./password-reset.server";

// Email com o link de redefinição de senha: texto puro e um HTML simples, sem imagens.
export function resetPasswordEmail({ to, name, link }: { to: string; name: string; link: string }): Email {
  const subject = "Redefinir sua senha no Nelcota Prompts";
  const text = [
    `Olá, ${name}.`,
    "",
    "Recebemos um pedido para redefinir sua senha no Nelcota Prompts. Para escolher uma nova, abra:",
    link,
    "",
    `O link vale por ${RESET_TTL_MINUTES} minutos e funciona uma única vez. Se não foi você, ignore este email: sua senha continua a mesma.`,
  ].join("\n");
  const html = `<!doctype html>
<html lang="pt-BR">
  <body style="margin:0;padding:32px 16px;background:#f6f5f2;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1a1a1a">
    <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:16px;padding:32px">
      <p style="margin:0 0 8px;font-size:13px;color:#777">Nelcota Prompts</p>
      <h1 style="margin:0 0 16px;font-size:22px">Redefinir senha</h1>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.5">Olá, ${escapeHtml(name)}. Recebemos um pedido para redefinir sua senha.</p>
      <p style="margin:0 0 24px"><a href="${escapeHtml(link)}" style="display:inline-block;background:#1a1a1a;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:999px;font-size:15px;font-weight:600">Escolher nova senha</a></p>
      <p style="margin:0 0 8px;font-size:13px;line-height:1.5;color:#777">O link vale por ${RESET_TTL_MINUTES} minutos e funciona uma única vez. Se não foi você, ignore este email: sua senha continua a mesma.</p>
      <p style="margin:0;font-size:12px;line-height:1.5;color:#999;word-break:break-all">${escapeHtml(link)}</p>
    </div>
  </body>
</html>`;

  return { to, subject, text, html };
}
