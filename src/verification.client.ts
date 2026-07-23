import { Injectable } from '@nestjs/common';

export interface VerificationClient {
  verify(patientId: string): Promise<void>;
}

export class VerificationTimeout extends Error {}
export class VerificationServerError extends Error {}

@Injectable()
export class MockVerificationClient implements VerificationClient {
  async verify(patientId: string): Promise<void> {
    const roll = seededRandom(`${patientId}:${Date.now()}:${Math.random()}`);
    if (roll < 0.1) {
      await new Promise((_, reject) =>
        setTimeout(() => reject(new VerificationTimeout('verification timeout')), 250),
      );
      return;
    }
    if (roll < 0.4) {
      throw new VerificationServerError('verification provider 5xx');
    }
  }
}

export class ScriptedVerificationClient implements VerificationClient {
  private calls = 0;

  constructor(private readonly outcomes: Array<'ok' | '5xx' | 'timeout'>) {}

  get callCount(): number {
    return this.calls;
  }

  async verify(): Promise<void> {
    const outcome = this.outcomes[Math.min(this.calls, this.outcomes.length - 1)] ?? 'ok';
    this.calls += 1;
    if (outcome === 'ok') return;
    if (outcome === 'timeout') throw new VerificationTimeout('scripted timeout');
    throw new VerificationServerError('scripted 5xx');
  }
}

function seededRandom(seed: string): number {
  let hash = 2166136261;
  for (const char of seed) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967296;
}
