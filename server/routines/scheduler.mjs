// Scheduler mínimo de rotinas com dry-run e anti-thrashing (OMNISERVER §5.3 / §4.6 / §5.4).
import { validateRoutineContract } from './contract.mjs';

export function createScheduler({ routines = [], now = Date.now, maxHistory = 50, log = console.log } = {}) {
  const registered = new Map();
  const running = new Set();
  const state = new Map(); // id -> { lastRunAt, consecutiveFailures, status, backoffUntil }
  const history = [];
  let paused = false;

  const getRoutineState = id => {
    if (!state.has(id)) {
      state.set(id, { lastRunAt: 0, consecutiveFailures: 0, status: 'IDLE', backoffUntil: 0 });
    }
    return state.get(id);
  };

  const register = routine => {
    const err = validateRoutineContract(routine);
    if (err) throw new Error(`Rotina inválida [${routine?.id}]: ${err}`);
    registered.set(routine.id, routine);
  };

  for (const r of routines) register(r);

  const runRoutine = async (id, { dryRun = false, args = {} } = {}) => {
    const routine = registered.get(id);
    if (!routine) throw new Error(`Rotina não encontrada: ${id}`);

    if (paused) {
      return { skipped: true, reason: 'scheduler paused' };
    }

    const st = getRoutineState(id);
    const currentTime = now();

    // 1. Anti-thrashing: Concorrência exclusiva da mesma rotina
    if (running.has(id)) {
      return { skipped: true, reason: 'routine already running' };
    }

    // 2. Self-healing Circuit Breaker (§5.4): Backoff se degradado
    if (st.status === 'DEGRADED' && currentTime < st.backoffUntil) {
      return {
        skipped: true,
        reason: 'circuit breaker: routine in backoff',
        backoffRemainingMs: st.backoffUntil - currentTime
      };
    }

    // 3. Anti-thrashing (§4.6): Respeito estrito ao minIntervalMs (histerese temporal)
    if (currentTime - st.lastRunAt < routine.minIntervalMs) {
      return {
        skipped: true,
        reason: 'anti-thrashing: minIntervalMs not met',
        retryInMs: routine.minIntervalMs - (currentTime - st.lastRunAt)
      };
    }

    // 4. Modo Dry-Run (§5.3): Simula sem tocar em dados nem executar ações reais
    if (dryRun) {
      return {
        ok: true,
        dryRun: true,
        wouldExecute: true,
        routineId: id,
        timestamp: new Date(currentTime).toISOString()
      };
    }

    running.add(id);
    st.status = 'RUNNING';

    const auditEntry = {
      id,
      startedAt: currentTime,
      status: 'RUNNING'
    };

    let timer;
    try {
      const timeoutPromise = new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`Timeout de ${routine.timeoutMs}ms excedido`)), routine.timeoutMs);
      });

      // Execução com timeout
      const result = await Promise.race([
        routine.action({ ...args, now, dryRun: false }),
        timeoutPromise
      ]);

      if (result && result.ok === false) {
        throw new Error(result.error || result.reason || result.status || 'rotina reportou falha (ok:false)');
      }

      st.lastRunAt = currentTime;
      st.consecutiveFailures = 0;
      st.status = 'HEALTHY';
      st.backoffUntil = 0;

      auditEntry.finishedAt = now();
      auditEntry.durationMs = auditEntry.finishedAt - auditEntry.startedAt;
      auditEntry.ok = true;
      auditEntry.result = result;

      return { ok: true, result };
    } catch (err) {
      st.lastRunAt = currentTime;
      st.consecutiveFailures++;

      // Aplica circuit breaker se exceder retentativas
      if (st.consecutiveFailures >= routine.maxRetries) {
        st.status = 'DEGRADED';
        const backoffMs = routine.minIntervalMs * Math.pow(2, st.consecutiveFailures - routine.maxRetries + 1);
        st.backoffUntil = currentTime + backoffMs;
        log(`[scheduler] Rotina ${id} entrou em estado DEGRADED por ${st.consecutiveFailures} falhas. Backoff: ${backoffMs}ms`);
      } else {
        st.status = 'FAILED';
      }

      auditEntry.finishedAt = now();
      auditEntry.durationMs = auditEntry.finishedAt - auditEntry.startedAt;
      auditEntry.ok = false;
      auditEntry.error = err.message;

      return { ok: false, error: err.message, status: st.status };
    } finally {
      if (timer) clearTimeout(timer);
      running.delete(id);
      history.push(auditEntry);
      if (history.length > maxHistory) history.shift();
    }
  };

  return {
    register,
    runRoutine,
    getRoutine: id => registered.get(id),
    listRoutines: () => Array.from(registered.values()).map(r => ({
      id: r.id,
      name: r.name,
      version: r.version,
      type: r.type,
      trigger: r.trigger,
      minIntervalMs: r.minIntervalMs,
      maxIntervalMs: r.maxIntervalMs
    })),
    getRoutineState,
    getHistory: () => [...history],
    pause: () => { paused = true; },
    resume: () => { paused = false; },
    get isPaused() { return paused; },
    get isRunning() { return (id) => running.has(id); }
  };
}
