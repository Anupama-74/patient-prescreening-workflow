import { Controller, Get, Header } from '@nestjs/common';

@Controller()
export class UiController {
  @Get('favicon.ico')
  @Header('content-type', 'image/x-icon')
  favicon(): string {
    return '';
  }

  @Get()
  @Header('content-type', 'text/html; charset=utf-8')
  index(): string {
    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Srotas Clinical Workflow</title>
  <style>
    :root {
      color-scheme: light;
      --ink: #17201c;
      --muted: #5c6661;
      --line: #d8ddd9;
      --panel: #ffffff;
      --wash: #f4f7f5;
      --green: #167a55;
      --blue: #2368a2;
      --red: #b3261e;
      --amber: #9a5b00;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      color: var(--ink);
      background: var(--wash);
    }
    header {
      min-height: 132px;
      padding: 28px 32px 18px;
      background: #0f2f2a;
      color: #fff;
      display: flex;
      align-items: end;
      justify-content: space-between;
      gap: 24px;
    }
    h1 { margin: 0; font-size: 30px; line-height: 1.1; font-weight: 760; letter-spacing: 0; }
    .subtitle { margin: 8px 0 0; color: #c7d8d2; max-width: 720px; }
    .status-pill {
      border: 1px solid rgba(255,255,255,.28);
      color: #e8f2ee;
      padding: 8px 10px;
      border-radius: 6px;
      white-space: nowrap;
      font-size: 13px;
    }
    main {
      display: grid;
      grid-template-columns: minmax(320px, 440px) minmax(0, 1fr);
      gap: 18px;
      padding: 18px;
      max-width: 1360px;
      margin: 0 auto;
    }
    section {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 16px;
    }
    h2 { margin: 0 0 12px; font-size: 17px; letter-spacing: 0; }
    label { display: block; font-size: 12px; color: var(--muted); margin-bottom: 6px; }
    input, select {
      width: 100%;
      min-height: 38px;
      border: 1px solid #c7cec9;
      border-radius: 6px;
      padding: 8px 10px;
      font: inherit;
      background: #fff;
      color: var(--ink);
    }
    .grid { display: grid; grid-template-columns: 1fr 108px; gap: 10px; }
    .field { margin-bottom: 12px; }
    .buttons { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
    button {
      min-height: 36px;
      border: 1px solid #b9c2bc;
      border-radius: 6px;
      padding: 8px 11px;
      background: #fff;
      color: var(--ink);
      cursor: pointer;
      font: inherit;
      font-weight: 650;
    }
    button.primary { background: var(--green); border-color: var(--green); color: #fff; }
    button.blue { background: var(--blue); border-color: var(--blue); color: #fff; }
    button.danger { background: #fff; border-color: #d6aaa6; color: var(--red); }
    button:disabled { opacity: .55; cursor: not-allowed; }
    .steps {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 8px;
      margin: 12px 0;
    }
    .step {
      min-height: 86px;
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 10px;
      background: #fbfcfb;
    }
    .step strong { display: block; font-size: 12px; overflow-wrap: anywhere; }
    .step span { display: inline-block; margin-top: 12px; font-size: 12px; color: var(--muted); }
    .step.done { border-color: #9ac7b3; background: #edf8f2; }
    .step.open { border-color: #8cb7de; background: #edf5fc; }
    .state-grid {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 10px;
      margin-bottom: 12px;
    }
    .metric {
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 10px;
      background: #fbfcfb;
      min-height: 72px;
    }
    .metric span { display: block; color: var(--muted); font-size: 12px; margin-bottom: 6px; }
    .metric strong { font-size: 15px; overflow-wrap: anywhere; }
    pre {
      min-height: 180px;
      max-height: 380px;
      overflow: auto;
      background: #101815;
      color: #d9ece4;
      border-radius: 8px;
      padding: 12px;
      font-size: 12px;
      line-height: 1.45;
    }
    .log {
      display: grid;
      gap: 8px;
      max-height: 260px;
      overflow: auto;
    }
    .entry {
      border-left: 4px solid var(--blue);
      background: #f9fbfa;
      padding: 8px 10px;
      font-size: 13px;
    }
    .entry.bad { border-left-color: var(--red); }
    .entry.ok { border-left-color: var(--green); }
    .entry.warn { border-left-color: var(--amber); }
    .muted { color: var(--muted); }
    @media (max-width: 880px) {
      header { display: block; padding: 22px 18px 16px; }
      .status-pill { display: inline-block; margin-top: 14px; }
      main { grid-template-columns: 1fr; padding: 12px; }
      .steps, .state-grid { grid-template-columns: 1fr 1fr; }
    }
  </style>
</head>
<body>
  <header>
    <div>
      <h1>Srotas Clinical Workflow</h1>
      <p class="subtitle">REST API console for patient pre-screening, idempotency, sequential gating, provider failure, and concurrency demos.</p>
    </div>
    <div class="status-pill" id="apiStatus">API ready</div>
  </header>
  <main>
    <div>
      <section>
        <h2>Create Workflow</h2>
        <div class="grid">
          <div class="field">
            <label for="patientId">Patient ID</label>
            <input id="patientId" value="demo-patient-1" />
          </div>
          <div class="field">
            <label for="age">Age</label>
            <input id="age" type="number" value="34" />
          </div>
        </div>
        <div class="buttons">
          <button class="primary" id="createBtn">Create</button>
          <button id="freshBtn">Fresh Demo ID</button>
        </div>
      </section>

      <section style="margin-top:18px">
        <h2>Send Event</h2>
        <div class="field">
          <label for="workflowId">Workflow ID</label>
          <input id="workflowId" placeholder="Create or paste workflow id" />
        </div>
        <div class="field">
          <label for="eventId">Event ID</label>
          <input id="eventId" value="evt-contact-1" />
        </div>
        <div class="field">
          <label for="step">Step</label>
          <select id="step">
            <option>CONTACT_VERIFIED</option>
            <option>CONSENT_CAPTURED</option>
            <option>ELIGIBILITY_COMPLETED</option>
            <option>APPOINTMENT_BOOKED</option>
          </select>
        </div>
        <div class="buttons">
          <button class="blue" id="sendBtn">Send Event</button>
          <button id="replayBtn">Replay Same Event</button>
          <button id="loadBtn">Refresh State</button>
        </div>
      </section>

      <section style="margin-top:18px">
        <h2>Adversarial Demo</h2>
        <div class="buttons">
          <button id="raceBtn">Fire 20 Concurrent Contact Events</button>
          <button class="danger" id="outOfOrderBtn">Send Out-of-Order Consent</button>
          <button class="danger" id="crashBtn">Simulate Crash Hook</button>
        </div>
        <p class="muted">Crash hook requires <code>ENABLE_DEBUG_ROUTES=true</code>.</p>
      </section>
    </div>

    <div>
      <section>
        <h2>Workflow State</h2>
        <div class="state-grid">
          <div class="metric"><span>Status</span><strong id="status">-</strong></div>
          <div class="metric"><span>Eligibility</span><strong id="eligibility">-</strong></div>
          <div class="metric"><span>Unlocked</span><strong id="unlocked">-</strong></div>
          <div class="metric"><span>Patient</span><strong id="patient">-</strong></div>
        </div>
        <div class="steps" id="steps"></div>
        <pre id="json">{}</pre>
      </section>

      <section style="margin-top:18px">
        <h2>Request Log</h2>
        <div class="log" id="log"></div>
      </section>
    </div>
  </main>
  <script>
    const steps = ['CONTACT_VERIFIED', 'CONSENT_CAPTURED', 'ELIGIBILITY_COMPLETED', 'APPOINTMENT_BOOKED'];
    const $ = (id) => document.getElementById(id);
    let lastState = null;

    function stepSlug(step) {
      return step.toLowerCase().replaceAll('_', '-');
    }

    function newEventId(step) {
      return 'evt-' + stepSlug(step) + '-' + Date.now().toString().slice(-6);
    }

    function addLog(label, status, body) {
      const item = document.createElement('div');
      const kind = status >= 200 && status < 300 ? 'ok' : status === 409 ? 'warn' : 'bad';
      item.className = 'entry ' + kind;
      item.textContent = label + ' -> ' + status + ' ' + JSON.stringify(body);
      $('log').prepend(item);
    }

    async function api(label, url, options) {
      $('apiStatus').textContent = 'Calling API...';
      try {
        const response = await fetch(url, {
          headers: { 'Content-Type': 'application/json' },
          ...options,
        });
        const text = await response.text();
        const body = text ? JSON.parse(text) : {};
        addLog(label, response.status, body);
        $('apiStatus').textContent = 'Last response ' + response.status;
        return { response, body };
      } catch (error) {
        addLog(label, 0, { error: String(error) });
        $('apiStatus').textContent = 'Request failed';
        throw error;
      }
    }

    function render(state) {
      lastState = state;
      $('status').textContent = state?.status ?? '-';
      $('eligibility').textContent = state?.eligibility ?? '-';
      $('unlocked').textContent = state?.unlockedStep ?? 'null';
      $('patient').textContent = state?.patientId ?? '-';
      $('json').textContent = JSON.stringify(state ?? {}, null, 2);
      $('steps').innerHTML = '';
      for (const step of steps) {
        const node = document.createElement('div');
        const done = state?.completedSteps?.includes(step);
        const open = state?.unlockedStep === step;
        node.className = 'step ' + (done ? 'done' : open ? 'open' : '');
        node.innerHTML = '<strong>' + step + '</strong><span>' + (done ? 'completed' : open ? 'unlocked' : 'locked') + '</span>';
        $('steps').appendChild(node);
      }
    }

    async function loadState() {
      const id = $('workflowId').value.trim();
      if (!id) {
        addLog('GET workflow', 0, { error: 'Create or paste a workflow ID first' });
        return;
      }
      const { response, body } = await api('GET workflow', '/workflows/' + id, { method: 'GET' });
      if (response.ok) render(body);
    }

    $('freshBtn').onclick = () => {
      const suffix = Date.now().toString().slice(-6);
      $('patientId').value = 'demo-patient-' + suffix;
      $('eventId').value = newEventId($('step').value);
    };

    $('createBtn').onclick = async () => {
      const { response, body } = await api('POST workflow', '/workflows', {
        method: 'POST',
        body: JSON.stringify({ patientId: $('patientId').value.trim(), age: Number($('age').value) }),
      });
      if (response.status === 201) {
        $('workflowId').value = body.workflowId;
        await loadState();
        if (lastState?.unlockedStep) {
          $('step').value = lastState.unlockedStep;
          $('eventId').value = newEventId(lastState.unlockedStep);
        }
      }
    };

    $('sendBtn').onclick = async () => {
      const id = $('workflowId').value.trim();
      if (!id) {
        addLog('POST event', 0, { error: 'Create or paste a workflow ID first' });
        return;
      }
      await api('POST event', '/workflows/' + id + '/events', {
        method: 'POST',
        body: JSON.stringify({ eventId: $('eventId').value.trim(), step: $('step').value }),
      });
      await loadState();
      if (lastState?.unlockedStep) {
        $('step').value = lastState.unlockedStep;
        $('eventId').value = newEventId(lastState.unlockedStep);
      }
    };

    $('replayBtn').onclick = $('sendBtn').onclick;
    $('loadBtn').onclick = loadState;
    $('step').onchange = () => {
      $('eventId').value = newEventId($('step').value);
    };

    $('outOfOrderBtn').onclick = async () => {
      const id = $('workflowId').value.trim();
      if (!id) {
        addLog('POST out-of-order', 0, { error: 'Create or paste a workflow ID first' });
        return;
      }
      await api('POST out-of-order', '/workflows/' + id + '/events', {
        method: 'POST',
        body: JSON.stringify({ eventId: 'evt-out-of-order-' + Date.now(), step: 'CONSENT_CAPTURED' }),
      });
      await loadState();
    };

    $('raceBtn').onclick = async () => {
      const id = $('workflowId').value.trim();
      if (!id) {
        addLog('race', 0, { error: 'Create or paste a workflow ID first' });
        return;
      }
      const calls = Array.from({ length: 20 }, (_, index) =>
        api('race #' + (index + 1), '/workflows/' + id + '/events', {
          method: 'POST',
          body: JSON.stringify({ eventId: 'evt-race-ui-' + Date.now() + '-' + index, step: 'CONTACT_VERIFIED' }),
        })
      );
      await Promise.allSettled(calls);
      await loadState();
    };

    $('crashBtn').onclick = async () => {
      const id = $('workflowId').value.trim();
      if (!id) {
        addLog('debug crash', 0, { error: 'Create or paste a workflow ID first' });
        return;
      }
      await api('debug crash', '/debug/workflows/' + id + '/crash-after-workflow-update', {
        method: 'POST',
        body: JSON.stringify({ eventId: 'evt-crash-ui-' + Date.now(), step: 'CONTACT_VERIFIED' }),
      });
      await loadState();
    };

    render(null);
  </script>
</body>
</html>`;
  }
}
