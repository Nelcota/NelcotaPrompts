// Seed opcional: cria um usuário de demonstração e alguns prompts.
import { count, eq } from "drizzle-orm";

import { hasVariables } from "../app/features/prompts/variables";
import { prompts as promptsTable, users } from "../app/shared/server/db/schema";
import { openDb } from "./cli";

const { client, db } = openDb();
const email = "demo@nelcota.local";
const password = "demo12345";
const passwordHash = await Bun.password.hash(password);

const [user] = await db
  .insert(users)
  .values({ email, name: "Demo", passwordHash })
  .onConflictDoUpdate({ target: users.email, set: { name: "Demo", passwordHash } })
  .returning({ id: users.id });

if (user === undefined) {
  console.error("Não foi possível criar o usuário demo.");
  await client.close();
  process.exit(1);
}

const prompts = [
  {
    title: "Code review de PR",
    body: "Revise o diff abaixo como um engenheiro sênior. Ordem: bugs reais, depois riscos de segurança, depois performance; estilo só se afetar legibilidade. Para cada ponto, cite arquivo e linha, explique o cenário que quebra e proponha o patch. Se não houver problema, diga isso em uma linha.\n\n{diff}",
    tags: ["código", "review"],
  },
  {
    title: "Testes para esta função",
    body: "Escreva testes em {framework} para a função abaixo. Cubra o caminho feliz, limites (vazio, nulo, máximo), erros esperados e um caso de regressão para cada branch. Não use mocks quando der para chamar o código real. Nomeie cada teste pelo comportamento, não pelo método.\n\n{codigo}",
    tags: ["testes"],
  },
  {
    title: "Commit a partir do diff",
    body: "Gere uma mensagem de commit no formato Conventional Commits para o diff abaixo. Assunto no imperativo, até 72 caracteres. No corpo, explique o porquê da mudança, não o quê. Se o diff mistura mudanças sem relação, sugira como dividir em commits.\n\n{diff}",
    tags: ["git"],
  },
  {
    title: "Debug pelo stack trace",
    body: "Tenho este erro em {linguagem}. Leia o stack trace, aponte o frame mais provável da causa (não o do sintoma), liste até 3 hipóteses em ordem de probabilidade e, para cada uma, o comando ou log que confirma ou descarta. Não proponha correção antes de confirmar a causa.\n\n{stack_trace}",
    tags: ["debug"],
  },
  {
    title: "Refactor seguro",
    body: "Refatore o código abaixo sem mudar o comportamento observável. Faça em passos pequenos, cada um compilável e testável isoladamente. Antes de começar, liste os testes que garantem o comportamento atual e os que faltam. Objetivo: {objetivo}.\n\n{codigo}",
    tags: ["código", "refactor"],
  },
  {
    title: "Analisar query lenta",
    body: "Analise a query e o EXPLAIN ANALYZE abaixo ({banco}). Identifique o nó mais caro, explique por que o planner escolheu esse plano e proponha índices ou reescritas. Para cada índice, estime o impacto em escrita e o tamanho.\n\n{query}\n\n{explain}",
    tags: ["sql", "performance"],
  },
];

const [existing] = await db.select({ total: count() }).from(promptsTable).where(eq(promptsTable.authorId, user.id));

if ((existing?.total ?? 0) > 0) {
  console.log(`Seed já aplicado. Login: ${email} / ${password} (senha redefinida).`);
  await client.close();
  process.exit(0);
}

await db.insert(promptsTable).values(prompts.map((prompt) => ({ ...prompt, authorId: user.id, hasVariables: hasVariables(prompt.body) })));

console.log(`Seed aplicado. Login: ${email} / ${password}`);
console.log("Atenção: essa conta tem senha pública. Não rode o seed em produção (ou apague a conta depois).");
await client.close();
