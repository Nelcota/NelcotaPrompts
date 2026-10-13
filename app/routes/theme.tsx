import { data } from "react-router";

import { serializeTheme } from "~/features/theme/server/theme.server";
import { readForm } from "~/shared/server/validation.server";
import type { Route } from "./+types/theme";

export async function action({ request }: Route.ActionArgs) {
  const form = await readForm(request);

  if (form === null) {
    return data({ ok: false }, { status: 400 });
  }

  const theme = form.get("theme");

  if (theme !== "dark" && theme !== "light") {
    return data({ ok: false }, { status: 400 });
  }

  return data({ ok: true }, { headers: { "Set-Cookie": await serializeTheme(theme) } });
}
