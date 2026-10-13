// Dá (ou tira) acesso ao painel admin. Serve para criar o primeiro admin; depois, admins
// promovem outros pelo próprio painel.
// Uso: bun run make-admin email@exemplo.com [--remover]
// No Coolify: abra o Terminal do container e rode o comando acima.
import { eq } from "drizzle-orm";

import { users } from "../app/shared/server/db/schema";
import { findUserByEmail, openDb, readEmailArg } from "./cli";

const remove = process.argv.includes("--remover");
const email = readEmailArg("Uso: bun run make-admin email@exemplo.com [--remover]");
const connection = openDb();
const user = await findUserByEmail(connection, email);

await connection.db.update(users).set({ isAdmin: !remove }).where(eq(users.id, user.id));
console.log(remove ? `${user.name} (${email}) não é mais admin.` : `${user.name} (${email}) agora é admin. O painel fica em /admin.`);
await connection.client.close();
