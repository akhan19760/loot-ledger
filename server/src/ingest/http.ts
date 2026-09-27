/** Minimal logger: satisfied by console and by Fastify's (pino) logger. */
export interface Log {
  info(msg: string): void;
  warn(msg: string): void;
  error(msg: string): void;
}

export const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** fetch() reports network errors as "fetch failed" with the real reason in `cause`. */
export function describeError(err: unknown): string {
  if (!(err instanceof Error)) return String(err);
  const cause = err.cause as { code?: string; message?: string } | undefined;
  const detail = cause?.code ?? cause?.message;
  return detail && !err.message.includes(detail) ? `${err.message} (${detail})` : err.message;
}

interface GetJsonOptions {
  userAgent: string;
  timeoutMs?: number;
  tries?: number;
  log?: Log;
}

/** GET a JSON document, retrying with a growing pause (5 s, 10 s, ...) on errors. */
export async function getJson<T = unknown>(url: string, { userAgent, timeoutMs = 60_000, tries = 3, log }: GetJsonOptions): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": userAgent, Accept: "application/json" },
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
      return (await res.json()) as T;
    } catch (err) {
      if (attempt === tries - 1) throw new Error(describeError(err), { cause: err });
      log?.warn(`    retry after error: ${describeError(err)}`);
      await sleep(5_000 * (attempt + 1));
    }
  }
}
