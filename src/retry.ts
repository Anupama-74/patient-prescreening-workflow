export interface RetryOptions {
  attempts: number;
  baseMs: number;
  maxMs: number;
  jitterMs: number;
  sleep?: (ms: number) => Promise<void>;
  random?: () => number;
}

export async function retry<T>(
  operation: () => Promise<T>,
  options: RetryOptions,
): Promise<T> {
  const sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  const random = options.random ?? Math.random;
  let lastError: unknown;

  for (let attempt = 0; attempt < options.attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt === options.attempts - 1) break;
      const exponential = options.baseMs * 2 ** attempt;
      const delay = Math.min(options.maxMs, exponential) + Math.floor(random() * options.jitterMs);
      await sleep(delay);
    }
  }

  throw lastError;
}
