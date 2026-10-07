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

interface GetOptions {
  userAgent: string;
  timeoutMs?: number;
  tries?: number;
  log?: Log;
}

/** GET a JSON document, retrying with a growing pause (5 s, 10 s, ...) on errors. */
export function getJson<T = unknown>(url: string, options: GetOptions): Promise<T> {
  return get(url, "application/json", (res) => res.json() as Promise<T>, options);
}

/** GET a page's text (HTML), retrying like getJson. */
export function getText(url: string, options: GetOptions): Promise<string> {
  return get(url, "text/html", (res) => res.text(), options);
}

async function get<T>(url: string, accept: string, read: (res: Response) => Promise<T>, { userAgent, timeoutMs = 60_000, tries = 3, log }: GetOptions): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": userAgent, Accept: accept },
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
      return await read(res);
    } catch (err) {
      if (attempt === tries - 1) throw new Error(describeError(err), { cause: err });
      log?.warn(`    retry after error: ${describeError(err)}`);
      await sleep(5_000 * (attempt + 1));
    }
  }
}
