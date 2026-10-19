import test from 'node:test';
import assert from 'node:assert/strict';
import { validateRoutineContract } from '../contract.mjs';
import {
  healthCheckRoutine,
  diskCheckRoutine,
  batteryCheckRoutine,
  backupVerifyRoutine,
  INITIAL_READONLY_ROUTINES
} from '../catalog.mjs';
import { createScheduler } from '../scheduler.mjs';

test('Contrato §5.2: valida catálogo e rejeita rotinas incompletas ou perigosas', () => {
  for (const r of INITIAL_READONLY_ROUTINES) {
    assert.equal(validateRoutineContract(r), null, `Rotina ${r.id} deve ser válida`);
  }

  // Falta campo obrigatório
  assert.match(validateRoutineContract({ id: 'invalida' }), /campo obrigatorio ausente/);
  // Sem action
  assert.match(validateRoutineContract({ ...healthCheckRoutine, action: null }), /campo obrigatorio ausente|action deve ser/);
  // Trigger inválido
  assert.match(validateRoutineContract({ ...healthCheckRoutine, trigger: 'magic' }), /trigger deve ser/);
  // Type inválido
  assert.match(validateRoutineContract({ ...healthCheckRoutine, type: 'dangerous' }), /type deve ser/);
});

test('Dry-Run §5.3: dry-run não executa a action real', async () => {
  let executed = false;
  const dummy = {
    ...healthCheckRoutine,
    id: 'dummy_dry',
    action: async () => { executed = true; return { ok: true }; }
  };

  const scheduler = createScheduler({ routines: [dummy] });
  const res = await scheduler.runRoutine('dummy_dry', { dryRun: true });

  assert.equal(res.ok, true);
  assert.equal(res.dryRun, true);
  assert.equal(res.wouldExecute, true);
  assert.equal(executed, false, 'Action real NÃO pode ser executada em modo dry-run');
});

test('Anti-thrashing §4.6: histerese temporal respeita minIntervalMs com relógio falso', async () => {
  let fakeTime = 100_000;
  const now = () => fakeTime;
  let runCount = 0;

  const routine = {
    ...healthCheckRoutine,
    id: 'anti_thrash_test',
    minIntervalMs: 15_000,
    action: async () => { runCount++; return { ok: true }; }
  };

  const scheduler = createScheduler({ routines: [routine], now });

  // 1ª execução no t = 100_000: deve rodar
  const r1 = await scheduler.runRoutine('anti_thrash_test');
  assert.equal(r1.ok, true);
  assert.equal(runCount, 1);

  // 2ª execução no t = 105_000 (+5s, menor que 15s): deve ser bloqueada pelo anti-thrashing
  fakeTime = 105_000;
  const r2 = await scheduler.runRoutine('anti_thrash_test');
  assert.equal(r2.skipped, true);
  assert.match(r2.reason, /anti-thrashing: minIntervalMs not met/);
  assert.equal(r2.retryInMs, 10_000);
  assert.equal(runCount, 1, 'Run count não deve aumentar');

  // 3ª execução no t = 115_001 (+15.001s): deve rodar com sucesso
  fakeTime = 115_001;
  const r3 = await scheduler.runRoutine('anti_thrash_test');
  assert.equal(r3.ok, true);
  assert.equal(runCount, 2);
});

test('Anti-thrashing §4.6: impede execuções concorrentes da mesma rotina', async () => {
  let resolveAction;
  const blockingAction = new Promise(r => { resolveAction = r; });

  const routine = {
    ...healthCheckRoutine,
    id: 'concurrent_test',
    minIntervalMs: 0,
    action: async () => { await blockingAction; return { ok: true }; }
  };

  const scheduler = createScheduler({ routines: [routine] });

  // Inicia a primeira chamada assíncrona
  const p1 = scheduler.runRoutine('concurrent_test');

  // Segunda chamada imediata enquanto a primeira ainda está rodando
  const r2 = await scheduler.runRoutine('concurrent_test');
  assert.equal(r2.skipped, true);
  assert.equal(r2.reason, 'routine already running');

  // Conclui a primeira
  resolveAction();
  const r1 = await p1;
  assert.equal(r1.ok, true);
});

test('Self-healing Circuit Breaker §5.4: aplica backoff ao atingir limite de falhas consecutivas', async () => {
  let fakeTime = 1_000_000;
  const now = () => fakeTime;
  let attempts = 0;

  const failingRoutine = {
    ...healthCheckRoutine,
    id: 'fail_routine',
    minIntervalMs: 10_000,
    maxRetries: 2,
    action: async () => { attempts++; throw new Error('Falha simulada'); }
  };

  const scheduler = createScheduler({ routines: [failingRoutine], now, log: () => {} });

  // 1ª falha
  const f1 = await scheduler.runRoutine('fail_routine');
  assert.equal(f1.ok, false);
  assert.equal(f1.status, 'FAILED');

  // Avança além do minInterval
  fakeTime += 15_000;
  // 2ª falha -> atinge maxRetries (2) -> DEGRADED
  const f2 = await scheduler.runRoutine('fail_routine');
  assert.equal(f2.ok, false);
  assert.equal(f2.status, 'DEGRADED');

  // Tentativa durante a janela de backoff
  fakeTime += 5_000;
  const f3 = await scheduler.runRoutine('fail_routine');
  assert.equal(f3.skipped, true);
  assert.match(f3.reason, /circuit breaker: routine in backoff/);
});

