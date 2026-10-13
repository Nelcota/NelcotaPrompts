import { data } from "react-router";

import type { ActionResult } from "~/shared/lib/action-result";

// Resposta de action com status HTTP; ok sai do status (< 400).
export function actionReply<Extra extends object = object>(intent: string, status: number, message: string, extra?: Extra) {
  return data<ActionResult<Extra>>({ ok: status < 400, intent, message, ...extra } as ActionResult<Extra>, { status });
}

export type ActionReply<Extra extends object = object> = ReturnType<typeof actionReply<Extra>>;
