import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
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

test('Timeout §5.3: aborta rotina que excede o tempo limite (mata M1)', async () => {
  const hangingRoutine = {
    ...healthCheckRoutine,
    id: 'hanging_routine',
    timeoutMs: 50,
    action: async () => new Promise(() => {}) // nunca resolve
  };

  const scheduler = createScheduler({ routines: [hangingRoutine] });
  const res = await scheduler.runRoutine('hanging_routine');
  assert.equal(res.ok, false);
  assert.match(res.error, /Timeout de 50ms excedido/);
  const state = scheduler.getRoutineState('hanging_routine');
  assert.equal(state.status, 'FAILED');
  assert.equal(state.consecutiveFailures, 1);
});

test('Scheduler: pausa e retoma execução de rotinas', async () => {
  const dummyRoutine = {
    ...healthCheckRoutine,
    id: 'dummy_routine',
    action: async () => ({ ok: true })
  };
  const scheduler = createScheduler({ routines: [dummyRoutine] });
  assert.equal(scheduler.isPaused, false);
  scheduler.pause();
  assert.equal(scheduler.isPaused, true);
  const resPaused = await scheduler.runRoutine('dummy_routine');
  assert.equal(resPaused.skipped, true);
  assert.equal(resPaused.reason, 'scheduler paused');

  scheduler.resume();
  assert.equal(scheduler.isPaused, false);
  const resResumed = await scheduler.runRoutine('dummy_routine');
  assert.equal(resResumed.ok, true);
});

test('Rotina disk_check: cobre ramos de aviso, crítico e saudável', async () => {
  // Aviso (< 15%)
  const warn = await diskCheckRoutine.action({ getDiskUsage: async () => ({ totalBytes: 1000, freeBytes: 100 }) });
  assert.equal(warn.ok, true);
  assert.equal(warn.status, 'WARNING');
  assert.equal(warn.alert, 'Armazenamento baixo (<15%)');

  // Crítico (< 5%)
  const crit = await diskCheckRoutine.action({ getDiskUsage: async () => ({ totalBytes: 1000, freeBytes: 40 }) });
  assert.equal(crit.ok, false);
  assert.equal(crit.status, 'CRITICAL');
  assert.equal(crit.alert, 'Armazenamento em nível crítico (<5%)');

  // Saudável
  const ok = await diskCheckRoutine.action({ getDiskUsage: async () => ({ totalBytes: 1000, freeBytes: 500 }) });
  assert.equal(ok.ok, true);
  assert.equal(ok.status, 'HEALTHY');
  assert.equal(ok.alert, null);
});

test('Rotina battery_check: cobre ramos de bateria baixa, superaquecimento e normal', async () => {
  // Bateria baixa (<= 15% e desplugado)
  const low = await batteryCheckRoutine.action({
    getBatteryStatus: async () => ({ percent: 12, plugged: false, tempC: 30 })
  });
  assert.equal(low.ok, false);
  assert.equal(low.status, 'LOW_BATTERY');
  assert.match(low.alert, /Bateria baixa/);

  // Superaquecimento (>= 45C)
  const hot = await batteryCheckRoutine.action({
    getBatteryStatus: async () => ({ percent: 80, plugged: true, tempC: 47.5 })
  });
  assert.equal(hot.ok, false);
  assert.equal(hot.status, 'THERMAL_THROTTLED');
  assert.match(hot.alert, /Temperatura elevada/);

  // Normal
  const norm = await batteryCheckRoutine.action({
    getBatteryStatus: async () => ({ percent: 85, plugged: true, tempC: 32 })
  });
  assert.equal(norm.ok, true);
  assert.equal(norm.status, 'NORMAL');
  assert.equal(norm.alert, null);
});

test('Rotina backup_verify: cobre ausência de backups, arquivo corrompido/vazio, desatualizado e válido', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'backup-verify-'));
  try {
    // Diretório vazio (sem backups)
    const semBackups = await backupVerifyRoutine.action({ backupDir: dir });
    assert.equal(semBackups.ok, false);
    assert.equal(semBackups.status, 'NO_BACKUPS_FOUND');

    // Backup vazio ou < 100 bytes
    writeFileSync(join(dir, 'backup-pequeno.tar.gz'), 'abc');
    const vazio = await backupVerifyRoutine.action({ backupDir: dir });
    assert.equal(vazio.ok, false);
    assert.equal(vazio.status, 'EMPTY_OR_CORRUPT');

    // Backup desatualizado (> maxAgeHours)
    const agora = Date.now();
    const conteudoValido = 'X'.repeat(500);
    const arqAntigo = join(dir, 'backup-antigo.tar.gz');
    writeFileSync(arqAntigo, conteudoValido);
    const desatualizado = await backupVerifyRoutine.action({
      backupDir: dir,
      maxAgeHours: 48,
      now: () => agora + (72 * 3600 * 1000)
    });
    assert.equal(desatualizado.ok, false);
    assert.equal(desatualizado.status, 'OUTDATED');

    // Backup válido
    const valido = await backupVerifyRoutine.action({
      backupDir: dir,
      maxAgeHours: 48,
      now: () => agora
    });
    assert.equal(valido.ok, true);
    assert.equal(valido.status, 'VALID');
    assert.equal(valido.latestBackup, 'backup-antigo.tar.gz');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

