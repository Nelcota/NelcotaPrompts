import { createCookie } from "react-router";

import type { Theme } from "~/features/theme/theme";

// Preferência de tema num cookie próprio (não depende de login).
const themeCookie = createCookie("__nelcota_theme", {
  httpOnly: true,
  maxAge: 60 * 60 * 24 * 365,
  path: "/",
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
});

export async function getTheme(request: Request): Promise<Theme> {
  const value: unknown = await themeCookie.parse(request.headers.get("Cookie"));

  return value === "light" ? "light" : "dark";
}

export function serializeTheme(theme: Theme) {
  return themeCookie.serialize(theme);
}
