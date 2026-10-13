import { RateLimiterMemory, RateLimiterRes } from "rate-limiter-flexible";

// Limite de tentativas (rate-limiter-flexible). Em memória: vale por instância, o que
// basta com uma réplica no Coolify; com várias, troque por RateLimiterPostgres/Redis aqui
// (as funções abaixo continuam iguais).

const limiters = new Map<string, RateLimiterMemory>();

// Um limitador por combinação de limite e janela (cada uso tem a sua).
function limiterFor(max: number, windowMs: number): RateLimiterMemory {
  const id = `${max}:${windowMs}`;
  let limiter = limiters.get(id);

  if (limiter === undefined) {
    limiter = new RateLimiterMemory({ points: max, duration: Math.ceil(windowMs / 1000), keyPrefix: id });
    limiters.set(id, limiter);
  }

  return limiter;
}

export type LimitStatus = { limited: false } | { limited: true; retryAfterSeconds: number };

type Limit = { max: number; windowMs: number };

// Confere e já conta a tentativa numa operação só: requisições em paralelo não escapam
// do limite.
export async function consumeAttempt(key: string, max: number, windowMs: number): Promise<LimitStatus> {
  try {
    await limiterFor(max, windowMs).consume(key);

    return { limited: false };
  } catch (error) {
    if (error instanceof RateLimiterRes) {
      return { limited: true, retryAfterSeconds: Math.max(1, Math.ceil(error.msBeforeNext / 1000)) };
    }

    throw error;
  }
}

// Devolve uma tentativa contada (ex.: login que deu certo não gasta o limite do IP).
export async function releaseAttempt(key: string, { max, windowMs }: Limit) {
  await limiterFor(max, windowMs).reward(key, 1);
}

export async function clearAttempts(key: string, { max, windowMs }: Limit) {
  await limiterFor(max, windowMs).delete(key);
}

export function retryAfterHeaders(retryAfterSeconds: number): HeadersInit {
  return { "Retry-After": String(retryAfterSeconds) };
}

export function tooManyAttemptsMessage(retryAfterSeconds: number): string {
  const minutes = Math.ceil(retryAfterSeconds / 60);

  return minutes <= 1 ? "Muitas tentativas. Espere um minuto e tente de novo." : `Muitas tentativas. Espere ${minutes} minutos e tente de novo.`;
}
