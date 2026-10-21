export class CreditServiceUnavailableError extends Error {}

export const canUseLocalCreditFallback = (error: unknown, development: boolean) =>
  development && (error instanceof CreditServiceUnavailableError || error instanceof TypeError);

export const creditServiceError = (status: number, message: string) =>
  status === 404 || status >= 500 ? new CreditServiceUnavailableError(message) : new Error(message);

export async function withDevelopmentTimeout<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  development: boolean,
  timeoutMs = 4000
): Promise<T> {
  const controller = new AbortController();
  if (!development) return operation(controller.signal);
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation(controller.signal),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          reject(new CreditServiceUnavailableError('The local application service did not respond in time.'));
          controller.abort();
        }, timeoutMs);
      })
    ]);
  } finally {
    clearTimeout(timer);
  }
}
