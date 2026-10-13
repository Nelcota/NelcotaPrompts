import { AuthShell } from "~/features/auth/components/auth-shell";

export function meta() {
  return [{ title: "Esqueci minha senha · Nelcota Prompts" }];
}

// Sem envio de email: quem administra o Nelcota Prompts gera um link de uso único.
export default function ForgotPassword() {
  return (
    <AuthShell
      title="Redefinir senha"
      subtitle="Não há envio de email. Um admin gera um link de uso único."
      footer={{ text: "Lembrou?", linkLabel: "Entrar", to: "/login" }}
    >
      <div className="space-y-4 rounded-3xl border border-line bg-surface/70 p-5 text-base">
        <p>No servidor, o admin roda:</p>
        <pre className="overflow-x-auto rounded-2xl bg-canvas px-4 py-3 font-mono text-sm">bun run reset-link seu@email.com</pre>
        <p className="text-sm text-muted">O link vale por 1 hora e funciona uma única vez.</p>
      </div>
    </AuthShell>
  );
}