test('Rotina health_check: avalia endpoints simulados', async () => {
  const fakeFetch = async url => ({
    ok: url.includes('8080'),
    status: url.includes('8080') ? 200 : 503
  });

  const res = await healthCheckRoutine.action({
    fetchFn: fakeFetch,
    endpoints: ['http://127.0.0.1:8080/health', 'http://127.0.0.1:8090/health']
  });

  assert.equal(res.ok, false);
  assert.equal(res.status, 'UNHEALTHY');
  assert.equal(res.endpoints['http://127.0.0.1:8080/health'].status, 200);
  assert.equal(res.endpoints['http://127.0.0.1:8090/health'].status, 503);
});

test('Rotina disk_check: detecta estado saudável, crítico e UNKNOWN sem leitor (P0 R5)', async () => {
  // Sem leitor: NUNCA deve inventar número; devolve UNKNOWN
  const semLeitor = await diskCheckRoutine.action();
  assert.equal(semLeitor.ok, false);
  assert.equal(semLeitor.status, 'UNKNOWN');
  assert.equal(semLeitor.totalBytes, null);
  assert.equal(semLeitor.freeBytes, null);
  assert.match(semLeitor.reason, /nenhum leitor/);

  // Cenário saudável (>15% livre)
  const okDisk = await diskCheckRoutine.action({
    getDiskUsage: async () => ({ totalBytes: 100_000, freeBytes: 50_000 })
  });
  assert.equal(okDisk.ok, true);
  assert.equal(okDisk.status, 'HEALTHY');

  // Cenário crítico (<5% livre)
  const critDisk = await diskCheckRoutine.action({
    getDiskUsage: async () => ({ totalBytes: 100_000, freeBytes: 3_000 })
  });
  assert.equal(critDisk.ok, false);
  assert.equal(critDisk.status, 'CRITICAL');
  assert.match(critDisk.alert, /crítico/);
});

test('Rotina battery_check: detecta normal, térmica e UNKNOWN sem leitor (P0 R5)', async () => {
  // Sem leitor: NUNCA deve inventar número; devolve UNKNOWN
  const semLeitor = await batteryCheckRoutine.action();
  assert.equal(semLeitor.ok, false);
  assert.equal(semLeitor.status, 'UNKNOWN');
  assert.equal(semLeitor.percent, null);
  assert.equal(semLeitor.temperatureC, null);
  assert.match(semLeitor.reason, /nenhum leitor/);

  // Cenário normal
  const normal = await batteryCheckRoutine.action({
    getBatteryStatus: async () => ({ percent: 80, plugged: true, tempC: 25.0 })
  });
  assert.equal(normal.ok, true);
  assert.equal(normal.status, 'NORMAL');

  // Cenário térmico elevado
  const hot = await batteryCheckRoutine.action({
    getBatteryStatus: async () => ({ percent: 80, plugged: true, tempC: 46.5 })
  });
  assert.equal(hot.ok, false);
  assert.equal(hot.status, 'THERMAL_THROTTLED');
});

test('Self-healing Circuit Breaker §5.4: resultado ok:false conta como falha e aciona circuit breaker', async () => {
  let fakeTime = 2_000_000;
  const now = () => fakeTime;

  // Rotina que retorna { ok: false } sem lançar exceção
  const failingResultRoutine = {
    ...healthCheckRoutine,
    id: 'failing_result_routine',
    minIntervalMs: 5_000,
    maxRetries: 2,
    action: async () => ({ ok: false, error: 'serviço indisponível 503' })
  };

  const scheduler = createScheduler({ routines: [failingResultRoutine], now, log: () => {} });

  // 1ª falha com ok:false
  const r1 = await scheduler.runRoutine('failing_result_routine');
  assert.equal(r1.ok, false);
  assert.equal(r1.status, 'FAILED');
  assert.equal(scheduler.getRoutineState('failing_result_routine').consecutiveFailures, 1);

  // Avança além do minIntervalMs
  fakeTime += 10_000;
  // 2ª falha com ok:false -> atinge maxRetries (2) -> DEGRADED
  const r2 = await scheduler.runRoutine('failing_result_routine');
  assert.equal(r2.ok, false);
  assert.equal(r2.status, 'DEGRADED');
  assert.equal(scheduler.getRoutineState('failing_result_routine').consecutiveFailures, 2);

  // Tentativa durante janela de backoff
  fakeTime += 2_000;
  const r3 = await scheduler.runRoutine('failing_result_routine');
  assert.equal(r3.skipped, true);
  assert.match(r3.reason, /circuit breaker: routine in backoff/);
});

test('Timeout §5.3: limpa timer de timeout com clearTimeout', async () => {
  const quickRoutine = {
    ...healthCheckRoutine,
    id: 'quick_routine',
    timeoutMs: 10_000,
    action: async () => ({ ok: true, fast: true })
  };

  const scheduler = createScheduler({ routines: [quickRoutine] });
  const start = Date.now();
  const res = await scheduler.runRoutine('quick_routine');
  assert.equal(res.ok, true);
  // Garante que não ficou esperando os 10.000ms do timeout
  assert.ok(Date.now() - start < 1000, 'Execução deve ser imediata e sem timeout pendente');
});

test('Rotina backup_verify: valida metadados sem tocar no arquivo', async () => {
  // Diretório inexistente
  const noDir = await backupVerifyRoutine.action({ backupDir: 'caminho_inexistente_123' });
  assert.equal(noDir.ok, false);
  assert.equal(noDir.status, 'NO_BACKUP_DIR');
});
