import { Inject, Injectable } from '@nestjs/common';
import { Database } from './database';
import { retry } from './retry';
import { HttpProblem, STEPS, Step, WorkflowRow } from './types';
import { VerificationClient } from './verification.client';

export const VERIFICATION_CLIENT = Symbol('VERIFICATION_CLIENT');

export interface WorkflowResponse {
  workflowId: string;
  patientId: string;
  completedSteps: Step[];
  unlockedStep: Step | null;
  eligibility: WorkflowRow['eligibility'];
  status: WorkflowRow['status'];
}

export interface EventResult {
  code: 200 | 202 | 409;
  error?: string;
}

@Injectable()
export class WorkflowService {
  constructor(
    private readonly db: Database,
    @Inject(VERIFICATION_CLIENT) private readonly verification: VerificationClient,
  ) {}

  async createWorkflow(patientId: string, age: number): Promise<{ workflowId: string }> {
    if (!patientId || !Number.isInteger(age)) {
      throw new HttpProblem(400, 'patientId and integer age are required');
    }

    try {
      const result = await this.db.pool.query<{ id: string }>(
        `INSERT INTO workflows (patient_id, age, status, eligibility, current_step)
         VALUES ($1, $2, 'ACTIVE', 'PENDING', 'CONTACT_VERIFIED')
         RETURNING id`,
        [patientId, age],
      );
      return { workflowId: result.rows[0].id };
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new HttpProblem(409, 'active workflow already exists for patientId');
      }
      throw error;
    }
  }

  async getWorkflow(id: string): Promise<WorkflowResponse> {
    const workflow = await this.loadWorkflow(id);
    if (!workflow) throw new HttpProblem(404, 'workflow not found');
    return this.toResponse(workflow);
  }

  async applyEvent(id: string, eventId: string, step: Step): Promise<EventResult> {
    if (!eventId || !isStep(step)) {
      throw new HttpProblem(400, 'eventId and valid step are required');
    }

    return this.db.withTransaction(async (client) => {
      const workflow = await this.loadWorkflowForUpdate(client, id);
      if (!workflow) throw new HttpProblem(404, 'workflow not found');

      const duplicate = await client.query(
        'SELECT 1 FROM processed_events WHERE event_id = $1',
        [eventId],
      );
      if (duplicate.rowCount) return { code: 200 };

      if (workflow.status !== 'ACTIVE' || workflow.current_step !== step) {
        throw new HttpProblem(409, 'step is not currently unlocked');
      }

      if (step === 'CONTACT_VERIFIED') {
        const verified = await this.runVerification(workflow.id);
        if (!verified) {
          await client.query(
            `UPDATE workflows
             SET status = 'VERIFICATION_FAILED', updated_at = now()
             WHERE id = $1`,
            [workflow.id],
          );
          await client.query(
            `INSERT INTO processed_events (event_id, workflow_id, step)
             VALUES ($1, $2, $3)`,
            [eventId, workflow.id, step],
          );
          return { code: 409, error: 'verification failed' };
        }
      }

      const nextWorkflow = applyStep(workflow, step);

      await client.query(
        `UPDATE workflows
         SET status = $2,
             eligibility = $3,
             completed_steps = $4::jsonb,
             current_step = $5,
             version = version + 1,
             updated_at = now()
         WHERE id = $1`,
        [
          workflow.id,
          nextWorkflow.status,
          nextWorkflow.eligibility,
          JSON.stringify(nextWorkflow.completed_steps),
          nextWorkflow.current_step,
        ],
      );

      try {
        await client.query(
          `INSERT INTO processed_events (event_id, workflow_id, step)
           VALUES ($1, $2, $3)`,
          [eventId, workflow.id, step],
        );
      } catch (error) {
        if (isUniqueViolation(error)) return { code: 200 };
        throw error;
      }

      return { code: 202 };
    });
  }

  async simulateCrashAfterWorkflowUpdate(id: string, eventId: string, step: Step): Promise<void> {
    await this.db.withTransaction(async (client) => {
      const workflow = await this.loadWorkflowForUpdate(client, id);
      if (!workflow) throw new HttpProblem(404, 'workflow not found');
      if (workflow.current_step !== step) throw new HttpProblem(409, 'step is not currently unlocked');
      const nextWorkflow = applyStep(workflow, step);
      await client.query(
        `UPDATE workflows
         SET status = $2, eligibility = $3, completed_steps = $4::jsonb, current_step = $5
         WHERE id = $1`,
        [
          id,
          nextWorkflow.status,
          nextWorkflow.eligibility,
          JSON.stringify(nextWorkflow.completed_steps),
          nextWorkflow.current_step,
        ],
      );
      void eventId;
      throw new Error('simulated process crash before processed_events insert');
    });
  }

  private async runVerification(id: string): Promise<boolean> {
    try {
      await retry(() => this.verification.verify(id), {
        attempts: 4,
        baseMs: Number(process.env.RETRY_BASE_MS ?? 25),
        maxMs: Number(process.env.RETRY_MAX_MS ?? 250),
        jitterMs: Number(process.env.RETRY_JITTER_MS ?? 25),
      });
      return true;
    } catch (error) {
      console.log('MY LOG BEFORE OPERATOR ALERT');

      console.error(
        JSON.stringify({
          event: 'operator_alert',
          workflowId: id,
          reason: 'verification_failed_after_retries',
          error: error instanceof Error ? error.message : String(error),
        }),
      );
      return false;
    }
  }

  private async loadWorkflow(id: string): Promise<WorkflowRow | null> {
    const result = await this.db.pool.query<WorkflowRow>(
      `SELECT id, patient_id, age, status, eligibility, completed_steps, current_step, version
       FROM workflows WHERE id = $1`,
      [id],
    );
    return normalize(result.rows[0]);
  }

  private async loadWorkflowForUpdate(client: { query: Function }, id: string): Promise<WorkflowRow | null> {
    const result = await client.query(
      `SELECT id, patient_id, age, status, eligibility, completed_steps, current_step, version
       FROM workflows WHERE id = $1 FOR UPDATE`,
      [id],
    );
    return normalize(result.rows[0]);
  }

  private toResponse(workflow: WorkflowRow): WorkflowResponse {
    return {
      workflowId: workflow.id,
      patientId: workflow.patient_id,
      completedSteps: workflow.completed_steps,
      unlockedStep: workflow.status === 'ACTIVE' ? workflow.current_step : null,
      eligibility: workflow.eligibility,
      status: workflow.status,
    };
  }
}

function applyStep(workflow: WorkflowRow, step: Step): WorkflowRow {
  const completed = [...workflow.completed_steps, step];
  let eligibility = workflow.eligibility;
  let status = workflow.status;

  if (step === 'ELIGIBILITY_COMPLETED') {
    eligibility = workflow.age >= 18 && workflow.age <= 75 ? 'ELIGIBLE' : 'INELIGIBLE';
  }

  if (step === 'APPOINTMENT_BOOKED') {
    if (workflow.eligibility !== 'ELIGIBLE') {
      throw new HttpProblem(409, 'appointment requires eligible patient');
    }
    status = 'COMPLETED';
  }

  return {
    ...workflow,
    completed_steps: completed,
    eligibility,
    status,
    current_step: status === 'COMPLETED' ? null : STEPS[completed.length] ?? null,
  };
}

function isStep(step: string): step is Step {
  return (STEPS as readonly string[]).includes(step);
}

function normalize(row: WorkflowRow | undefined): WorkflowRow | null {
  if (!row) return null;
  return {
    ...row,
    completed_steps: Array.isArray(row.completed_steps)
      ? row.completed_steps
      : JSON.parse(String(row.completed_steps)),
  };
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === '23505';
}
