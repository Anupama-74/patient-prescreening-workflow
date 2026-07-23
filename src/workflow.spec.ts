import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { AppModule } from './app.module';
import { Database } from './database';
import { HttpProblemFilter } from './http-exception.filter';
import { ScriptedVerificationClient } from './verification.client';
import { VERIFICATION_CLIENT, WorkflowService } from './workflow.service';

describe('workflow adversarial behavior', () => {
  let app: INestApplication;
  let db: Database;
  let provider: ScriptedVerificationClient;
  let service: WorkflowService;

  async function boot(outcomes: Array<'ok' | '5xx' | 'timeout'> = ['ok']) {
    provider = new ScriptedVerificationClient(outcomes);
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(VERIFICATION_CLIENT)
      .useValue(provider)
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalFilters(app.get(HttpProblemFilter));
    await app.init();
    db = app.get(Database);
    service = app.get(WorkflowService);
    await db.pool.query('TRUNCATE processed_events, workflows RESTART IDENTITY CASCADE');
  }

  async function createWorkflow(age = 42): Promise<string> {
    const response = await request(app.getHttpServer())
      .post('/workflows')
      .send({ patientId: `p-${Date.now()}-${Math.random()}`, age })
      .expect(201);
    return response.body.workflowId;
  }

  async function createWorkflowFor(patientId: string, age = 42): Promise<string> {
    const response = await request(app.getHttpServer())
      .post('/workflows')
      .send({ patientId, age })
      .expect(201);
    return response.body.workflowId;
  }

  function accepted(id: string, eventId: string, step: string) {
    return request(app.getHttpServer()).post(`/workflows/${id}/events`).send({ eventId, step });
  }

  afterEach(async () => {
    await app?.close();
  });

  it('rejects duplicate patient workflows', async () => {
    await boot();
    await createWorkflowFor('same-patient', 30);
    await request(app.getHttpServer())
      .post('/workflows')
      .send({ patientId: 'same-patient', age: 30 })
      .expect(409);
  });

  it('allows a new workflow for the same patient after a terminal state', async () => {
    await boot();
    const firstId = await createWorkflowFor('repeat-patient', 30);
    await accepted(firstId, 'r1', 'CONTACT_VERIFIED').expect(202);
    await accepted(firstId, 'r2', 'CONSENT_CAPTURED').expect(202);
    await accepted(firstId, 'r3', 'ELIGIBILITY_COMPLETED').expect(202);
    await accepted(firstId, 'r4', 'APPOINTMENT_BOOKED').expect(202);

    const secondId = await createWorkflowFor('repeat-patient', 31);
    expect(secondId).not.toBe(firstId);
  });

  it('handles duplicate event delivery as an idempotent no-op', async () => {
    await boot();
    const id = await createWorkflow();

    await accepted(id, 'evt-contact', 'CONTACT_VERIFIED').expect(202);
    await accepted(id, 'evt-contact', 'CONTACT_VERIFIED').expect(200);

    const state = await request(app.getHttpServer()).get(`/workflows/${id}`).expect(200);
    expect(state.body.completedSteps).toEqual(['CONTACT_VERIFIED']);
    expect(state.body.unlockedStep).toBe('CONSENT_CAPTURED');
  });

  it('scopes duplicate event IDs to the workflow', async () => {
    await boot();
    const firstId = await createWorkflow();
    const secondId = await createWorkflow();

    await accepted(firstId, 'same-event-id', 'CONTACT_VERIFIED').expect(202);
    await accepted(secondId, 'same-event-id', 'CONTACT_VERIFIED').expect(202);

    const firstState = await request(app.getHttpServer()).get(`/workflows/${firstId}`).expect(200);
    const secondState = await request(app.getHttpServer()).get(`/workflows/${secondId}`).expect(200);
    expect(firstState.body.completedSteps).toEqual(['CONTACT_VERIFIED']);
    expect(secondState.body.completedSteps).toEqual(['CONTACT_VERIFIED']);
  });

  it('rejects out-of-order steps', async () => {
    await boot();
    const id = await createWorkflow();

    await accepted(id, 'evt-consent-too-soon', 'CONSENT_CAPTURED').expect(409);

    const state = await request(app.getHttpServer()).get(`/workflows/${id}`).expect(200);
    expect(state.body.completedSteps).toEqual([]);
    expect(state.body.unlockedStep).toBe('CONTACT_VERIFIED');
  });

  it('serializes concurrent events for one workflow without double-applying', async () => {
    await boot();
    const id = await createWorkflow();

    const responses = await Promise.all(
      Array.from({ length: 12 }, (_, index) =>
        accepted(id, `evt-race-${index}`, 'CONTACT_VERIFIED'),
      ),
    );

    expect(responses.filter((response) => response.status === 202)).toHaveLength(1);
    expect(responses.filter((response) => response.status === 409)).toHaveLength(11);
    const state = await request(app.getHttpServer()).get(`/workflows/${id}`).expect(200);
    expect(state.body.completedSteps).toEqual(['CONTACT_VERIFIED']);
  });

  it('retries flaky verification and marks terminal failure with operator alert path', async () => {
    await boot(['5xx', 'timeout', '5xx', '5xx']);
    const id = await createWorkflow();

    await accepted(id, 'evt-contact-fails', 'CONTACT_VERIFIED').expect(409);

    expect(provider.callCount).toBe(4);
    const state = await request(app.getHttpServer()).get(`/workflows/${id}`).expect(200);
    expect(state.body.status).toBe('VERIFICATION_FAILED');
    expect(state.body.completedSteps).toEqual([]);

    await accepted(id, 'evt-contact-fails', 'CONTACT_VERIFIED').expect(200);
    await accepted(id, 'evt-new-after-fail', 'CONTACT_VERIFIED').expect(409);
  });

  it('completes the happy path and blocks ineligible appointment booking', async () => {
    await boot();
    const eligibleId = await createWorkflow(18);
    await accepted(eligibleId, 'c1', 'CONTACT_VERIFIED').expect(202);
    await accepted(eligibleId, 'c2', 'CONSENT_CAPTURED').expect(202);
    await accepted(eligibleId, 'c3', 'ELIGIBILITY_COMPLETED').expect(202);
    await accepted(eligibleId, 'c4', 'APPOINTMENT_BOOKED').expect(202);
    const complete = await request(app.getHttpServer()).get(`/workflows/${eligibleId}`).expect(200);
    expect(complete.body.status).toBe('COMPLETED');
    expect(complete.body.eligibility).toBe('ELIGIBLE');
    expect(complete.body.unlockedStep).toBeNull();
    await accepted(eligibleId, 'c4', 'APPOINTMENT_BOOKED').expect(200);
    await accepted(eligibleId, 'c5', 'APPOINTMENT_BOOKED').expect(409);

    const ineligibleId = await createWorkflow(80);
    await accepted(ineligibleId, 'i1', 'CONTACT_VERIFIED').expect(202);
    await accepted(ineligibleId, 'i2', 'CONSENT_CAPTURED').expect(202);
    await accepted(ineligibleId, 'i3', 'ELIGIBILITY_COMPLETED').expect(202);
    await accepted(ineligibleId, 'i4', 'APPOINTMENT_BOOKED').expect(409);
  });

  it('converges after a crash before the processed-event insert', async () => {
    await boot();
    const id = await createWorkflow();

    await expect(
      service.simulateCrashAfterWorkflowUpdate(id, 'evt-crash', 'CONTACT_VERIFIED'),
    ).rejects.toThrow('simulated process crash');

    let state = await request(app.getHttpServer()).get(`/workflows/${id}`).expect(200);
    expect(state.body.completedSteps).toEqual([]);

    await accepted(id, 'evt-crash', 'CONTACT_VERIFIED').expect(202);
    await accepted(id, 'evt-crash', 'CONTACT_VERIFIED').expect(200);

    state = await request(app.getHttpServer()).get(`/workflows/${id}`).expect(200);
    expect(state.body.completedSteps).toEqual(['CONTACT_VERIFIED']);
    expect(state.body.unlockedStep).toBe('CONSENT_CAPTURED');
  });
});
