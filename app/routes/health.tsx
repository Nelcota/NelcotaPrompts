import { getSql } from "~/shared/server/db.server";

export async function loader() {
  try {
    await getSql()`select 1`;

    return Response.json({ status: "ok" });
  } catch (error) {
    console.error("Healthcheck falhou:", error);

    return Response.json({ status: "error" }, { status: 503 });
  }
}
