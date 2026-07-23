import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Pool, PoolClient } from 'pg';

@Injectable()
export class Database implements OnModuleInit, OnModuleDestroy {
  readonly pool = new Pool({
    connectionString:
      process.env.DATABASE_URL ?? 'postgres://srotas:srotas@localhost:5432/srotas',
    max: Number(process.env.DB_POOL_SIZE ?? 20),
  });

  async onModuleInit(): Promise<void> {
    await this.migrate();
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }

  async withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  private async migrate(): Promise<void> {
    await this.pool.query(`
      CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

      CREATE TABLE IF NOT EXISTS workflows (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        patient_id text NOT NULL,
        age integer NOT NULL,
        status text NOT NULL CHECK (status IN ('ACTIVE', 'COMPLETED', 'VERIFICATION_FAILED')),
        eligibility text NOT NULL CHECK (eligibility IN ('PENDING', 'ELIGIBLE', 'INELIGIBLE')),
        completed_steps jsonb NOT NULL DEFAULT '[]'::jsonb,
        current_step text,
        version integer NOT NULL DEFAULT 0,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS processed_events (
        event_id text NOT NULL,
        workflow_id uuid NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
        step text NOT NULL,
        processed_at timestamptz NOT NULL DEFAULT now()
      );

      ALTER TABLE processed_events
        DROP CONSTRAINT IF EXISTS processed_events_pkey;

      CREATE UNIQUE INDEX IF NOT EXISTS processed_events_workflow_event_idx
        ON processed_events(workflow_id, event_id);

      CREATE INDEX IF NOT EXISTS processed_events_workflow_id_idx
        ON processed_events(workflow_id);

      CREATE UNIQUE INDEX IF NOT EXISTS workflows_one_active_patient_idx
        ON workflows(patient_id)
        WHERE status = 'ACTIVE';
    `);
  }
}
