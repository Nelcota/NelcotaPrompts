// Gera um link de redefinição de senha para um amigo que esqueceu a dele (o painel admin
// também gera, em Usuários).
// Uso: bun run reset-link email@exemplo.com [https://endereco-do-nelcota-prompts]
// No Coolify: abra o Terminal do container e rode o comando acima.
import { createResetLink, RESET_TTL_MINUTES } from "../app/features/auth/server/password-reset.server";
import { fail, findUserByEmail, openDb, readEmailArg } from "./cli";

const USAGE = "Uso: bun run reset-link email@exemplo.com [https://endereco-do-nelcota-prompts]";

// "" = sem endereço (imprime só o caminho); null = endereço inválido.
function readBaseUrl(raw: string | undefined): string | null {
  const trimmed = raw?.trim() ?? "";

  if (trimmed === "") {
    return "";
  }

  try {
    const url = new URL(trimmed);

    return url.protocol === "http:" || url.protocol === "https:" ? url.origin : null;
  } catch {
    return null;
  }
}

// Tudo é validado antes de tocar no banco: gerar um link invalida o anterior.
const email = readEmailArg(USAGE);
const baseUrl = readBaseUrl(process.argv.slice(2).filter((arg) => !arg.startsWith("--"))[1]);

if (baseUrl === null) {
  fail(`Endereço inválido: use algo como https://prompts.seudominio.com. ${USAGE}`);
}

const connection = openDb();
const user = await findUserByEmail(connection, email);
const path = await createResetLink(user.id, connection.db);

if (path === null) {
  await connection.client.close();
  fail(`Nenhuma conta com o email ${email}.`);
}

console.log(`Link para ${user.name} (vale ${RESET_TTL_MINUTES} minutos, uma única vez):`);
console.log(baseUrl === "" ? path : `${baseUrl}${path}`);

if (baseUrl === "") {
  console.log("(Coloque o endereço do Nelcota Prompts antes do caminho acima.)");
}

await connection.client.close();
