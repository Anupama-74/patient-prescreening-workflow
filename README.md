# Srotas Health Workflow Service

## Run
```bash
docker compose up --build
npm test
```

If your Docker install uses the older standalone Compose command, run:

```bash
docker-compose up --build
npm test
```

The API listens on port `3000`. `POST /workflows` creates one active workflow per `patientId`. `POST /workflows/:id/events` accepts `CONTACT_VERIFIED`, `CONSENT_CAPTURED`, `ELIGIBILITY_COMPLETED`, and `APPOINTMENT_BOOKED`. `GET /workflows/:id` returns the harness-required state fields.

## Correctness Choices
Workflow state lives in PostgreSQL, never in process memory. Event handling runs inside one transaction and locks the workflow row with `SELECT ... FOR UPDATE`, so concurrent events for the same workflow serialize at the database row. Idempotency is enforced by the `processed_events(event_id)` unique constraint. A duplicate insert conflict is treated as a committed prior delivery and returns `200` without reapplying state. Sequential gating compares the incoming step to the persisted unlocked step and returns `409` for locked or out-of-order steps; events are never queued or silently reordered.

Crash safety comes from transaction boundaries: state updates and the processed-event insert commit together or roll back together. The test suite simulates a crash after mutating workflow state but before inserting the idempotency record, rolls back, then replays the event and asserts convergence. In production I would add graceful shutdown draining, pool health metrics, deadlock retry with bounded attempts, and alerting on repeated verification failures or high lock wait times.

## Flaky Provider
`CONTACT_VERIFIED` calls `VerificationClient`. Production mode simulates about 30% 5xx and 10% timeouts. The service retries with exponential backoff, jitter, and a ceiling. Exhaustion marks the workflow `VERIFICATION_FAILED` and writes a structured `operator_alert` log. Tests inject scripted deterministic provider outcomes, so the suite does not flake.

## Throughput
This design is bounded by PostgreSQL write throughput and per-workflow lock contention. Different workflows can process concurrently; events for one workflow serialize by design. On a modest laptop Postgres, expect hundreds to low thousands of small transactional events/second when spread across workflows. At `1,000 events/sec`, the first break point is hot-key contention if many events target the same workflow, followed by connection-pool saturation and lock wait latency. Horizontal API replicas are safe because the database constraints and row locks are the source of truth.
