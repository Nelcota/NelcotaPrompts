// Gera um link de redefinição de senha para um amigo que esqueceu a dele (o painel admin
// também gera, em Usuários).
// Uso: bun run reset-link email@exemplo.com [https://endereco-do-nelcota-prompts]
// No Coolify: abra o Terminal do container e rode o comando acima. Sem o endereço, vale o
// APP_URL (ou o domínio do Coolify).
import { createResetLink, RESET_TTL_MINUTES } from "../app/features/auth/server/password-reset.server";
import { publicUrl, toOrigin } from "../app/shared/lib/public-url";
import { fail, findUserByEmail, openDb, readEmailArg } from "./cli";

const USAGE = "Uso: bun run reset-link email@exemplo.com [https://endereco-do-nelcota-prompts]";

// Tudo é validado antes de tocar no banco: gerar um link invalida o anterior.
const email = readEmailArg(USAGE);
const baseArg = process.argv.slice(2).filter((arg) => !arg.startsWith("--"))[1];
const baseUrl = baseArg === undefined ? publicUrl() : toOrigin(baseArg);

if (baseArg !== undefined && baseUrl === null) {
  fail(`Endereço inválido: use algo como https://prompts.seudominio.com. ${USAGE}`);
}

const connection = openDb();
const user = await findUserByEmail(connection, email);
const path = await createResetLink(user.id, connection.db);

if (path === null) {
  await connection.client.close();
  // A conta existe (findUserByEmail achou): null aqui é conta bloqueada (ou excluída agora).
  fail(`A conta ${email} está bloqueada (ou acabou de ser excluída). Desbloqueie no painel antes de gerar o link.`);
}

console.log(`Link para ${user.name} (vale ${RESET_TTL_MINUTES} minutos, uma única vez):`);
console.log(baseUrl === null ? path : `${baseUrl}${path}`);

if (baseUrl === null) {
  console.log("(Coloque o endereço do Nelcota Prompts antes do caminho acima.)");
}

await connection.client.close();
